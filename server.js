import express from 'express';
import bcrypt from 'bcrypt';
import passport from 'passport';
import flash from 'express-flash';
import session from 'express-session';
import methodOverride from 'method-override';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { Strategy as LocalStrategy } from 'passport-local';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 80;

// Connection Pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Adjust based on your needs
  queueLimit: 0, // Unlimited waiting requests in the queue
  connectTimeout: 10000 // 10 seconds for establishing connections
});

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));

// Serve static files
app.use('/css', express.static('css'));
app.use('/js', express.static('js'));
app.use('/resources', express.static('resources'));

// Passport configuration
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const [rows] = await db.query('SELECT * FROM Person WHERE username = ?', [username]);
      if (rows.length === 0) return done(null, false, { message: 'No user with that username' });

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      return match ? done(null, user) : done(null, false, { message: 'Incorrect password' });
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query('SELECT * FROM Person WHERE id = ?', [id]);
    return done(null, rows[0]);
  } catch (err) {
    return done(err);
  }
});

// Middleware to protect routes
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Routes
app.get('/', (req, res) => res.render('landing.ejs', { user: req.user }));

app.get('/login', (req, res) => res.render('login.ejs', { message: req.flash('error') }));
app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/my_events',
    failureRedirect: '/login',
    failureFlash: true,
  })
);

app.get('/register', (req, res) => res.render('register.ejs'));
app.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, dob, username, password, email, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO Person (first_name, last_name, dob, username, password, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [first_name, last_name, dob, username, hashedPassword, email, phone]
    );
    res.redirect('/login');
  } catch (err) {
    console.error('Error registering user:', err);
    res.redirect('/register');
  }
});

app.get('/my_events', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT Event.id, Event.name, Event.event_date AS date, Event.start_time, Event.end_time, Event.details, Event.guest_count, Venue.name AS venue_name, Venue.address AS address 
       FROM Event 
       LEFT JOIN Venue ON Event.venue_id = Venue.id 
       WHERE Event.created_by = ? 
       ORDER BY Event.event_date ASC`,
      [req.user.id]
    );
    res.render('index.ejs', { user: req.user, events });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.redirect('/login');
  }
});

app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile.ejs', { user: req.user });
});

app.put('/profile', ensureAuthenticated, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, username, password } = req.body;

    const queryParams = [first_name, last_name, email, phone, username, req.user.id];
    let query = 'UPDATE Person SET first_name = ?, last_name = ?, email = ?, phone = ?, username = ?';

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      queryParams.splice(queryParams.length - 1, 0, hashedPassword);
    }

    query += ' WHERE id = ?';
    await db.query(query, queryParams);

    res.redirect('/profile');
  } catch (err) {
    console.error('Error updating profile:', err);
    res.redirect('/profile');
  }
});

app.get('/event', ensureAuthenticated, (req, res) => res.render('event.ejs', { user: req.user }));
app.post('/event', ensureAuthenticated, async (req, res) => {
  try {
    const { name, event_date, start_time, end_time, guest_count, details, venue_name, address, max_capacity } = req.body;

    const [venueResult] = await db.query(
      'INSERT INTO Venue (name, address, max_capacity, owner) VALUES (?, ?, ?, ?)',
      [venue_name, address, max_capacity, req.user.id]
    );

    await db.query(
      'INSERT INTO Event (name, venue_id, event_date, start_time, end_time, guest_count, details, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, venueResult.insertId, event_date, start_time, end_time, guest_count, details, req.user.id]
    );

    res.redirect('/my_events');
  } catch (err) {
    console.error('Error creating event:', err);
    res.redirect('/event');
  }
});

app.get('/event/:id/edit', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await db.query('SELECT * FROM Event WHERE id = ? AND created_by = ?', [req.params.id, req.user.id]);
    if (events.length === 0) return res.redirect('/my_events');
    res.render('edit-event.ejs', { user: req.user, event: events[0] });
  } catch (err) {
    console.error('Error fetching event for edit:', err);
    res.redirect('/my_events');
  }
});

app.get('/event/:id/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT Event.id, Event.name, Event.event_date AS date, Event.start_time, Event.end_time, Event.details, Event.guest_count, Venue.name AS venue_name, Venue.address AS address 
       FROM Event
       LEFT JOIN Venue ON Event.venue_id = Venue.id
       WHERE Event.id = ? AND created_by = ?`,
      [req.params.id, req.user.id]
    );

    if (events.length === 0) return res.redirect('/my_events');
    res.render('dashboard.ejs', { user: req.user, event: events[0] });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.redirect('/my_events');
  }
});

app.put('/event/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { name, event_date, start_time, end_time, guest_count, details } = req.body;

    // Update the event in the database
    await db.query(
      'UPDATE Event SET name = ?, event_date = ?, start_time = ?, end_time = ?, guest_count = ?, details = ? WHERE id = ? AND created_by = ?',
      [name, event_date, start_time, end_time, guest_count, details, req.params.id, req.user.id]
    );

    res.redirect('/my_events');
  } catch (err) {
    console.error('Error updating event:', err);
    res.redirect(`/event/${req.params.id}/edit`);
  }
});

app.delete('/event/:id', ensureAuthenticated, async (req, res) => {
  try {
    await db.query('DELETE FROM Event WHERE id = ? AND created_by = ?', [req.params.id, req.user.id]);
    res.redirect('/my_events');
  } catch (err) {
    console.error('Error deleting event:', err);
    res.redirect('/my_events');
  }
});

app.delete('/logout', (req, res) => {
  req.logOut(() => res.redirect('/login'));
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

import express from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import flash from 'express-flash';
import session from 'express-session';
import methodOverride from 'method-override';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { Strategy as LocalStrategy } from 'passport-local';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`Request URL: ${req.url}`);
  next();
});

// Serve static CSS, JS, and public files
app.use('/css', express.static('css'));
app.use('/js', express.static('js'));
app.use(express.static('public'));

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false // Trailing comma added
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0 // Trailing comma added
});

console.log('Connected to AWS RDS Database');

// Passport configuration for user authentication
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const [rows] = await pool.query('SELECT * FROM Person WHERE username = ?', [username]);
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
    const [rows] = await pool.query('SELECT * FROM Person WHERE id = ?', [id]);
    return done(null, rows[0]);
  } catch (err) {
    return done(err);
  }
});

// Middleware to ensure routes are accessible only to logged-in users
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.redirect('/login');
}

// Routes

// Home route showing user-specific events
app.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await pool.query(
      `SELECT Event.id, Event.name, Event.event_date, Event.start_time, Event.end_time, Event.guest_count, 
              Event.details, Venue.name AS venue_name 
       FROM Event 
       LEFT JOIN Venue ON Event.venue_id = Venue.id 
       WHERE Event.created_by = ?`,
      [req.user.id]
    );
    res.render('index.ejs', { user: req.user, events });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.redirect('/login');
  }
});

app.get('/event/:id/dashboard', ensureAuthenticated, async (req, res) => {
  const eventId = req.params.id;

  try {
    const [events] = await pool.query(
      `SELECT Event.name AS event_name, Venue.name AS venue_name, Event.guest_count 
       FROM Event 
       LEFT JOIN Venue ON Event.venue_id = Venue.id 
       WHERE Event.id = ?`,
      [eventId]
    );

    const event = events.length > 0 ? events[0] : { event_name: 'No Events', venue_name: 'N/A', guest_count: 0 };
    res.render('dashboard.ejs', { user: req.user, event });
  } catch (err) {
    console.error('Error loading dashboard for event:', err);
    res.send('Database error occurred');
  }
});

// Profile page route
app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile.ejs', { user: req.user });
});

// Update profile route
app.post('/profile', ensureAuthenticated, async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : req.user.password;

    await pool.query(
      'UPDATE Person SET email = ?, password = ? WHERE id = ?',
      [email, hashedPassword, req.user.id]
    );

    res.redirect('/profile');
  } catch (err) {
    console.error('Error updating profile:', err);
    res.redirect('/profile');
  }
});

// Edit profile page
app.get('/edit-profile', ensureAuthenticated, (req, res) => {
  res.render('edit-profile.ejs', { user: req.user, message: '' });
});

app.post('/edit-profile', ensureAuthenticated, async (req, res) => {
  try {
    // Fetch the current user data to retain unmodified values
    const [currentUserData] = await pool.query('SELECT * FROM Person WHERE id = ?', [req.user.id]);
    const currentUser = currentUserData[0];

    // Destructure the request body and fall back to existing values if fields are empty
    const {
      first_name = currentUser.first_name,
      last_name = currentUser.last_name,
      email = currentUser.email,
      phone = currentUser.phone,
      password
    } = req.body;

    // Hash the password only if it was provided; otherwise, keep the existing password
    const hashedPassword = password ? await bcrypt.hash(password, 10) : currentUser.password;

    // Update the database with modified or retained values (excluding dob)
    await pool.query(
      'UPDATE Person SET first_name = ?, last_name = ?, email = ?, phone = ?, password = ? WHERE id = ?',
      [first_name, last_name, email, phone, hashedPassword, req.user.id]
    );

    // Redirect back to profile with a success message
    res.render('profile.ejs', {
      user: { ...req.user, first_name, last_name, email, phone },
      message: 'Changes have been successfully applied.'
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.redirect('/edit-profile');
  }
});

// Login routes
app.get('/login', (req, res) => res.render('login.ejs', { message: req.flash('error') }));
app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  })
);

// Registration routes
app.get('/register', (req, res) => res.render('register.ejs'));
app.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, dob, username, password, email, phone } = req.body; // eslint-disable-line camelcase
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO Person (first_name, last_name, dob, username, password, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [first_name, last_name, dob, username, hashedPassword, email, phone] // eslint-disable-line camelcase
    );
    res.redirect('/login');
  } catch (err) {
    console.error('Error registering user:', err);
    res.redirect('/register');
  }
});

// Logout route
app.delete('/logout', (req, res) => {
  req.logOut(() => res.redirect('/login'));
});

// Dashboard route
app.get('/event/:id/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT Event.id, Event.name, Event.event_date AS date, Event.start_time, Event.end_time, Event.details, Event.guest_count, Venue.name AS venue_name, Venue.Address AS address 
        FROM Event
        LEFT JOIN Venue ON Event.venue_id = Venue.id
        WHERE Event.id = ? AND created_by = ? `,
      [req.params.id, req.user.id]
    );

    const event = events.length > 0 ? events[0] : { event_name: 'No Events', venue_name: 'N/A', guest_count: 0 };
    res.render('dashboard.ejs', { user: req.user, event: events[0] });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.redirect('/');
  }
});

// Event creation routes
app.get('/event', ensureAuthenticated, (req, res) => res.render('event.ejs', { user: req.user }));
app.post('/event', ensureAuthenticated, async (req, res) => {
  try {
    const { name, event_date, start_time, end_time, guest_count, details, venue_name, address, max_capacity } = req.body; // eslint-disable-line camelcase, max-len
    const [venueResult] = await pool.query(
      'INSERT INTO Venue (name, address, max_capacity, owner) VALUES (?, ?, ?, ?)',
      [venue_name, address, max_capacity, req.user.id] // eslint-disable-line camelcase
    );
    const venue_id = venueResult.insertId; // eslint-disable-line camelcase
    await pool.query(
      'INSERT INTO Event (name, venue_id, event_date, start_time, end_time, guest_count, details, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, venue_id, event_date, start_time, end_time, guest_count, details, req.user.id] // eslint-disable-line camelcase
    );
    res.redirect('/');
  } catch (err) {
    console.error('Error creating event:', err);
    res.redirect('/event');
  }
});

// Event editing routes
app.get('/event/:id/edit', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await pool.query('SELECT * FROM Event WHERE id = ? AND created_by = ?', [req.params.id, req.user.id]);
    if (events.length === 0) return res.redirect('/');
    return res.render('edit-event.ejs', { user: req.user, event: events[0] });
  } catch (err) {
    console.error('Error fetching event for edit:', err);
    res.redirect('/');
    return null; // Add a return statement here for consistent return
  }
});

app.put('/event/:id', ensureAuthenticated, async (req, res) => {
  const { name, event_date, start_time, end_time, guest_count, details } = req.body; // eslint-disable-line camelcase, max-len
  try {
    await pool.query(
      'UPDATE Event SET name = ?, event_date = ?, start_time = ?, end_time = ?, guest_count = ?, details = ? WHERE id = ? AND created_by = ?',
      [name, event_date, start_time, end_time, guest_count, details, req.params.id, req.user.id] // eslint-disable-line camelcase
    );
    res.redirect('/');
  } catch (err) {
    console.error('Error updating event:', err);
    res.redirect(`/event/${req.params.id}/edit`);
  }
});

// Event deletion route
app.delete('/event/:id', ensureAuthenticated, async (req, res) => {
  try {
    await pool.query('DELETE FROM Event WHERE id = ? AND created_by = ?', [req.params.id, req.user.id]);
    res.redirect('/');
  } catch (err) {
    console.error('Error deleting event:', err);
    res.redirect('/');
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Gracefully close the database pool on exit
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Database pool closed');
  process.exit(0);
});

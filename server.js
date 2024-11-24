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

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use('/css', express.static('css'));
app.use('/js', express.static('js'));
app.use('/resources', express.static('resources'));

// Passport configuration
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
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

// Middleware to ensure authenticated routes
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
    await pool.query(
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
    const [events] = await pool.query(
      `SELECT Event.id, Event.name, Event.event_date AS date, Event.start_time, Event.end_time, Event.details, Event.guest_count, Venue.name AS venue_name, Venue.Address AS address 
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

app.get('/profile', ensureAuthenticated, async (req, res) => {
  res.render('profile.ejs', { user: req.user });
});

app.put('/profile', ensureAuthenticated, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, username, password } = req.body;

    let updateQuery = 'UPDATE Person SET first_name = ?, last_name = ?, email = ?, phone = ?, username = ?';
    let queryParams = [first_name, last_name, email, phone, username, req.user.id];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = ?';
      queryParams.splice(queryParams.length - 1, 0, hashedPassword);
    }

    updateQuery += ' WHERE id = ?';

    await pool.query(updateQuery, queryParams);
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
    const [venueResult] = await pool.query(
      'INSERT INTO Venue (name, address, max_capacity, owner) VALUES (?, ?, ?, ?)',
      [venue_name, address, max_capacity, req.user.id]
    );
    const venue_id = venueResult.insertId;
    await pool.query(
      'INSERT INTO Event (name, venue_id, event_date, start_time, end_time, guest_count, details, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, venue_id, event_date, start_time, end_time, guest_count, details, req.user.id]
    );
    res.redirect('/my_events');
  } catch (err) {
    console.error('Error creating event:', err);
    res.redirect('/event');
  }
});

app.delete('/logout', (req, res) => {
  req.logOut(() => res.redirect('/login'));
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

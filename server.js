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
const healthCheckApp = express(); // Separate app for health check
const PORT = process.env.PORT || 3000;

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`Request URL: ${req.url}`);
  next();
});

// Health check on a separate server
healthCheckApp.get('/health', (req, res) => {
  res.sendStatus(200);
  console.log('Health check endpoint hit');
});

// Start the health check server on port 80
healthCheckApp.listen(80, () => {
  console.log('Health check server running on port 80');
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
    saveUninitialized: false,
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
  queueLimit: 0,
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

// Dashboard for a specific event
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

// Login routes
app.get('/login', (req, res) => res.render('login.ejs', { message: req.flash('error') }));
app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true,
  })
);

// Registration routes
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

// Logout route
app.delete('/logout', (req, res) => {
  req.logOut(() => res.redirect('/login'));
});

// Start the main app server on port 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Gracefully close the database pool on exit
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Database pool closed');
  process.exit(0);
});

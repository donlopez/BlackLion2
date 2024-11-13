import express from 'express';
import bcrypt from 'bcrypt';
import passport from 'passport';
import flash from 'express-flash';
import session from 'express-session';
import methodOverride from 'method-override';
import axios from 'axios';
import dotenv from 'dotenv';
import { Strategy as LocalStrategy } from 'passport-local';

dotenv.config();

// Helper function to fetch data from the API
async function fetchDataFromAPI(endpoint, method = 'GET', data = {}) {
  try {
    const response = await axios({
      method,
      url: `${process.env.API_URL}/${endpoint}`,
      data,
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching data from API endpoint "${endpoint}":`, error.message);
    return null;
  }
}

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
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));

// Passport configuration for user authentication
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const users = await fetchDataFromAPI(`person?username=${username}`);
      if (!users || users.length === 0) {
        return done(null, false, { message: 'No user with that username' });
      }

      const user = users[0];
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
    const user = await fetchDataFromAPI(`person/${id}`);
    if (!user) {
      return done(new Error('User not found'));
    }
    return done(null, user);
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
    const events = await fetchDataFromAPI(`events?created_by=${req.user.id}`);
    res.render('index.ejs', { user: req.user, events });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.redirect('/login');
  }
});

app.get('/event/:id/dashboard', ensureAuthenticated, async (req, res) => {
  const eventId = req.params.id;
  try {
    const event = await fetchDataFromAPI(`event/${eventId}`);
    if (!event) {
      return res.status(404).send('Event not found');
    }
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

    await fetchDataFromAPI(`person/${req.user.id}`, 'PUT', {
      email,
      password: hashedPassword
    });

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
    const { first_name, last_name, email, phone, password } = req.body;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : req.user.password;

    await fetchDataFromAPI(`person/${req.user.id}`, 'PUT', {
      first_name,
      last_name,
      email,
      phone,
      password: hashedPassword
    });

    res.redirect('/profile');
  } catch (err) {
    console.error('Error updating profile:', err);
    res.redirect('/edit-profile');
  }
});

// Login routes
app.get('/login', (req, res) => {
  res.render('login.ejs', { message: req.flash('error') });
});

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
    const { first_name, last_name, dob, username, password, email, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    await fetchDataFromAPI('person', 'POST', {
      first_name,
      last_name,
      dob,
      username,
      password: hashedPassword,
      email,
      phone
    });

    res.redirect('/login');
  } catch (err) {
    console.error('Error registering user:', err);
    res.redirect('/register');
  }
});

// Event creation route
app.post('/event', ensureAuthenticated, async (req, res) => {
  try {
    const { name, event_date, start_time, end_time, guest_count, details, venue_name, address, max_capacity } = req.body;
    await fetchDataFromAPI('event', 'POST', {
      name,
      event_date,
      start_time,
      end_time,
      guest_count,
      details,
      venue_name,
      address,
      max_capacity,
      created_by: req.user.id
    });
    res.redirect('/');
  } catch (err) {
    console.error('Error creating event:', err);
    res.redirect('/event');
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

process.on('SIGINT', async () => {
  console.log('Graceful shutdown');
  process.exit(0);
});

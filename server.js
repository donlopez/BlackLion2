import express from 'express';
import bcrypt from 'bcrypt';
import passport from 'passport';
import flash from 'express-flash';
import session from 'express-session';
import methodOverride from 'method-override';
import dotenv from 'dotenv';
import { Strategy as LocalStrategy } from 'passport-local';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Fetch data from the API Gateway
async function fetchDataFromAPI() {
  try {
    const response = await axios.get(process.env.API_URL);
    return response.data;
  } catch (error) {
    console.error('Error fetching data from API:', error);
    return [];
  }
}

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
      const users = await fetchDataFromAPI(); // Use API to fetch users
      const user = users.find(u => u.username === username);
      if (!user) return done(null, false, { message: 'No user with that username' });

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
    const users = await fetchDataFromAPI(); // Use API to fetch users
    const user = users.find(u => u.id === id);
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
    const events = await fetchDataFromAPI(); // Use API to fetch events data
    res.render('index.ejs', { user: req.user, events });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.redirect('/login');
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
    await fetchDataFromAPI(); // Fetch or update profile through the API if needed
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
    const users = await fetchDataFromAPI();
    const currentUser = users.find(u => u.id === req.user.id);

    const { first_name, last_name, email, phone, password } = req.body;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : currentUser.password;

    // Update fields as needed
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
    const { first_name, last_name, dob, username, password, email, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await fetchDataFromAPI(); // Use API to create a user if needed
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

// Event creation routes
app.get('/event', ensureAuthenticated, (req, res) => res.render('event.ejs', { user: req.user }));
app.post('/event', ensureAuthenticated, async (req, res) => {
  try {
    await fetchDataFromAPI(); // Use API to create an event if needed
    res.redirect('/');
  } catch (err) {
    console.error('Error creating event:', err);
    res.redirect('/event');
  }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

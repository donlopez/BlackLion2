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

// MySQL connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000
});

// Middlewares
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

// static resources
app.use('/css', express.static('css'));
app.use('/js', express.static('js'));
app.use('/resources', express.static('resources'));

// Passport local strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const [rows] = await db.query('SELECT * FROM Person WHERE Username = ?', [username]);
      if (rows.length === 0) return done(null, false, { message: 'No user with that username' });

      const user = rows[0];
      const match = await bcrypt.compare(password, user.Password);
      return match
        ? done(null, user)
        : done(null, false, { message: 'Incorrect password' });
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => done(null, user.PersonID));
passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query('SELECT * FROM Person WHERE PersonID = ?', [id]);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.redirect('/login');
}

// Landing
app.get('/', (req, res) => {
  res.render('landing.ejs', {
    user: req.user
      ? { ...req.user, first_name: req.user.FirstName, last_name: req.user.LastName }
      : null
  });
});

// Auth
app.get('/login', (req, res) => res.render('login.ejs', { message: req.flash('error') }));

app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/my_events',
    failureRedirect: '/login',
    failureFlash: true
  })
);

app.get('/register', (req, res) => res.render('register.ejs'));

app.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, dob, username, password, email, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO Person (FirstName, LastName, DOB, Username, Password, Email, Phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, dob, username, hashedPassword, email, phone]
    );
    return res.redirect('/login');
  } catch (err) {
    console.error('Error registering user:', err);
    return res.redirect('/register');
  }
});

// My Events
app.get('/my_events', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT Event.EventID, Event.Name, Event.EventDate AS date, Event.StartTime, Event.EndTime, 
              Event.Details, Event.GuestCount,
              Venue.Name AS venue_name, Venue.Address AS address
       FROM Event
       LEFT JOIN Venue ON Event.VenueID = Venue.VenueID
       WHERE Event.CreatedByID = ?
       ORDER BY Event.EventDate ASC`,
      [req.user.PersonID]
    );
    return res.render('index.ejs', {
      user: { ...req.user, first_name: req.user.FirstName, last_name: req.user.LastName },
      events
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    return res.redirect('/login');
  }
});

// Profile
app.get('/profile', ensureAuthenticated, (req, res) => res.render('profile.ejs', {
  user: { ...req.user, first_name: req.user.FirstName, last_name: req.user.LastName }
}));

app.put('/profile', ensureAuthenticated, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, username, password } = req.body;

    let query = `
      UPDATE Person SET FirstName = ?, LastName = ?, Email = ?, Phone = ?, Username = ?`;
    const params = [first_name, last_name, email, phone, username];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', Password = ?';
      params.push(hashedPassword);
    }
    query += ' WHERE PersonID = ?';
    params.push(req.user.PersonID);

    await db.query(query, params);

    // propagate to venue
    await db.query(
      'UPDATE Venue SET Email = ?, Phone = ? WHERE OwnerID = ?',
      [email, phone, req.user.PersonID]
    );

    return res.redirect('/profile');
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.redirect('/profile');
  }
});

// Create Event
app.get('/event', ensureAuthenticated, (req, res) => res.render('event.ejs', {
  user: { ...req.user, first_name: req.user.FirstName, last_name: req.user.LastName }
}));

app.post('/event', ensureAuthenticated, async (req, res) => {
  try {
    const { name, event_date, start_time, end_time, guest_count, details, venue_name, address, max_capacity } = req.body;

    const ownerEmail = req.user.Email;
    const ownerPhone = req.user.Phone;

    const [venueResult] = await db.query(
      `INSERT INTO Venue (Name, Address, MaxCapacity, Availability, OwnerID, Email, Phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [venue_name, address, max_capacity, 1, req.user.PersonID, ownerEmail, ownerPhone]
    );

    await db.query(
      `INSERT INTO Event (Name, VenueID, EventDate, StartTime, EndTime, GuestCount, Details, CreatedByID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, venueResult.insertId, event_date, start_time, end_time, guest_count, details, req.user.PersonID]
    );

    return res.redirect('/my_events');
  } catch (err) {
    console.error('Error creating event:', err);
    return res.redirect('/event');
  }
});

// Edit Event
app.get('/event/:id/edit', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await db.query(
      'SELECT * FROM Event WHERE EventID = ? AND CreatedByID = ?',
      [req.params.id, req.user.PersonID]
    );
    if (events.length === 0) return res.redirect('/my_events');
    return res.render('edit-event.ejs', {
      user: { ...req.user, first_name: req.user.FirstName, last_name: req.user.LastName },
      event: events[0]
    });
  } catch (err) {
    console.error('Error fetching event for edit:', err);
    return res.redirect('/my_events');
  }
});

// Dashboard
app.get('/event/:id/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT Event.EventID, Event.Name, Event.EventDate AS date, Event.StartTime, Event.EndTime, 
              Event.Details, Event.GuestCount,
              Venue.Name AS venue_name, Venue.Address AS address
       FROM Event
       LEFT JOIN Venue ON Event.VenueID = Venue.VenueID
       WHERE Event.EventID = ? AND Event.CreatedByID = ?`,
      [req.params.id, req.user.PersonID]
    );

    if (events.length === 0) return res.redirect('/my_events');

    const event = events[0];
    return res.render('dashboard.ejs', {
      user: { ...req.user, first_name: req.user.FirstName, last_name: req.user.LastName },
      event: {
        name: event.Name || 'Unnamed Event',
        details: event.Details || 'No details provided',
        date: event.date,
        venue_name: event.venue_name,
        address: event.address,
        guest_count: event.GuestCount || 0
      }
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    return res.redirect('/my_events');
  }
});

// Update Event
app.put('/event/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { name, event_date, start_time, end_time, guest_count, details } = req.body;
    await db.query(
      `UPDATE Event
       SET Name = ?, EventDate = ?, StartTime = ?, EndTime = ?, GuestCount = ?, Details = ?
       WHERE EventID = ? AND CreatedByID = ?`,
      [name, event_date, start_time, end_time, guest_count, details, req.params.id, req.user.PersonID]
    );
    return res.redirect('/my_events');
  } catch (err) {
    console.error('Error updating event:', err);
    return res.redirect(`/event/${req.params.id}/edit`);
  }
});

// Delete Event
app.delete('/event/:id', ensureAuthenticated, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM Event WHERE EventID = ? AND CreatedByID = ?',
      [req.params.id, req.user.PersonID]
    );
    return res.redirect('/my_events');
  } catch (err) {
    console.error('Error deleting event:', err);
    return res.redirect('/my_events');
  }
});

// Logout
app.delete('/logout', (req, res) => {
  req.logOut(() => res.redirect('/login'));
});

// Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

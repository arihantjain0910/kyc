const express = require('express');
const path = require('path');
const ejs = require('ejs');
const mysql = require('mysql2/promise'); // Use promise-based version of mysql2
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('connect-flash');
const methodOverride = require('method-override');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
    res.locals.error = req.flash('error');
    next();
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Sangam@2024',
    database: 'kyc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Passport Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'employee_code',
    passwordField: 'password'
}, async (employee_code, password, done) => {
    try {
        const [results] = await pool.query('SELECT * FROM users WHERE employee_code = ?', [employee_code]);
        if (results.length === 0) {
            return done(null, false, { message: 'Incorrect employee code.' });
        }
        const user = results[0];
        if (user.kyc_submitted) {
            return done(null, false, { message: 'Your KYC form has already been submitted and you are not allowed to log in.' });
        }
        if (password !== user.password) {
            return done(null, false, { message: 'Incorrect password.' });
        }
        console.log('Authenticated user:', user);
        return done(null, user);
    } catch (err) {
        console.error('Error retrieving user:', err);
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [results] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, results[0]);
    } catch (err) {
        console.error('Error deserializing user:', err);
        done(err);
    }
});

// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user && req.user.is_admin) {
        return next();
    }
    req.flash('error', 'You are not authorized to access this page.');
    res.redirect('/login');
}

// Routes
app.get('/login', (req, res) => {
    res.render('login', { message: req.flash('error') });
});

app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        if (req.user.is_admin) {
            res.redirect('/admin-dashboard');
        } else {
            res.redirect('/employee_kyc_detail');
        }
    } else {
        res.redirect('/login');
    }
});

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
}), (req, res) => {
    if (req.user.is_admin) {
        res.redirect('/admin-dashboard');
    } else {
        res.redirect('/employee_kyc_detail');
    }
});

app.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});

app.get('/employee_kyc_detail', (req, res) => {
    if (req.isAuthenticated()) {
        res.render('employee_kyc_detail');
    } else {
        res.redirect('/login');
    }
});

app.get('/user-details', async (req, res) => {
    const userId = req.user.id;
    try {
        const [result] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result[0]);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

app.post('/submit', async (req, res) => {
    const {
        employee_code, name, department, designation,
        date_of_joining, date_of_birth, pan_number, aadhar_number,
        uan_number, reporting_first, hod,
        nominee1, nominee1_birthdate, nominee1_percent,
        nominee2, nominee2_birthdate, nominee2_percent,
        nominee3, nominee3_birthdate, nominee3_percent,
        father_name, father_birthdate, mother_name, mother_birthdate,
        father_inlaw_name, father_inlaw_birthdate, mother_inlaw_name, mother_inlaw_birthdate,
        spouse_name, spouse_birthdate,
        children_name1, children_name1_birthdate, children_name2, children_name2_birthdate,
        children_name3, children_name3_birthdate, children_name4, children_name4_birthdate,
        children_name5, children_name5_birthdate,
        remarks
    } = req.body;

    const replaceEmptyWithNull = (value) => (value === '' ? null : value);

    const values = [
        employee_code, name, department, designation,
        date_of_joining, date_of_birth, pan_number, aadhar_number,
        uan_number, reporting_first, hod,
        nominee1, replaceEmptyWithNull(nominee1_birthdate), replaceEmptyWithNull(nominee1_percent),
        nominee2, replaceEmptyWithNull(nominee2_birthdate), replaceEmptyWithNull(nominee2_percent),
        nominee3, replaceEmptyWithNull(nominee3_birthdate), replaceEmptyWithNull(nominee3_percent),
        father_name, replaceEmptyWithNull(father_birthdate), mother_name, replaceEmptyWithNull(mother_birthdate),
        father_inlaw_name, replaceEmptyWithNull(father_inlaw_birthdate), mother_inlaw_name, replaceEmptyWithNull(mother_inlaw_birthdate),
        spouse_name, replaceEmptyWithNull(spouse_birthdate),
        children_name1, replaceEmptyWithNull(children_name1_birthdate), children_name2, replaceEmptyWithNull(children_name2_birthdate),
        children_name3, replaceEmptyWithNull(children_name3_birthdate), children_name4, replaceEmptyWithNull(children_name4_birthdate),
        children_name5, replaceEmptyWithNull(children_name5_birthdate),
        remarks
    ];

    const query = `
        INSERT INTO employee_kyc (
            employee_code, name, department, designation,
            date_of_joining, date_of_birth, pan_number, aadhar_number,
            uan_number, reporting_first, hod,
            nominee1, nominee1_birthdate, nominee1_percent,
            nominee2, nominee2_birthdate, nominee2_percent,
            nominee3, nominee3_birthdate, nominee3_percent,
            father_name, father_birthdate, mother_name, mother_birthdate,
            father_inlaw_name, father_inlaw_birthdate, mother_inlaw_name, mother_inlaw_birthdate,
            spouse_name, spouse_birthdate,
            children_name1, children_name1_birthdate, children_name2, children_name2_birthdate,
            children_name3, children_name3_birthdate, children_name4, children_name4_birthdate,
            children_name5, children_name5_birthdate,
            remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?)
    `;

    try {
        await pool.query(query, values);
        
        // Update the user's KYC status
        const updateQuery = 'UPDATE users SET kyc_submitted = TRUE WHERE employee_code = ?';
        await pool.query(updateQuery, [employee_code]);
        res.redirect('/thank-you.ejs');
    } catch (err) {
        console.error('Error updating KYC status:', err);
        res.status(500).json({ error: err });
    }
});

app.get('/admin-dashboard', isAdmin, async (req, res) => {
    try {
        const [results] = await pool.query('SELECT * FROM employee_kyc');
        res.render('admin-dashboard', { users: results });
    } catch (err) {
        console.error('Error retrieving data from database:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

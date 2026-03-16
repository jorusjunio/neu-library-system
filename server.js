require('dotenv').config();

// server.js — NEU Library Visitor Management System
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const db       = require('./database/db');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session  = require('express-session');

const app  = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());

// ─── SESSION & PASSPORT SETUP ────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'neu-library-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;

  if (!email.endsWith('@neu.edu.ph')) {
    return done(null, false, { message: 'Only NEU email accounts are allowed.' });
  }

  try {
    const [rows] = await db.pool.query(
      'SELECT * FROM user_roles WHERE email = ?', [email]
    );

    // Only allow pre-approved emails
    if (!rows[0]) return done(null, false, { message: 'Access denied.' });

    // Update Google info
    await db.pool.query(`
      UPDATE user_roles SET google_id = ?, name = ?, picture = ? WHERE email = ?
    `, [profile.id, profile.displayName, profile.photos?.[0]?.value, email]);

    const user = rows[0];
    return done(null, {
      email:      user.email,
      name:       user.name,
      picture:    user.picture,
      role:       user.role,
      activeRole: user.role
    });
  } catch (err) {
    return done(err);
  }
}));

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.activeRole === 'admin') return next();
  return next();
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/entrance/index.html?error=noaccess', failureMessage: true }),
  (req, res) => {
    if (req.user.activeRole === 'admin') return res.redirect('/admin');
    res.redirect('/entrance/index.html');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/entrance/index.html');
    });
  });
});

app.post('/api/switch-role', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });

  const newRole = req.user.activeRole === 'admin' ? 'user' : 'admin';
  req.user.activeRole = newRole;
  req.session.passport.user.activeRole = newRole;

  res.json({ activeRole: newRole });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.user);
});

// ─── STATIC FILES ─────────────────────────────────────────────────────────────
app.use('/entrance', express.static(path.join(__dirname, 'entrance')));
app.use('/admin',    express.static(path.join(__dirname, 'admin')));
app.use('/images',   express.static(path.join(__dirname, 'images')));

// ─── SSE — Real-time broadcast ────────────────────────────────────────────────
let adminClients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 30000);
  adminClients.push(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    adminClients = adminClients.filter(c => c !== res);
  });
});

function broadcastNewVisit(data) {
  const payload = `event: new-visit\ndata: ${JSON.stringify(data)}\n\n`;
  adminClients.forEach(client => client.write(payload));
}

// ─── ENTRANCE ─────────────────────────────────────────────────────────────────
app.get('/api/student/email/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    if (!email.endsWith('@neu.edu.ph'))
      return res.status(400).json({ error: 'Please use your NEU institutional email (@neu.edu.ph).' });
    const student = await db.getStudentByEmail(email);
    if (!student) return res.status(404).json({ error: 'Email not found. Please see the librarian.' });
    if (student.is_blocked) return res.status(403).json({ error: 'Your access has been blocked. Please see the librarian.' });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/student/:id', async (req, res) => {
  try {
    const student = await db.getStudentById(req.params.id.toUpperCase());
    if (!student) return res.status(404).json({ error: 'Student not found. Please see the librarian.' });
    if (student.is_blocked) return res.status(403).json({ error: 'Your access has been blocked. Please see the librarian.' });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/visit', async (req, res) => {
  const { school_id, purpose } = req.body;
  if (!school_id || !purpose)
    return res.status(400).json({ error: 'school_id and purpose are required.' });
  try {
    const student = await db.getStudentById(school_id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (student.is_blocked) return res.status(403).json({ error: 'Your access has been blocked. Please see the librarian.' });

    const visitId = await db.recordVisit(school_id, purpose);
    const { isFirstVisit, streak } = await db.updateStudentVisitStats(school_id);
    const updated = await db.getStudentById(school_id);

    broadcastNewVisit({
      id: visitId, school_id,
      name: updated.name, college: updated.college, type: updated.type,
      purpose,
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: new Date().toTimeString().split(' ')[0],
      streak,
    });

    res.json({ success: true, visitId, student: updated, isFirstVisit, streak });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN — STATS & LOGS ─────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end required.' });
  try { res.json(await db.getStatsByRange(start, end)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// NEW: Filtered stats for admin dashboard cards
app.get('/api/stats/filtered', requireAdmin, async (req, res) => {
  const { period, start, end, purpose, college, employee_type } = req.query;

  let dateFilter = '';
  const params = [];

  if (period === 'today') {
    dateFilter = 'AND DATE(v.visit_date) = CURDATE()';
  } else if (period === 'week') {
    dateFilter = 'AND v.visit_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
  } else if (start && end) {
    dateFilter = 'AND v.visit_date BETWEEN ? AND ?';
    params.push(start, end);
  }

  const buildParams = (extras = []) => [...params, ...extras];

  let purposeFilter   = purpose       ? 'AND v.purpose = ?'                              : '';
  let collegeFilter   = college       ? 'AND s.college = ?'                              : '';
  let employeeFilter  = employee_type === 'employee'
    ? "AND s.type IN ('Faculty','Employee','Staff')"
    : employee_type === 'student'
    ? "AND s.type = 'Student'"
    : '';

  const allFilters = `${dateFilter} ${purposeFilter} ${collegeFilter} ${employeeFilter}`;

  const fullParams = [
    ...params,
    ...(purpose ? [purpose] : []),
    ...(college ? [college] : []),
  ];

  try {
    const [totalVisits] = await db.pool.query(
      `SELECT COUNT(*) as count FROM visits v
       JOIN students s ON v.school_id = s.school_id
       WHERE 1=1 ${allFilters}`, fullParams
    );

    const [byPurpose] = await db.pool.query(
      `SELECT v.purpose, COUNT(*) as count FROM visits v
       JOIN students s ON v.school_id = s.school_id
       WHERE 1=1 ${dateFilter} ${collegeFilter} ${employeeFilter}
       GROUP BY v.purpose ORDER BY count DESC`,
      buildParams([...(college ? [college] : [])])
    );

    const [byCollege] = await db.pool.query(
      `SELECT s.college, COUNT(*) as count FROM visits v
       JOIN students s ON v.school_id = s.school_id
       WHERE 1=1 ${dateFilter} ${purposeFilter} ${employeeFilter}
       GROUP BY s.college ORDER BY count DESC LIMIT 10`,
      buildParams([...(purpose ? [purpose] : [])])
    );

    const [byDay] = await db.pool.query(
      `SELECT DATE(v.visit_date) as date, COUNT(*) as count FROM visits v
       JOIN students s ON v.school_id = s.school_id
       WHERE 1=1 ${allFilters}
       GROUP BY DATE(v.visit_date) ORDER BY date ASC`, fullParams
    );

    const [empVsStudent] = await db.pool.query(
      `SELECT
         SUM(CASE WHEN s.type IN ('Faculty','Employee','Staff') THEN 1 ELSE 0 END) as employees,
         SUM(CASE WHEN s.type = 'Student' THEN 1 ELSE 0 END) as students
       FROM visits v
       JOIN students s ON v.school_id = s.school_id
       WHERE 1=1 ${dateFilter} ${purposeFilter} ${collegeFilter}`,
      buildParams([...(purpose ? [purpose] : []), ...(college ? [college] : [])])
    );

    res.json({
      totalVisits:     totalVisits[0].count,
      byPurpose,
      byCollege,
      byDay,
      employeeVsStudent: empVsStudent[0]
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/logs', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit)  || 50;
    const offset = parseInt(req.query.offset) || 0;
    res.json(await db.getRecentLogs(limit, offset));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/top-visitors', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    res.json(await db.getTopVisitors(req.query.start || today, req.query.end || today));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/students', async (req, res) => {
  try { res.json(await db.getAllStudents()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN — AUTH ─────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required.' });
  try {
    const admin = await db.verifyAdmin(username, password);
    if (!admin) return res.status(401).json({ error: 'Invalid username or password.' });
      req.session.adminLoggedIn = true;
      req.session.adminName = admin.full_name;
      res.json({ success: true, name: admin.full_name, username: admin.username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/change-password', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) return res.status(400).json({ error: 'Missing fields.' });
  try {
    const [result] = await db.pool.query(
      'UPDATE admin_users SET password = SHA2(?, 256) WHERE username = ?',
      [newPassword, username.toLowerCase()]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Admin not found.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/add', async (req, res) => {
  const { username, full_name, password } = req.body;
  if (!username || !full_name || !password) return res.status(400).json({ error: 'Missing fields.' });
  try {
    await db.pool.query(
      'INSERT INTO admin_users (username, full_name, password) VALUES (?, ?, SHA2(?, 256))',
      [username.toLowerCase(), full_name, password]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username already exists.' });
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN — BLOCK / UNBLOCK ──────────────────────────────────────────────────
app.post('/api/student/:id/block', async (req, res) => {
  try {
    await db.setStudentBlocked(req.params.id.toUpperCase(), !!req.body.block);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN — ANNOUNCEMENT ─────────────────────────────────────────────────────
let announcement = { text: '', enabled: false };
app.get('/api/announcement',  (req, res) => res.json(announcement));
app.post('/api/announcement', (req, res) => {
  announcement = { text: req.body.text || '', enabled: !!req.body.enabled };
  res.json({ success: true });
});

// ─── ADMIN — DATA MANAGEMENT ──────────────────────────────────────────────────
app.post('/api/data/clear-logs', async (req, res) => {
  try {
    const queries = {
      all:   'DELETE FROM visits',
      month: 'DELETE FROM visits WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 1 MONTH)',
      old:   'DELETE FROM visits WHERE visit_date < DATE_SUB(CURDATE(), INTERVAL 1 YEAR)',
    };
    const q = queries[req.body.type] || queries.old;
    const [result] = await db.pool.query(q);
    res.json({ success: true, deleted: result.affectedRows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/data/reset-streaks', async (req, res) => {
  try {
    await db.pool.query('UPDATE students SET current_streak = 0');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PAGE ROUTES ──────────────────────────────────────────────────────────────
app.get('/',      (req, res) => res.redirect('/entrance/index.html'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'dashboard.html')));

app.listen(PORT, () => {
  console.log(`\n🏛️  NEU Library System running at http://localhost:${PORT}`);
  console.log(`📋  Entrance: http://localhost:${PORT}/entrance`);
  console.log(`📊  Admin:    http://localhost:${PORT}/admin\n`);
});
// database/db.js
const mysql = require('mysql2/promise');

// ─── CONFIG — change password to yours! ──────────────────────────────────────
const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'neu_library',
  port:             process.env.DB_PORT     || 3306,
  waitForConnections: true,
  connectionLimit:    10,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ─── TEST CONNECTION ─────────────────────────────────────────────────────────
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected successfully!');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check your password and make sure MySQL is running.');
    process.exit(1);
  }
}
testConnection();

// ─── STUDENT FUNCTIONS ────────────────────────────────────────────────────────

async function getStudentById(schoolId) {
  const [rows] = await pool.query(
    'SELECT * FROM students WHERE school_id = ?',
    [schoolId.toUpperCase()]
  );
  return rows[0] || null;
}


async function getStudentByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM students WHERE LOWER(email) = LOWER(?)',
    [email.trim()]
  );
  return rows[0] || null;
}

async function updateStudentVisitStats(schoolId) {
  const student = await getStudentById(schoolId);
  if (!student) return null;

  const today      = todayStr();
  const isFirstVisit = !student.first_visit_date;
  const lastVisit  = student.last_visit_date
    ? student.last_visit_date.toISOString().split('T')[0]
    : null;

  let newStreak = student.current_streak || 0;

  if (!lastVisit) {
    newStreak = 1;
  } else {
    const diffDays = dateDiff(lastVisit, today);
    if (diffDays === 0) {
      // Same day — no change
    } else if (diffDays === 1) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  }

  const newLongest = Math.max(student.longest_streak || 0, newStreak);

  await pool.query(
    `UPDATE students SET
      first_visit_date = COALESCE(first_visit_date, ?),
      total_visits     = total_visits + 1,
      current_streak   = ?,
      longest_streak   = ?,
      last_visit_date  = ?
     WHERE school_id = ?`,
    [today, newStreak, newLongest, today, schoolId]
  );

  return { isFirstVisit, streak: newStreak };
}

// ─── VISIT FUNCTIONS ──────────────────────────────────────────────────────────

async function recordVisit(schoolId, purpose) {
  const now  = new Date();
  const visitDate = todayStr();
  const visitTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila' });

  const [result] = await pool.query(
    'INSERT INTO visits (school_id, purpose, visit_date, visit_time) VALUES (?, ?, ?, ?)',
    [schoolId, purpose, visitDate, visitTime]
  );
  return result.insertId;
}

// ─── STATS FUNCTIONS ──────────────────────────────────────────────────────────

async function getStatsByRange(startDate, endDate) {
  const [[{ totalVisits }]] = await pool.query(
    'SELECT COUNT(*) AS totalVisits FROM visits WHERE visit_date BETWEEN ? AND ?',
    [startDate, endDate]
  );

  const [[{ uniqueVisitors }]] = await pool.query(
    'SELECT COUNT(DISTINCT school_id) AS uniqueVisitors FROM visits WHERE visit_date BETWEEN ? AND ?',
    [startDate, endDate]
  );

  const [byPurpose] = await pool.query(
    `SELECT purpose, COUNT(*) AS count FROM visits
     WHERE visit_date BETWEEN ? AND ?
     GROUP BY purpose ORDER BY count DESC`,
    [startDate, endDate]
  );

  const [byCollege] = await pool.query(
    `SELECT s.college, COUNT(*) AS count FROM visits v
     JOIN students s ON v.school_id = s.school_id
     WHERE v.visit_date BETWEEN ? AND ?
     GROUP BY s.college ORDER BY count DESC`,
    [startDate, endDate]
  );

  const [byDay] = await pool.query(
    `SELECT visit_date, COUNT(*) AS count FROM visits
     WHERE visit_date BETWEEN ? AND ?
     GROUP BY visit_date ORDER BY visit_date ASC`,
    [startDate, endDate]
  );

  const [byHour] = await pool.query(
    `SELECT LPAD(HOUR(visit_time), 2, '0') AS hour, COUNT(*) AS count FROM visits
     WHERE visit_date BETWEEN ? AND ?
     GROUP BY hour ORDER BY hour ASC`,
    [startDate, endDate]
  );

  // Format dates for JSON
  const byDayFormatted = byDay.map(r => ({
    ...r,
    visit_date: r.visit_date instanceof Date
      ? r.visit_date.toISOString().split('T')[0]
      : r.visit_date,
  }));

  return { totalVisits, uniqueVisitors, byPurpose, byCollege, byDay: byDayFormatted, byHour };
}

async function getRecentLogs(limit = 50, offset = 0) {
  const [rows] = await pool.query(
    `SELECT v.id, v.school_id, v.purpose,
            DATE_FORMAT(v.visit_date, '%Y-%m-%d') AS visit_date,
            TIME_FORMAT(v.visit_time, '%H:%i:%s') AS visit_time,
            v.created_at,
            s.name, s.college, s.type
     FROM visits v
     JOIN students s ON v.school_id = s.school_id
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

async function getTopVisitors(startDate, endDate, limit = 10) {
  const [rows] = await pool.query(
    `SELECT s.name, s.college, s.type, s.current_streak,
            COUNT(v.id) AS visit_count
     FROM visits v
     JOIN students s ON v.school_id = s.school_id
     WHERE v.visit_date BETWEEN ? AND ?
     GROUP BY v.school_id
     ORDER BY visit_count DESC
     LIMIT ?`,
    [startDate, endDate, limit]
  );
  return rows;
}


// ─── ADMIN FUNCTIONS ──────────────────────────────────────────────────────────

async function getAdminByUsername(username) {
  const [rows] = await pool.query(
    'SELECT * FROM admin_users WHERE username = ?',
    [username.toLowerCase().trim()]
  );
  return rows[0] || null;
}

async function verifyAdmin(username, password) {
  const crypto = require('crypto');
  const hashed = crypto.createHash('sha256').update(password).digest('hex');
  const [rows] = await pool.query(
    'SELECT * FROM admin_users WHERE username = ? AND password = ?',
    [username.toLowerCase().trim(), hashed]
  );
  return rows[0] || null;
}


async function getAllStudents() {
  const [rows] = await pool.query('SELECT * FROM students ORDER BY name ASC');
  return rows;
}

async function setStudentBlocked(schoolId, block) {
  await pool.query('UPDATE students SET is_blocked = ? WHERE school_id = ?', [block ? 1 : 0, schoolId]);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

function dateDiff(dateA, dateB) {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

module.exports = {
  getStudentById,
  getStudentByEmail,
  updateStudentVisitStats,
  recordVisit,
  getStatsByRange,
  getRecentLogs,
  getTopVisitors,
  verifyAdmin,
  getAllStudents,
  setStudentBlocked,
  pool,
};

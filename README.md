# 🏛️ NEU Library Visitor Management System

A full-stack library visitor management system for New Era University with RFID support, Google OAuth authentication, role-based access control, gamification, real-time admin dashboard, and cloud-based MySQL database.

---

## 🌐 Live Demo

| Page | URL |
|---|---|
| Entrance Portal | https://neu-library-system.onrender.com |
| Admin Dashboard | https://neu-library-system.onrender.com/admin |

---

## 📁 Project Structure

```
neu-library-system/
│
├── entrance/
│   ├── index.html          ← Entrance screen (RFID terminal + Admin login)
│   ├── css/style.css       ← Entrance screen styles
│   └── js/app.js           ← Entrance screen logic
│
├── admin/
│   ├── dashboard.html      ← Admin dashboard
│   ├── css/admin.css       ← Dashboard styles
│   └── js/admin.js         ← Dashboard charts & data
│
├── database/
│   └── db.js               ← MySQL database module
│
├── server.js               ← Node.js + Express backend
├── package.json
└── README.md
```

---

## 🚀 Setup & Run (Local)

### 1. Install Dependencies

```bash
cd neu-library-system
npm install
```

### 2. Set Environment Variables

Create a `.env` file in the root directory:

```
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_PORT=3306
DB_SSL=true

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=your_session_secret
```

### 3. Set Up Database

Run the following SQL to create the required tables:

```sql
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `google_id` VARCHAR(100),
  `name` VARCHAR(100),
  `picture` VARCHAR(255),
  `role` ENUM('user', 'admin') DEFAULT 'user',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-authorize admin account
INSERT INTO `user_roles` (email, role)
VALUES ('jcesperanza@neu.edu.ph', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin';
```

### 4. Start the Server

```bash
npm start
# or for auto-reload during dev:
npm run dev
```

### 5. Open the App

- **Entrance Screen:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin

---

## ✅ Features

### Entrance Screen (`/`)
- 🎴 **RFID Scan** — Type or scan NEU School ID (HID RFID readers work as keyboards)
- 📧 **Email Login** — Alternative login using NEU institutional email (@neu.edu.ph)
- 🎉 **First Time Visitor Detection** — Special welcome badge on first visit
- 🔥 **Visit Streak Gamification** — Consecutive-day streak counter
- 🌌 **Animated Background** — Particle canvas animation
- ⏰ **Live Clock** — Real-time date and time display
- 📋 **Purpose Selection** — Reading Books, Thesis Research, Use of Computer, Doing Assignments
- ✅ **Success Animation** — Confirmation screen with auto-reset
- 🚫 **Blocked Account Notice** — Blocked students are notified to see the librarian

### Admin Access
- 🔐 **Dual Authentication** — Sign in via username/password OR Google account
- 🌐 **Google OAuth 2.0** — Secure login using NEU institutional Google account
- 👥 **Role-Based Access Control** — Whitelist-based admin access via `user_roles` table
- 🔄 **Account Switcher** — Force Google account picker to switch between accounts
- 🚪 **Secure Logout** — Session destroy with cookie clearing

### Admin Dashboard (`/admin`)
- 📡 **Real-time Feed** — Live visit updates via Server-Sent Events (SSE)
- 📊 **Visits Per Day** — Bar chart with date-range support
- 🍩 **Purpose Breakdown** — Doughnut chart
- 📈 **Visits by Hour** — Line chart showing peak hours
- 🏛️ **Top Colleges** — Horizontal bar chart
- 📋 **Visitor Logs** — Searchable, paginated table of all entries
- 🏆 **Top Visitors** — Ranked leaderboard with streaks
- 🗓️ **Date Filters** — Today, This Week, This Month, Custom Range
- 🚫 **Block / Unblock Students** — Manage student access
- 📢 **Announcements** — Toggle announcements on the entrance page
- 🗑️ **Data Management** — Clear visit logs and reset streaks

---

## 🗄️ Database Schema

### `students` table

| Column | Type | Description |
|---|---|---|
| school_id | VARCHAR(20) PK | e.g. 26-00123-001 |
| name | VARCHAR(100) | Full name |
| college | VARCHAR(100) | College or office |
| type | VARCHAR(20) | Student / Faculty / Employee |
| email | VARCHAR(100) | NEU institutional email |
| is_blocked | TINYINT(1) | Block status (0=active, 1=blocked) |
| first_visit_date | DATE | Date of first visit |
| last_visit_date | DATE | Date of most recent visit |
| total_visits | INT | Lifetime visit count |
| current_streak | INT | Consecutive-day streak |
| longest_streak | INT | Best streak ever |

### `visits` table

| Column | Type | Description |
|---|---|---|
| id | INT PK | Auto-increment |
| school_id | VARCHAR(20) FK | References students |
| purpose | VARCHAR(100) | Reason for visit |
| visit_date | DATE | YYYY-MM-DD |
| visit_time | TIME | HH:MM:SS |
| created_at | TIMESTAMP | Full datetime |

### `admin_users` table

| Column | Type | Description |
|---|---|---|
| id | INT PK | Auto-increment |
| username | VARCHAR(50) | Login username |
| password | VARCHAR(255) | SHA-256 hashed password |
| full_name | VARCHAR(100) | Full name of admin |
| created_at | TIMESTAMP | Account creation timestamp |

### `user_roles` table

| Column | Type | Description |
|---|---|---|
| id | INT PK | Auto-increment |
| email | VARCHAR(100) | NEU institutional email (unique) |
| google_id | VARCHAR(100) | Google account ID |
| name | VARCHAR(100) | Full name from Google |
| picture | VARCHAR(255) | Profile picture URL |
| role | ENUM | 'user' or 'admin' |
| created_at | TIMESTAMP | Account creation timestamp |

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/student/:id` | Look up student by School ID |
| GET | `/api/student/email/:email` | Look up student by NEU email |
| POST | `/api/visit` | Record a new visit |
| GET | `/api/stats?start=&end=` | Get statistics for date range |
| GET | `/api/logs?limit=&offset=` | Get paginated visitor logs |
| GET | `/api/top-visitors?start=&end=` | Get ranked visitor list |
| GET | `/api/students` | Get all students |
| POST | `/api/admin/login` | Admin authentication (username/password) |
| POST | `/api/admin/change-password` | Change admin password |
| POST | `/api/admin/add` | Add new admin user |
| POST | `/api/student/:id/block` | Block or unblock a student |
| GET | `/api/announcement` | Get current announcement |
| POST | `/api/announcement` | Update announcement |
| POST | `/api/data/clear-logs` | Clear visit logs |
| POST | `/api/data/reset-streaks` | Reset all student streaks |
| GET | `/api/events` | SSE stream for real-time updates |
| GET | `/auth/google` | Initiate Google OAuth login |
| GET | `/auth/google/callback` | Google OAuth callback |
| GET | `/logout` | Logout and destroy session |
| GET | `/api/me` | Get current logged-in user info |

---

## 🔐 Authentication & Authorization

This system supports two methods of admin authentication:

1. **Username & Password** — Traditional login via admin modal
2. **Google OAuth 2.0** — Sign in with NEU institutional Google account

Access is controlled via a whitelist in the `user_roles` database table. Only pre-approved emails can log in. To grant access to a new user:

```sql
-- Add admin
INSERT INTO user_roles (email, role) VALUES ('email@neu.edu.ph', 'admin');

-- Add regular user
INSERT INTO user_roles (email, role) VALUES ('email@neu.edu.ph', 'user');
```

---

## 🔌 RFID Integration

The entrance screen uses a plain text `<input>` field that auto-focuses on load. HID USB RFID readers act as keyboards and will automatically type the card's ID and press Enter. The app listens for the `Enter` keypress to trigger the scan.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (custom properties + animations), Vanilla JavaScript, Chart.js
- **Backend:** Node.js, Express.js
- **Database:** MySQL (hosted on TiDB Cloud)
- **Authentication:** Google OAuth 2.0 (Passport.js), express-session
- **Real-time:** Server-Sent Events (SSE)
- **Deployment:** Render.com

---

## 📌 Sample School IDs (for testing)

```
26-00123-001  → Jorus Junio (CICS Student)
24-00456-002  → Andrea Reyes (Nursing Student)
23-00789-003  → Lourd Allen Amante (Engineering Student)
25-00321-004  → Camille Dela Cruz (CBA Student)
22-00654-005  → Alexis Castro (Arts & Sciences Student)
24-00987-006  → Trisha Bautista (Education Student)
23-00147-007  → John Patrick Hawac (CICS Student)
25-00258-008  → Nicole Villanueva (Nursing Student)
22-00369-009  → Paolo Ramos (Engineering Student)
FAC-2024-001  → Prof. Maria Gonzales (CICS Faculty)
FAC-2024-002  → Prof. Jose Fernandez (CBA Faculty)
```

---

## 👤 Developer

**Jorus Junio** — 2BSIT-3, College of Informatics and Computing Studies, New Era University

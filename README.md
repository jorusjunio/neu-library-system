# 🏛️ NEU Library Visitor Management System

A full-stack library visitor management system for New Era University with RFID support, gamification, real-time admin dashboard, and cloud-based MySQL database.

---

## 📁 Project Structure

```
neu-library-system/
│
├── entrance/
│   ├── index.html          ← Entrance screen (RFID terminal)
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
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=neu_library
DB_PORT=3306
DB_SSL=false
```

### 3. Start the Server
```bash
npm start
# or for auto-reload during dev:
npm run dev
```

### 4. Open the App
- **Entrance Screen:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin

---

## 🌐 Live Demo

| Page | URL |
|---|---|
| Entrance Portal | https://neu-library-system-production.up.railway.app |
| Admin Dashboard | https://neu-library-system-production.up.railway.app/admin |

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

### Admin Dashboard (`/admin`)
- 🔐 **Secure Login** — SHA-256 hashed admin authentication
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
| POST | `/api/admin/login` | Admin authentication |
| POST | `/api/admin/change-password` | Change admin password |
| POST | `/api/admin/add` | Add new admin user |
| POST | `/api/student/:id/block` | Block or unblock a student |
| GET | `/api/announcement` | Get current announcement |
| POST | `/api/announcement` | Update announcement |
| POST | `/api/data/clear-logs` | Clear visit logs |
| POST | `/api/data/reset-streaks` | Reset all student streaks |
| GET | `/api/events` | SSE stream for real-time updates |

---

## 🔌 RFID Integration

The entrance screen uses a plain text `<input>` field that auto-focuses on load. HID USB RFID readers act as keyboards and will automatically type the card's ID and press Enter. The app listens for the `Enter` keypress to trigger the scan.

---

## 🛠️ Tech Stack
- **Frontend:** HTML5, CSS3 (custom properties + animations), Vanilla JavaScript, Chart.js
- **Backend:** Node.js, Express.js
- **Database:** MySQL (hosted on Railway)
- **Real-time:** Server-Sent Events (SSE)
- **Deployment:** Railway.app

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

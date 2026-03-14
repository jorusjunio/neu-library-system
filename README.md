# 🏛️ NEU Library Visitor Log System

A full-stack library visitor management system for New Era University with RFID support, gamification, and an admin analytics dashboard.

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
│   └── db.js               ← SQLite database module
│
├── server.js               ← Node.js + Express backend
├── package.json
└── README.md
```

---

## 🚀 Setup & Run

### 1. Install Dependencies
```bash
cd neu-library-system
npm install
```

### 2. Start the Server
```bash
npm start
# or for auto-reload during dev:
npm run dev
```

### 3. Open the App
- **Entrance Screen:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin

---

## ✅ Features

### Entrance Screen (`/`)
- 🎴 **RFID Scan** — Type or scan NEU School ID (HID RFID readers work as keyboards)
- 🎉 **First Time Visitor Detection** — Special welcome badge on first visit
- 🔥 **Visit Streak Gamification** — Consecutive-day streak counter
- 🌌 **Animated Background** — Particle canvas animation
- ⏰ **Live Clock** — Real-time date and time display
- 📋 **Purpose Selection** — Reading Books, Thesis Research, Use of Computer, Doing Assignments
- ✅ **Success Animation** — Confirmation screen with auto-reset

### Admin Dashboard (`/admin`)
- 📊 **Visits Per Day** — Bar chart with date-range support
- 🍩 **Purpose Breakdown** — Doughnut chart
- 📈 **Visits by Hour** — Line chart showing peak hours
- 🏛️ **Top Colleges** — Horizontal bar chart
- 📋 **Visitor Logs** — Searchable table with all entries
- 🏆 **Top Visitors** — Ranked leaderboard with streaks
- 🗓️ **Date Filters** — Today, This Week, This Month, Custom Range

---

## 🗄️ Database Schema

### `students` table
| Column | Type | Description |
|---|---|---|
| school_id | TEXT PK | e.g. 2021-00001 |
| name | TEXT | Full name |
| college | TEXT | College or office |
| type | TEXT | Student / Faculty / Employee |
| first_visit_date | TEXT | ISO date of first visit |
| total_visits | INTEGER | Lifetime visit count |
| current_streak | INTEGER | Consecutive-day streak |
| longest_streak | INTEGER | Best streak ever |
| last_visit_date | TEXT | Last visit ISO date |

### `visits` table
| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| school_id | TEXT FK | References students |
| purpose | TEXT | Reason for visit |
| visit_date | TEXT | YYYY-MM-DD |
| visit_time | TEXT | HH:MM:SS |
| created_at | TEXT | Full datetime |

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/student/:id` | Look up student by School ID |
| POST | `/api/visit` | Record a new visit |
| GET | `/api/stats?start=&end=` | Get statistics for date range |
| GET | `/api/logs?limit=&offset=` | Get paginated visitor logs |
| GET | `/api/top-visitors?start=&end=` | Get ranked visitor list |

---

## 🔌 RFID Integration

The entrance screen uses a plain text `<input>` field that auto-focuses on load. HID USB RFID readers act as keyboards and will automatically type the card's ID and press Enter. The app listens for the `Enter` keypress to trigger the scan.

---

## 🛠️ Tech Stack
- **Frontend:** HTML5, CSS3 (custom properties + animations), Vanilla JavaScript, Chart.js
- **Backend:** Node.js, Express
- **Database:** SQLite (via `better-sqlite3`)

---

## 📌 Demo School IDs (pre-seeded)
```
2021-00001  → Juan dela Cruz (CCS Student)
2021-00002  → Maria Santos (Nursing Student) ← First-time visitor
2020-00003  → Pedro Reyes (Engineering Student, 7-day streak)
FAC-0001    → Prof. Roberto Cruz (Faculty)
EMP-0001    → Ms. Ligaya Flores (Employee)
2022-00005  → Carlos Mendoza (Arts & Sciences)
2023-00006  → Sofia Bautista (Education)
```

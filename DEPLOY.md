# NEU Library Deployment Guide

## Tech Stack
- **Backend Hosting:** Render.com
- **Database:** TiDB Cloud (MySQL-compatible)
- **Auth:** Google OAuth 2.0

---

## 1. Set Up TiDB Cloud (Database)

1. Go to [tidbcloud.com](https://tidbcloud.com) → Sign up / Log in
2. Create a new **Serverless** cluster
3. Once created, go to **Connect** → copy the connection details:
   - Host
   - Username
   - Password
   - Port
4. Connect via **MySQL Workbench** and run the following SQL:

```sql
-- Visitor log tables (students, visits, admin_users)
-- Run your existing schema SQL files first, then:

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
VALUES ('your-admin-email@neu.edu.ph', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin';
```

---

## 2. Set Up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project → **APIs & Services → OAuth Consent Screen**
   - User Type: **External**
   - Add test users as needed
3. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     ```
     http://localhost:3000/auth/google/callback
     https://your-app.onrender.com/auth/google/callback
     ```
4. Copy the **Client ID** and **Client Secret**

---

## 3. Deploy on Render

1. Go to [render.com](https://render.com) → Log in with GitHub
2. Click **New** → **Web Service**
3. Connect your **neu-library-system** GitHub repository
4. Configure:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`

5. Go to **Environment** tab → Add the following variables:

```
DB_HOST         = (TiDB Host)
DB_USER         = (TiDB Username)
DB_PASSWORD     = (TiDB Password)
DB_NAME         = (TiDB Database Name)
DB_PORT         = 4000
DB_SSL          = true

GOOGLE_CLIENT_ID     = (from Google Cloud Console)
GOOGLE_CLIENT_SECRET = (from Google Cloud Console)
GOOGLE_CALLBACK_URL  = https://your-app.onrender.com/auth/google/callback
SESSION_SECRET       = your-random-secret-string
```

6. Click **Create Web Service** → Wait for deploy to finish

---

## 4. Done!

Your app will be live at:
```
https://your-app.onrender.com
```

| Page | URL |
|---|---|
| Entrance Portal | https://your-app.onrender.com |
| Admin Dashboard | https://your-app.onrender.com/admin |

> **Note:** Free tier on Render spins down after inactivity — first request may take ~50 seconds to wake up.

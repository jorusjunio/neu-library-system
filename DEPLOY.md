# NEU Library Deployment Guide

## Railway Deployment Steps

### 1. Create GitHub Repository
1. Go to github.com → New repository → "neu-library-system"
2. Upload all your project files

### 2. Deploy on Railway
1. Go to railway.app → Login with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your "neu-library-system" repo

### 3. Add MySQL Database
1. In your Railway project → "New" → "Database" → "MySQL"
2. Railway will auto-create the database

### 4. Set Environment Variables
In Railway → your app → "Variables", add:
```
DB_HOST     = (from Railway MySQL "Connect" tab → Host)
DB_USER     = (from Railway MySQL "Connect" tab → Username)
DB_PASSWORD = (from Railway MySQL "Connect" tab → Password)
DB_NAME     = (from Railway MySQL "Connect" tab → Database)
DB_PORT     = (from Railway MySQL "Connect" tab → Port)
DB_SSL      = true
```

### 5. Run SQL Scripts
1. In Railway MySQL → "Connect" → copy the connection string
2. Use MySQL Workbench to connect with Railway's credentials
3. Run your SQL scripts:
   - add_email_column.sql
   - add_admin_users.sql
   - add_blocked_column.sql

### 6. Done!
Railway will give you a public URL like:
https://neu-library-system.up.railway.app

Share this link with everyone! ✅

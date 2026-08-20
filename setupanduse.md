# 🛠️ Setup & Usage Guide — School Student & Fee Management System

> **For:** Developers, QA, or anyone who wants to run the project locally  
> **Current State:** **Day 10 Complete** — Full system with Auth, Settings, Students, Payments, Receipts, Messages, Reports, Backup & Security

---

## 📋 Prerequisites

Before starting, ensure you have these installed:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 18.x or higher | [nodejs.org](https://nodejs.org/) |
| **MySQL Server** | 8.0 or higher | [mysql.com](https://dev.mysql.com/downloads/mysql/) |
| **npm** | 9.x or higher | Comes with Node.js |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

**Verify Installation:**
```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
mysql --version   # Should show 8.0.x or higher
```

---

## 🚀 Quick Start (3 Steps)

### Step 1: Clone & Navigate
```bash
git clone <repository-url>
cd SchoolManagementWebApp
```

### Step 2: Configure Environment
```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials (see below)
```

### Step 3: Initialize Database & Start Servers
```bash
# Terminal 1: Backend (from /backend folder)
npm install
node src/config/initDb.js    # Creates DB, tables, seed data
npm run dev                  # Starts at http://localhost:5000

# Terminal 2: Frontend (from /frontend folder)
cd ../frontend
npm install
npm run dev                  # Starts at http://localhost:3000
```

---

## ⚙️ Detailed Configuration

### Backend `.env` File (Required)

Edit `backend/.env` with your actual values:

```env
# ============================================================
# SCHOOL MANAGEMENT SYSTEM — Backend Configuration
# ============================================================

# --- Server ---
PORT=5000
NODE_ENV=development

# --- Frontend URL (for CORS) ---
CLIENT_URL=http://localhost:3000

# --- MySQL Database (REQUIRED - update these!) ---
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_root_password_here
DB_NAME=school_management_db
DB_CONNECTION_LIMIT=10

# --- JWT Authentication (generate a secure random string!) ---
# Run: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
JWT_SECRET=your_super_long_random_secret_key_here_min_32_chars
JWT_EXPIRES_IN=7d

# --- Messaging (Day 16+) - Use 'mock' for development ---
SMS_MODE=mock
SMS_PROVIDER_API_KEY=
SMS_PROVIDER_SENDER_ID=

WHATSAPP_MODE=mock
WHATSAPP_API_TOKEN=
WHATSAPP_BUSINESS_PHONE_ID=

# --- File Storage ---
RECEIPTS_DIR=./data/receipts
BACKUP_DIR=./data/backups
```

**Critical:** You **must** set `DB_PASSWORD` and `JWT_SECRET`. The app will not work without them.

### Generate a Secure JWT Secret
```bash
# Run this in terminal and copy the output to JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

---

## 🗄️ Database Setup Options

### Option A: Automatic (Recommended)
```bash
cd backend
node src/config/initDb.js
```
This script:
1. Creates database `school_management_db` if not exists
2. Runs all 16 table definitions from `schema.sql`
3. Inserts all seed data from `seeders.sql`
4. Reports success/failure for each statement

### Option B: Manual MySQL Commands
If you prefer manual control:
```bash
# 1. Create database
mysql -u root -p -e "CREATE DATABASE school_management_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Run schema
mysql -u root -p school_management_db < database/schema.sql

# 3. Run seeders
mysql -u root -p school_management_db < database/seeders.sql
```

### Verify Database
```bash
mysql -u root -p school_management_db -e "
SELECT 'users' as table_name, COUNT(*) as rows FROM users
UNION SELECT 'classes', COUNT(*) FROM classes
UNION SELECT 'sections', COUNT(*) FROM sections
UNION SELECT 'fee_structures', COUNT(*) FROM fee_structures
UNION SELECT 'fee_types', COUNT(*) FROM fee_types
UNION SELECT 'students', COUNT(*) FROM students
UNION SELECT 'message_templates', COUNT(*) FROM message_templates;
"
```

Expected output:
```
+--------------------+------+
| table_name         | rows |
+--------------------+------+
| users              |    1 |
| classes            |   12 |
| sections           |    3 |
| fee_structures     |    2 |
| fee_types          |    8 |
| students           |    5 |
| message_templates  |    4 |
+--------------------+------+
```

---

## 🌐 Running the Application

### Terminal 1: Backend API Server
```bash
cd /path/to/SchoolManagementWebApp/backend
npm run dev
```

**Output:**
```
✅ Backend server running at http://localhost:5000
   Health check: http://localhost:5000/api/health
```

**Test it:**
```bash
curl http://localhost:5000/api/health
# {"status":"ok","service":"school-management-backend","timestamp":"..."}
```

### Terminal 2: Frontend Dev Server
```bash
cd /path/to/SchoolManagementWebApp/frontend
npm run dev
```

**Output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

Open **http://localhost:3000** in your browser.

---

## 👀 What You'll See (Current State)

### Backend API (http://localhost:5000)
| Endpoint | Method | Status |
|----------|--------|--------|
| `/` | GET | ✅ Returns API info |
| `/api/health` | GET | ✅ Health check |
| `/api/auth/login` | POST | ⏳ Day 3 (not implemented yet) |
| Other endpoints | - | ⏳ Days 4+ |

### Frontend UI (http://localhost:3000)
| Page | Status |
|------|--------|
| Login page | ⏳ Day 3 (shows placeholder) |
| Dashboard | ⏳ Day 6 |
| Students | ⏳ Day 8 |
| Settings | ⏳ Day 4 |
| Payments | ⏳ Day 11 |
| Reports | ⏳ Day 19 |

**Currently:** Frontend shows a basic Vite + React scaffold. Full UI comes in Days 3-6.

---

## 🔐 Default Login Credentials (After Day 3)

Once authentication is implemented (Day 3):

| Field | Value |
|-------|-------|
| **Username** | `admin` |
| **Password** | `admin123` |
| **Email** | `admin@school.local` |

> These come from `database/seeders.sql`. Change in production!

---

## 📁 Project Structure

```
SchoolManagementWebApp/
├── README.md                 # Project overview
├── DEVELOPMENT.md            # 21-day roadmap (table format)
├── progress.md               # This file - development progress
├── setupanduse.md            # This file - setup guide
├── .gitignore
│
├── database/
│   ├── README.md
│   ├── schema.sql            # 16 tables (run first)
│   └── seeders.sql           # Seed data (run second)
│
├── backend/
│   ├── package.json
│   ├── .env.example          # Template
│   ├── .env                  # Your config (NOT in git)
│   ├── src/
│   │   ├── server.js         # Express entry point
│   │   ├── config/
│   │   │   ├── db.js         # MySQL pool + ensureDatabase()
│   │   │   └── initDb.js     # Auto-init script
│   │   └── (more folders coming Day 3+)
│   └── node_modules/
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   └── (components/pages coming Day 3+)
    └── node_modules/
```

---

## 🐛 Troubleshooting

### "Cannot connect to database"
```bash
# 1. Check MySQL is running
# Windows: services.msc → MySQL84 → Running
# Linux: sudo systemctl status mysql

# 2. Verify credentials in backend/.env
cat backend/.env | grep DB_

# 3. Test connection manually
mysql -u root -p -h localhost -P 3306
```

### "Unknown database 'school_management_db'"
The auto-init script handles this, but if manual:
```bash
mysql -u root -p -e "CREATE DATABASE school_management_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### "ER_ACCESS_DENIED_ERROR"
Wrong password in `.env`. Check:
```bash
# Test your password works
mysql -u root -p'your_password' -e "SELECT 1;"
```

### Port already in use (EADDRINUSE)
```bash
# Find process on port 5000
# Windows: netstat -ano | findstr :5000
# Linux: lsof -i :5000

# Kill it or change PORT in .env
```

### Frontend: "Network Error" calling API
1. Check backend is running on port 5000
2. Check `CLIENT_URL` in backend `.env` matches frontend URL (default `http://localhost:3000`)
3. Check browser console for CORS errors

---

## 🔄 Re-running Initialization

Safe to run anytime (uses `INSERT IGNORE` and `DROP TABLE IF EXISTS`):
```bash
cd backend
node src/config/initDb.js
```

---

## 📝 Next Steps After Setup

| Day | What to Expect |
|-----|----------------|
| **Day 3** | Login page, JWT auth, protected routes |
| **Day 4** | School settings UI, Classes/Sections management |
| **Day 5** | Dynamic fee structures (Day Scholar vs Hosteller) |
| **Day 6** | Sidebar, Dashboard, Toast notifications |
| **Day 7** | Week 1 integration testing |

---

## 📞 Need Help?

1. Check `DEVELOPMENT.md` for the full 21-day plan
2. Check `progress.md` for what's been built
3. Verify MySQL is running and `.env` is correct
4. Run `node src/config/initDb.js` from `/backend` to re-initialize DB

---

*Last Updated: 2026-08-13*  
*Compatible with: Node 18+, MySQL 8.0+, Windows/Linux/macOS*
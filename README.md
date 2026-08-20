# 🏫 School Student & Fee Management System

A full-stack, production-ready web application designed exclusively for **School Administration & Staff**. This application streamlines student records, dynamic monthly fee structures, cash payment recording, FIFO automatic fee allocations, PDF receipt generation, SMS/WhatsApp messaging, financial reports, and database backup/restore.

> ⚠️ **Admin-Only System**: Designed without student or parent portals. All operations are managed through a secure, responsive Admin UI.

---

## 📖 Quick Links
- 🗓️ **Full Day-by-Day Development Plan (Table Format)**: See [DEVELOPMENT.md](file:///d:/SchoolManagementWebApp/DEVELOPMENT.md)
- 📋 **Implementation Plan & Architecture Artifact**: See [implementation_plan.md](file:///C:/Users/vy305/.gemini/antigravity-ide/brain/75951fb6-692f-4f94-aafb-ff57a6ac1a97/implementation_plan.md)

---

## 🎯 Core Objectives

1. **Dynamic & Zero Hardcoding**: Fee structures, classes, sections, custom fee types, school metadata, and SMS/WhatsApp templates are 100% managed via the Admin UI.
2. **Day Scholar vs. Hosteller Rules**: Dynamic base fee computation for student categories.
3. **Month-Wise Fee Ledger**: Tracks fee dues on a granular, month-by-month basis (PAID, PARTIAL, DUE).
4. **FIFO Cash Payment Allocation**: Cash payments automatically settle the oldest outstanding monthly fee first inside an isolated MySQL database transaction.
5. **PDF Receipt Generation**: Auto-generates branded PDF receipts with unique sequence numbers (`REC-YYYY-XXXXXX`).
6. **Real-time SMS & WhatsApp Due Reminders**: Multi-channel messaging using real-time database balances (never stale data).
7. **Audit & Safety**: Deactivation over hard deletion; complete payment audit trail.

---

## 🏗️ System Architecture

```
                    +-------------------------------------+
                    |            ADMIN BROWSER            |
                    | React 18 + Vite / Modern UI / CSS3  |
                    +-------------------------------------+
                                       |
                         HTTP REST API | JWT Auth
                                       v
                    +-------------------------------------+
                    |          EXPRESS BACKEND            |
                    | - Auth & Rate Limiting Middleware   |
                    | - Payment FIFO Allocation Engine    |
                    | - PDFKit Receipt Generator          |
                    | - SMS & WhatsApp Abstraction        |
                    | - Database Backup / Restore Engine  |
                    +-------------------------------------+
                                       |
                       MySQL Transaction | SQL Driver
                                       v
                    +-------------------------------------+
                    |           MYSQL DATABASE            |
                    |  - 16 Relational Tables             |
                    |  - Foreign Key Integrity & Indexes  |
                    +-------------------------------------+
```

---

## 💡 Key Business Logic & Payment Algorithm

### The FIFO Cash Payment Allocation Rule
When an admin records a cash payment:
1. Open a **MySQL Database Transaction** (`START TRANSACTION`).
2. Query all unpaid or partially paid `monthly_fees` for the student, sorted chronologically (`fee_year ASC, fee_month ASC`).
3. For each monthly fee:
   - Compute `due_amount = fee_amount - paid_amount`.
   - Compute `allocation = MIN(remaining_cash, due_amount)`.
   - Update `monthly_fees`: `paid_amount += allocation`, `due_amount -= allocation`.
   - Set status: `PAID` if `paid_amount == fee_amount`, otherwise `PARTIAL`.
   - Create a record in `payment_allocations` linking `payment_id` to `monthly_fee_id`.
   - Subtract `remaining_cash -= allocation`.
   - If `remaining_cash == 0`, break loop.
4. Insert into `payments` table and commit transaction.
5. Trigger PDF receipt compilation (`REC-YYYY-XXXXXX`).

---

## 💻 Installation & Local Setup (Windows / Linux)

### Prerequisites
* **Node.js**: v18.x or higher
* **MySQL Server**: v8.0 or higher
* **npm**: v9.x or higher

### Step 1: Database Initialization
1. Start your MySQL Server.
2. Open terminal and run:
   ```bash
   mysql -u root -p
   ```
3. Create the database:
   ```sql
   CREATE DATABASE school_management_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. Import schema and seeders:
   ```bash
   mysql -u root -p school_management_db < database/schema.sql
   mysql -u root -p school_management_db < database/seeders.sql
   ```

### Step 2: Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MySQL credentials
npm run dev
```
*Backend server will start at `http://localhost:5000`*

### Step 3: Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
*Frontend app will start at `http://localhost:3000`*

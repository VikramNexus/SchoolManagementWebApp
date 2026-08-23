const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType
} = require(path.join(__dirname, 'backend', 'node_modules', 'docx'));

async function generateDocx() {
  const doc = new Document({
    creator: "Aryavart Portal Engineering Team",
    title: "School Management System - Complete Technology & Architecture Guide",
    description: "Detailed, simple human-readable guide covering all technologies, libraries, architectures, and steps used in the School Management Web App & Android APK.",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: [
          // Document Header / Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: "🏫 ARYAVART PORTAL & SCHOOL MANAGEMENT SYSTEM",
                bold: true,
                size: 36, // 18pt
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 400 },
            children: [
              new TextRun({
                text: "Complete Technology, Architecture, Workflow & Step-by-Step Practical Guide",
                italics: true,
                size: 24, // 12pt
                color: "475569",
              }),
            ],
          }),

          // Introduction Box
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: "📌 Introduction & Purpose of this Document",
                bold: true,
                size: 28,
                color: "0284C7",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 150 },
            children: [
              new TextRun({
                text: "This document is designed to give you a ",
              }),
              new TextRun({
                text: "complete, crystal-clear, and simple understanding",
                highlight: "yellow",
                bold: true,
              }),
              new TextRun({
                text: " of how your School Management Web Application and Android Mobile Application (Aryavart Portal) are built. Every library, tool, database, server, WhatsApp engine, and mobile app component is explained in simple human language with its exact purpose and where it lives in your project.",
              }),
            ],
          }),

          // SECTION 1: MASTER SUMMARY TABLE
          new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: "📊 1. Master Technology Breakdown Table",
                bold: true,
                size: 28,
                color: "0284C7",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 150 },
            children: [
              new TextRun({
                text: "Here is the quick-reference table showing every major technology, tool, and library used across the entire system:",
              }),
            ],
          }),

          // Table of technologies
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "0F172A", type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: "Technology / Library", bold: true, color: "FFFFFF" })] })],
                  }),
                  new TableCell({
                    shading: { fill: "0F172A", type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: "What It Is & Where Used", bold: true, color: "FFFFFF" })] })],
                  }),
                  new TableCell({
                    shading: { fill: "0F172A", type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: "Why It Is Used (Exact Purpose)", bold: true, color: "FFFFFF" })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "React.js (v18)", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Frontend User Interface (frontend/src)" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Creates the interactive, fast, single-page web & mobile screens (Dashboard, Students, Admissions, Dues, Receipts)." })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Vite (v7)", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Frontend Build Tool & Dev Server" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Super-fast compilation of React code and bundling into production HTML/CSS/JS in 7-10 seconds." })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Node.js & Express.js", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Backend REST API Server (backend/src)" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Handles all business logic, database queries, calculations, receipt creation, authentication, and background jobs." })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "TiDB Cloud (MySQL)", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Cloud Relational Database" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "24/7 online cloud database storing students, classes, monthly fees, payments, sibling links, and backup records." })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "@whiskeysockets/baileys", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "WhatsApp Gateway Engine (backend/src/services/whatsappService.js)" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Connects your school's WhatsApp account directly via QR code pairing to automatically send PDF receipts and dues notices without paid API subscriptions." })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Capacitor (v8)", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Android Mobile App Wrapper (frontend/android)" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Converts the React web application into a native Android APK (.apk) file with native back gestures and offline-first asset loading." })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "PDFKit", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "PDF Generator (backend/src/services/pdfReceiptService.js)" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Dynamically draws and renders professional school letterhead fee receipts, admission receipts, and dues notices." })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Render Cloud Hosting", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Cloud Deployment Platform" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Hosts the live backend server and frontend web application 24/7 on the internet (https://schoolmanagementwebapp-pf7m.onrender.com)." })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "JWT & BcryptJS", bold: true, highlight: "yellow" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Security & Authentication" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Bcrypt securely encrypts passwords with salt rounds; JWT issues encrypted digital login tokens for secure session access." })] })],
                  }),
                ],
              }),
            ],
          }),

          // SECTION 2: FRONTEND DETAILED ARCHITECTURE
          new Paragraph({
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: "🌐 2. Frontend Layer (What the User Sees & Interacts With)",
                bold: true,
                size: 28,
                color: "0284C7",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: "The frontend is the visual website and mobile interface. It is located inside the ",
              }),
              new TextRun({
                text: "frontend/",
                bold: true,
                highlight: "yellow",
              }),
              new TextRun({
                text: " directory. Here are the core components:",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 50 },
            children: [
              new TextRun({
                text: "A. React 18 & Single Page Application (SPA):",
                bold: true,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: "Instead of reloading the entire webpage every time you click a button, React only updates the exact part of the screen that changed. This gives your portal the smooth, instant feel of a modern mobile app.",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 50 },
            children: [
              new TextRun({
                text: "B. React Router (v7):",
                bold: true,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: "Manages instant navigation between pages without browser refresh: ",
              }),
              new TextRun({
                text: "/ (Dashboard), /students (Student Directory), /students/:id (Student Profile & Fee Ledger), /admissions (New Admission Desk), /pending-dues (Pending Fees & Reminders), /receipts (Receipts History), /backup (Database Backup & Restore).",
                highlight: "yellow",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 50 },
            children: [
              new TextRun({
                text: "C. Mobile-First Responsive Design & Ergonomics:",
                bold: true,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 150 },
            children: [
              new TextRun({
                text: "• ",
              }),
              new TextRun({
                text: "60% Screen Width Sidebar Drawer: ",
                bold: true,
                highlight: "yellow",
              }),
              new TextRun({
                text: "On mobile devices, opening the hamburger menu slides out a sleek drawer covering exactly 60% of the screen width, leaving 40% clean dark backdrop. All 6 curated text labels are clearly displayed.\n",
              }),
              new TextRun({
                text: "• ",
              }),
              new TextRun({
                text: "Glassmorphic Bottom Navigation Bar: ",
                bold: true,
                highlight: "yellow",
              }),
              new TextRun({
                text: "Provides 1-thumb touch navigation for phone screens with instant access to Dashboard, Admission, Students, Dues, Receipts, and Backup.\n",
              }),
              new TextRun({
                text: "• ",
              }),
              new TextRun({
                text: "Global Mobile Typography Scale: ",
                bold: true,
                highlight: "yellow",
              }),
              new TextRun({
                text: "Downscaled base font to 14.5px on mobile screens with compact 2-column button grids and touch-scrollable tables so no information ever gets clipped.",
              }),
            ],
          }),

          // SECTION 3: BACKEND API & BUSINESS LOGIC
          new Paragraph({
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: "⚙️ 3. Backend Layer (Server, Database & Business Logic)",
                bold: true,
                size: 28,
                color: "0284C7",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: "The backend server is the engine of the entire system, located in ",
              }),
              new TextRun({
                text: "backend/src/",
                bold: true,
                highlight: "yellow",
              }),
              new TextRun({
                text: ". It connects the frontend to the database and processes all fee calculations securely.",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 50 },
            children: [
              new TextRun({
                text: "A. Express.js REST API Routes:",
                bold: true,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 150 },
            children: [
              new TextRun({ text: "• " }),
              new TextRun({ text: "/api/auth: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "Handles admin login, password hashing verification, and token generation.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "/api/students: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "CRUD operations for student profiles, sibling linking, fee concession categories, and family ledgers.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "/api/fees: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "Monthly fee structure, multi-month bulk payment collection, discount adjustments, and dues calculation.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "/api/admissions: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "New student enrollment desk with itemized admission charges, caution money, and 1-month advance fee billing.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "/api/receipts: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "Instant PDF receipt generation, thermal print receipts, and WhatsApp receipt dispatch.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "/api/backup: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "1-Click automated database backup (.sql.dump) generation and restoration." }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 50 },
            children: [
              new TextRun({
                text: "B. MySQL Database & TiDB Cloud Connection:",
                bold: true,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: "Using ",
              }),
              new TextRun({
                text: "mysql2 connection pooling",
                bold: true,
                highlight: "yellow",
              }),
              new TextRun({
                text: ", the backend maintains persistent, SSL-encrypted connections to the TiDB Serverless Cloud database. It supports ACID database transactions (`START TRANSACTION`, `COMMIT`, `ROLLBACK`) so that payments and student ledger balances are always 100% mathematically accurate with zero chance of double-charging or data loss.",
              }),
            ],
          }),

          // SECTION 4: WHATSAPP MESSAGING SYSTEM (WHISKEYSOCKETS BAILEYS)
          new Paragraph({
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: "💬 4. WhatsApp Automation Engine (@whiskeysockets/baileys)",
                bold: true,
                size: 28,
                color: "0284C7",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: "One of the most powerful features in your project is the dual-mode WhatsApp messaging system. Here is exactly how it works:",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 50 },
            children: [
              new TextRun({
                text: "What is @whiskeysockets/baileys?",
                bold: true,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: "Baileys is an open-source, multi-device WhatsApp WebSocket library. Unlike expensive paid WhatsApp Cloud APIs (which charge money for every message), Baileys connects your school's WhatsApp account directly via ",
              }),
              new TextRun({
                text: "QR code scanning (like WhatsApp Web)",
                bold: true,
                highlight: "yellow",
              }),
              new TextRun({
                text: ". Once paired, your server can send messages and attach PDF receipts completely for free.",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 50 },
            children: [
              new TextRun({
                text: "How the Dual-Engine Fallback Works:",
                bold: true,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 150 },
            children: [
              new TextRun({ text: "1. " }),
              new TextRun({ text: "Mode 1 (Background Cloud Dispatch): ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "If your WhatsApp is linked via QR code on your server, the backend sends the message, formatted billing breakdown, and PDF receipt automatically in the background with zero user effort.\n" }),
              new TextRun({ text: "2. " }),
              new TextRun({ text: "Mode 2 (Universal Direct Link Fallback): ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "If WhatsApp is not linked on your laptop, the system automatically creates an official `https://wa.me/91...` deep link with the pre-formatted student bill and parent's phone number. Clicking the button immediately opens WhatsApp on your phone or laptop with the message pre-filled — ready to send in 1 tap!\n" }),
              new TextRun({ text: "Result: " }),
              new TextRun({ text: "100% reliable messaging with ZERO errors on both mobile phones and desktop computers.", bold: true, highlight: "yellow" }),
            ],
          }),

          // SECTION 5: ANDROID APK BUILDING (CAPACITOR)
          new Paragraph({
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: "📱 5. Android Mobile Application (.apk) & Capacitor",
                bold: true,
                size: 28,
                color: "0284C7",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({
                text: "How your React web application is turned into an Android app:",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 150 },
            children: [
              new TextRun({ text: "1. " }),
              new TextRun({ text: "Capacitor (@capacitor/core & @capacitor/android): ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "A cross-platform native runtime created by the Ionic team. It embeds your compiled React web app into a high-performance native Android WebView wrapper.\n" }),
              new TextRun({ text: "2. " }),
              new TextRun({ text: "Native Back Gesture Support (@capacitor/app): ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "We integrated native Android hardware back button and edge-swipe gesture listeners in `App.jsx`. When you swipe back, it closes open drawers or modals first, navigates back in history, or exits cleanly when on the Dashboard.\n" }),
              new TextRun({ text: "3. " }),
              new TextRun({ text: "Local Offline Asset Bundling: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "The entire React UI (HTML, CSS, JS, Lucide icons) is bundled directly inside the APK (`android/app/src/main/assets/public/`). This means the app launches instantly on your phone with zero white-screen delays, connecting to your live cloud backend for data." }),
            ],
          }),

          // SECTION 6: HOW TO RUN, BUILD, AND DEPLOY STEP-BY-STEP
          new Paragraph({
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: "🚀 6. Step-by-Step Practical Guides for Every Operation",
                bold: true,
                size: 28,
                color: "0284C7",
              }),
            ],
          }),

          // Guide A: Run Locally
          new Paragraph({
            spacing: { before: 100, after: 50 },
            children: [
              new TextRun({
                text: "Guide A: How to Run the Project Locally on Your Laptop",
                bold: true,
                size: 24,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({ text: "Step 1: Open PowerShell or Terminal in the project root folder.\n" }),
              new TextRun({ text: "Step 2: Start the Backend Server:\n" }),
              new TextRun({ text: "   cd backend\n   node src/server.js\n", highlight: "yellow", bold: true }),
              new TextRun({ text: "   (Your backend will start running on http://localhost:5000)\n\n" }),
              new TextRun({ text: "Step 3: Open a second PowerShell window and start the Frontend Dev Server:\n" }),
              new TextRun({ text: "   cd frontend\n   npm run dev\n", highlight: "yellow", bold: true }),
              new TextRun({ text: "   (Your frontend will open at http://localhost:5173)\n\n" }),
              new TextRun({ text: "Step 4: Login with credentials: Username: " }),
              new TextRun({ text: "admin", bold: true, highlight: "yellow" }),
              new TextRun({ text: " | Password: " }),
              new TextRun({ text: "admin123", bold: true, highlight: "yellow" }),
            ],
          }),

          // Guide B: Rebuild APK
          new Paragraph({
            spacing: { before: 150, after: 50 },
            children: [
              new TextRun({
                text: "Guide B: How to Rebuild the Android APK File",
                bold: true,
                size: 24,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 100 },
            children: [
              new TextRun({ text: "Step 1: Build the updated frontend assets:\n" }),
              new TextRun({ text: "   cd frontend\n   npm run build\n", highlight: "yellow", bold: true }),
              new TextRun({ text: "Step 2: Synchronize web assets into the Android native folder:\n" }),
              new TextRun({ text: "   npx cap sync android\n", highlight: "yellow", bold: true }),
              new TextRun({ text: "Step 3: Run the Gradle build with JDK 21:\n" }),
              new TextRun({ text: "   cd android\n   .\\gradlew.bat assembleDebug\n", highlight: "yellow", bold: true }),
              new TextRun({ text: "Step 4: Your newly generated APK will be at:\n" }),
              new TextRun({ text: "   d:\\SchoolManagementWebApp\\AryavartPortal.apk\n", highlight: "yellow", bold: true }),
              new TextRun({ text: "Transfer this file to your Android phone and install it!" }),
            ],
          }),

          // Guide C: Deploying to Cloud
          new Paragraph({
            spacing: { before: 150, after: 50 },
            children: [
              new TextRun({
                text: "Guide C: How Changes Are Automatically Deployed Live to Render Cloud",
                bold: true,
                size: 24,
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 150 },
            children: [
              new TextRun({ text: "Whenever any code is updated, pushing to the GitHub repository automatically updates the live website:\n" }),
              new TextRun({ text: "   git add .\n   git commit -m \"your update message\"\n   git push origin main\n", highlight: "yellow", bold: true }),
              new TextRun({ text: "Render immediately receives the push, builds the project, and updates your live URL: " }),
              new TextRun({ text: "https://schoolmanagementwebapp-pf7m.onrender.com", bold: true, highlight: "yellow" }),
            ],
          }),

          // SECTION 7: PROJECT FILE STRUCTURE SITEMAP
          new Paragraph({
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: "📁 7. Quick Directory Map (Where Code Lives)",
                bold: true,
                size: 28,
                color: "0284C7",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 50, after: 200 },
            children: [
              new TextRun({ text: "• " }),
              new TextRun({ text: "backend/src/server.js: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "Entry point for the backend Express server.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "backend/src/config/database.js: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "TiDB Cloud MySQL database connection pool.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "backend/src/services/whatsappService.js: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "Baileys WhatsApp socket & deep link generator.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "backend/src/services/pdfReceiptService.js: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "PDFKit automated receipt drawing service.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "frontend/src/App.jsx: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "Main React routing, theme layout, and native Android back gesture listeners.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "frontend/src/components/Sidebar.jsx: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "60% mobile width drawer with curated 6 options.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "frontend/src/components/MobileBottomNav.jsx: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "1-thumb mobile bottom navigation bar.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "frontend/src/pages/: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "Dashboard, Students, StudentProfile, Admissions, PendingFees, Receipts, Backup.\n" }),
              new TextRun({ text: "• " }),
              new TextRun({ text: "AryavartPortal.apk: ", bold: true, highlight: "yellow" }),
              new TextRun({ text: "Ready-to-install Android mobile application package." }),
            ],
          }),

          // Final Signature Footer
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 100 },
            children: [
              new TextRun({
                text: "✨ Document generated for Aryavart Portal School Management System",
                bold: true,
                color: "64748B",
                size: 20,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, 'School_Management_Project_Complete_Guide.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document successfully created at: ${outputPath} (${buffer.length} bytes)`);
}

generateDocx().catch(err => {
  console.error("Error generating docx:", err);
  process.exit(1);
});

/**
 * Route Aggregator — School Management System
 *
 * Day 3: Central place to mount all API routers. New feature routes
 * (settings, students, payments, receipts, messaging, reports, backup)
 * are wired in on their respective development days.
 */

const express = require('express');
const authRoutes = require('./authRoutes');
const settingsRoutes = require('./settingsRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const studentRoutes = require('./studentRoutes');
const studentProfileRoutes = require('./studentProfileRoutes');
const paymentRoutes = require('./paymentRoutes');
const receiptRoutes = require('./receiptRoutes');
const messagingSettingsRoutes = require('./messagingSettingsRoutes');
const reportRoutes = require('./reportRoutes');
const messageRoutes = require('./messageRoutes');
const backupRoutes = require('./backupRoutes');
const notificationRoutes = require('./notificationRoutes');
const admissionRoutes = require('./admissionRoutes');
const familyRoutes = require('./familyRoutes');

const router = express.Router();

// Day 3 — Authentication
router.use('/auth', authRoutes);

// Day 4 — Settings (all require auth via middleware in settingsRoutes)
router.use('/settings', settingsRoutes);

// Day 4 — Dashboard KPIs
router.use('/dashboard', dashboardRoutes);

// Day 5 — Students
router.use('/students', studentRoutes);
router.use('/students', studentProfileRoutes);

// Admissions Desk
router.use('/admissions', admissionRoutes);

// Family / Sibling Accounts
router.use('/family', familyRoutes);

// Day 6 — Payments
router.use('/payments', paymentRoutes);

// Day 8 — Receipts & Messaging Foundation
router.use('/receipts', receiptRoutes);
router.use('/settings/messaging', messagingSettingsRoutes);

// Day 9 — Reports & Dues
router.use('/reports', reportRoutes);

// Day 9 — Messages & Reminders
router.use('/messages', messageRoutes);

// Day 10 — Backup & Restore
router.use('/backup', backupRoutes);

// Notifications
router.use('/notifications', notificationRoutes);

module.exports = router;

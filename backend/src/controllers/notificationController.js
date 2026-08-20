/**
 * Notification Controller — School Management System
 * Dynamic system alerts, fee due notifications, collection updates, and backup alerts
 */

const db = require('../config/db');

/**
 * GET /api/notifications
 * Returns an aggregated list of real-time administrative notifications.
 */
async function getNotifications(req, res) {
  try {
    const notifications = [];

    // 1. Check Pending Fee Dues
    const duesStats = await db.queryOne(`
      SELECT 
        COUNT(DISTINCT student_id) as students_with_dues,
        COALESCE(SUM(total_due), 0) as total_dues
      FROM (
        SELECT
          s.id as student_id,
          (
            COALESCE((SELECT SUM(mf.due_amount) FROM monthly_fees mf WHERE mf.student_id = s.id AND mf.status IN ('DUE', 'PARTIAL')), 0) +
            COALESCE((SELECT SUM(saf.amount) FROM student_additional_fees saf WHERE saf.student_id = s.id AND saf.status IN ('DUE', 'PARTIAL')), 0)
          ) as total_due
        FROM students s
        WHERE s.status = 'active'
      ) sub
      WHERE total_due > 0
    `);

    if (duesStats && Number(duesStats.students_with_dues) > 0) {
      notifications.push({
        id: 'notif-dues',
        type: 'warning',
        title: 'Outstanding Fee Dues',
        message: `${duesStats.students_with_dues} student(s) currently have pending fee dues totaling ₹${Number(duesStats.total_dues).toLocaleString('en-IN')}.`,
        link: '/pending-fees',
        badge: `${duesStats.students_with_dues} Students`,
        timestamp: 'Action Needed',
        unread: true,
      });
    }

    // 2. Check Today's Collections
    const todayCollections = await db.queryOne(`
      SELECT 
        COUNT(id) as total_txns,
        COALESCE(SUM(amount), 0) as today_total
      FROM payments
      WHERE DATE(payment_date) = CURDATE()
    `);

    if (todayCollections && Number(todayCollections.total_txns) > 0) {
      notifications.push({
        id: 'notif-collections',
        type: 'success',
        title: "Today's Fee Collections",
        message: `₹${Number(todayCollections.today_total).toLocaleString('en-IN')} collected today across ${todayCollections.total_txns} transaction(s).`,
        link: '/payments',
        badge: `₹${Number(todayCollections.today_total).toLocaleString('en-IN')}`,
        timestamp: 'Today',
        unread: false,
      });
    } else {
      notifications.push({
        id: 'notif-no-collections',
        type: 'info',
        title: 'Fee Collection Counter',
        message: 'No fee receipts recorded yet for today. Use the "+ Record Payment" action to log collections.',
        link: '/payments',
        badge: 'Fee Desk',
        timestamp: 'Today',
        unread: false,
      });
    }

    // 3. Check Student Admissions
    const studentCount = await db.queryOne('SELECT COUNT(id) as total FROM students');
    notifications.push({
      id: 'notif-students',
      type: 'info',
      title: 'Student Enrollment Active',
      message: `${studentCount?.total || 0} active student(s) registered in the academic session.`,
      link: '/students',
      badge: `${studentCount?.total || 0} Enrolled`,
      timestamp: 'Academic',
      unread: false,
    });

    // 4. System Backup Notification
    notifications.push({
      id: 'notif-backup',
      type: 'system',
      title: 'Database Backup & Integrity',
      message: 'System database is operational. You can create or download snapshots in the Backup section.',
      link: '/backup',
      badge: 'Database',
      timestamp: 'Safe',
      unread: false,
    });

    const unreadCount = notifications.filter((n) => n.unread).length;

    return res.json({
      success: true,
      unread_count: unreadCount,
      notifications,
    });
  } catch (err) {
    console.error('[notificationController.getNotifications]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
}

module.exports = {
  getNotifications,
};

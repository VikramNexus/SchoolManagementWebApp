-- ============================================================================
-- SCHOOL STUDENT & FEE MANAGEMENT SYSTEM — INITIAL SEED DATA
-- ----------------------------------------------------------------------------
-- Admin user (password: admin123), classes 1-12, sections A/B/C,
-- default fee structures, fee types, school settings, and message templates.
--
-- Run AFTER schema.sql:
--   mysql -u root -p school_management_db < database/seeders.sql
-- ============================================================================

USE `school_management_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. users — Initial user is created programmatically ONLY if users table is empty
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 2. school_settings — Single row school profile
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `school_settings` (`id`, `school_name`, `address`, `phone`, `email`, `currency_symbol`, `academic_year`)
VALUES (1, 'Demo Public School', '123 Education Lane, Knowledge City', '+91-9876543210', 'info@demopublicschool.edu.in', '₹', '2025-2026');

-- ----------------------------------------------------------------------------
-- 3. classes — Grades 1 through 12
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `classes` (`id`, `name`, `order_index`, `is_active`) VALUES
(1, 'Class 1', 1, 1),  (2, 'Class 2', 2, 1),  (3, 'Class 3', 3, 1),
(4, 'Class 4', 4, 1),  (5, 'Class 5', 5, 1),  (6, 'Class 6', 6, 1),
(7, 'Class 7', 7, 1),  (8, 'Class 8', 8, 1),  (9, 'Class 9', 9, 1),
(10, 'Class 10', 10, 1), (11, 'Class 11', 11, 1), (12, 'Class 12', 12, 1);

-- ----------------------------------------------------------------------------
-- 4. sections — A, B, C for each class
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `sections` (`id`, `name`, `class_id`, `is_active`) VALUES
(1, 'A', 1, 1), (2, 'B', 1, 1), (3, 'C', 1, 1),
(4, 'A', 2, 1), (5, 'B', 2, 1), (6, 'C', 2, 1),
(7, 'A', 3, 1), (8, 'B', 3, 1), (9, 'C', 3, 1),
(10, 'A', 4, 1), (11, 'B', 4, 1), (12, 'C', 4, 1),
(13, 'A', 5, 1), (14, 'B', 5, 1), (15, 'C', 5, 1),
(16, 'A', 6, 1), (17, 'B', 6, 1), (18, 'C', 6, 1),
(19, 'A', 7, 1), (20, 'B', 7, 1), (21, 'C', 7, 1),
(22, 'A', 8, 1), (23, 'B', 8, 1), (24, 'C', 8, 1),
(25, 'A', 9, 1), (26, 'B', 9, 1), (27, 'C', 9, 1),
(28, 'A', 10, 1), (29, 'B', 10, 1), (30, 'C', 10, 1),
(31, 'A', 11, 1), (32, 'B', 11, 1), (33, 'C', 11, 1),
(34, 'A', 12, 1), (35, 'B', 12, 1), (36, 'C', 12, 1);

-- ----------------------------------------------------------------------------
-- 5. fee_structures — Monthly base rates (Day Scholar vs Hosteller)
--    Effective from start of academic year 2025-04-01
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `fee_structures` (`id`, `category`, `amount`, `effective_from`, `is_active`) VALUES
(1, 'day_scholar', 3000.00, '2025-04-01', 1),
(2, 'hosteller', 5000.00, '2025-04-01', 1);

-- ----------------------------------------------------------------------------
-- 6. fee_types — Custom/additional charge definitions
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `fee_types` (`id`, `name`, `description`, `is_recurring`, `is_active`) VALUES
(1, 'Admission Fee', 'One-time admission charge at enrollment', 0, 1),
(2, 'Examination Fee', 'Per-term exam fee', 1, 1),
(3, 'Transport Fee', 'Monthly bus/van transport charge', 1, 1),
(4, 'Hostel Fee', 'Monthly hostel accommodation (hostellers only)', 1, 1),
(5, 'Laboratory Fee', 'Science/computer lab usage per term', 1, 1),
(6, 'Library Fee', 'Annual library membership', 0, 1),
(7, 'Sports Fee', 'Annual sports facility charge', 0, 1),
(8, 'Uniform Fee', 'School uniform kit (one-time)', 0, 1);

-- ----------------------------------------------------------------------------
-- 7. message_templates — SMS & WhatsApp template definitions
--    Placeholders: {student_name}, {admission_no}, {due_amount},
--                  {school_name}, {payment_date}, {receipt_number}
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `message_templates` (`id`, `name`, `channel`, `body`, `is_active`) VALUES
(1, 'Due Reminder - SMS', 'sms',
 'Dear Parent, {student_name} (Adm: {admission_no}) has pending fees of {due_amount} for {school_name}. Please pay by {payment_date}. Ignore if paid.', 1),
(2, 'Due Reminder - WhatsApp', 'whatsapp',
 '📢 *Fee Reminder* — {school_name}\n\nStudent: {student_name} (Adm: {admission_no})\nPending Amount: {due_amount}\nDue Date: {payment_date}\n\nPlease remit payment at the earliest. Thank you!', 1),
(3, 'Payment Confirmation - SMS', 'sms',
 'Thank you! Payment of {due_amount} received for {student_name} (Adm: {admission_no}) on {payment_date}. Receipt: {receipt_number}. {school_name}', 1),
(4, 'Payment Confirmation - WhatsApp', 'whatsapp',
 '✅ *Payment Received* — {school_name}\n\nStudent: {student_name} (Adm: {admission_no})\nAmount: {due_amount}\nDate: {payment_date}\nReceipt: {receipt_number}\n\nThank you for your timely payment!', 1);

-- ----------------------------------------------------------------------------
-- 7b. messaging_settings — SMS & WhatsApp configuration defaults
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `messaging_settings` (`id`, `sms_enabled`, `sms_provider`, `sms_mock_mode`, `whatsapp_enabled`, `whatsapp_provider`, `whatsapp_mock_mode`)
VALUES (1, 0, 'twilio', 1, 0, 'meta', 1);

-- ----------------------------------------------------------------------------
-- 8. Sample students (optional - for immediate testing)
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `students` (`id`, `admission_no`, `full_name`, `class_id`, `section_id`, `category`, `parent_name`, `phone`, `whatsapp_number`, `address`, `admission_date`, `status`) VALUES
(1, 'ADM2025001', 'Aarav Sharma', 1, 1, 'day_scholar', 'Rajesh Sharma', '9876543210', '9876543210', '45 Green Park, Delhi', '2025-04-01', 'active'),
(2, 'ADM2025002', 'Priya Patel', 1, 1, 'hosteller', 'Amit Patel', '9876543211', '9876543211', '12 Model Town, Mumbai', '2025-04-01', 'active'),
(3, 'ADM2025003', 'Rohan Gupta', 2, 2, 'day_scholar', 'Suresh Gupta', '9876543212', '9876543212', '78 Civil Lines, Bangalore', '2025-04-01', 'active'),
(4, 'ADM2025004', 'Ananya Singh', 2, 2, 'hosteller', 'Vikram Singh', '9876543213', '9876543213', '34 Park Street, Kolkata', '2025-04-01', 'active'),
(5, 'ADM2025005', 'Kabir Reddy', 3, 3, 'day_scholar', 'Prakash Reddy', '9876543214', '9876543214', '56 Jubilee Hills, Hyderabad', '2025-04-01', 'active');

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- END OF SEEDERS
-- ============================================================================
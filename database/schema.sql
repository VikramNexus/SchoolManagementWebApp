-- ============================================================================
-- SCHOOL STUDENT & FEE MANAGEMENT SYSTEM — DATABASE SCHEMA
-- ----------------------------------------------------------------------------
-- 16 normalized tables covering auth, school settings, classes/sections,
-- students, dynamic fee structures, the month-wise fee ledger, payments,
-- FIFO payment allocations, receipts, messaging, and audit/backup safety.
--
-- Run with:  mysql -u root -p school_management_db < database/schema.sql
-- Engine:  InnoDB (transaction + FK support). Charset: utf8mb4.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. users — Admin / staff accounts (the only actor in this system)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`            VARCHAR(60)  NOT NULL,
  `email`               VARCHAR(120) DEFAULT NULL,
  `password_hash`       VARCHAR(255) NOT NULL,
  `role`                ENUM('admin', 'staff') NOT NULL DEFAULT 'admin',
  `full_name`           VARCHAR(120) DEFAULT NULL,
  `security_question`   VARCHAR(255) DEFAULT NULL,
  `security_answer_hash` VARCHAR(255) DEFAULT NULL,
  `is_active`           TINYINT(1)   NOT NULL DEFAULT 1,
  `last_login`          DATETIME     DEFAULT NULL,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. school_settings — Single-row school profile & global metadata
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `school_settings`;
CREATE TABLE `school_settings` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `school_name`     VARCHAR(160) NOT NULL DEFAULT 'My School',
  `address`         VARCHAR(255) DEFAULT NULL,
  `phone`           VARCHAR(20)  DEFAULT NULL,
  `email`           VARCHAR(120) DEFAULT NULL,
  `logo_path`       VARCHAR(255) DEFAULT NULL,
  `currency_symbol` VARCHAR(10)  NOT NULL DEFAULT '₹',
  `academic_year`   VARCHAR(20)  DEFAULT NULL,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. classes — Grades 1-12 (and beyond), managed dynamically
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `classes`;
CREATE TABLE `classes` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(40)  NOT NULL,
  `order_index` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_classes_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. sections — A/B/C etc., managed dynamically
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sections`;
CREATE TABLE `sections` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(20)  NOT NULL,
  `class_id`   INT UNSIGNED NOT NULL,
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sections_class_name` (`class_id`, `name`),
  KEY `idx_sections_class` (`class_id`),
  CONSTRAINT `fk_sections_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. fee_structures — Monthly base rates per student category
--    (Day Scholar vs Hosteller). No hardcoding in the app.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `fee_structures`;
CREATE TABLE `fee_structures` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category`      ENUM('day_scholar', 'hosteller') NOT NULL,
  `amount`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `effective_from` DATE        NOT NULL,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fee_structures_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. fee_types — Custom/additional charge definitions
--    (Admission, Exam, Transport, Hostel, etc.)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `fee_types`;
CREATE TABLE `fee_types` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(80)  NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_recurring` TINYINT(1)  NOT NULL DEFAULT 0,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fee_types_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. students — Core student records
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id`                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admission_no`          VARCHAR(40)  NOT NULL,
  `full_name`             VARCHAR(160) NOT NULL,
  `class_id`              INT UNSIGNED DEFAULT NULL,
  `section_id`            INT UNSIGNED DEFAULT NULL,
  `category`              ENUM('day_scholar', 'hosteller') NOT NULL DEFAULT 'day_scholar',
  `gender`                ENUM('male', 'female', 'other') DEFAULT 'male',
  `father_name`           VARCHAR(160) DEFAULT NULL,
  `mother_name`           VARCHAR(160) DEFAULT NULL,
  `parent_name`           VARCHAR(160) DEFAULT NULL,
  `phone`                 VARCHAR(20)  DEFAULT NULL,
  `whatsapp_number`       VARCHAR(20) DEFAULT NULL,
  `address`               VARCHAR(255) DEFAULT NULL,
  `admission_date`        DATE         DEFAULT NULL,
  `admission_receipt_no`  VARCHAR(50)  DEFAULT NULL,
  `monthly_fee_rate`      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `family_id`             VARCHAR(64)  DEFAULT NULL,
  `status`                ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
  `created_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_students_admission_no` (`admission_no`),
  KEY `idx_students_class` (`class_id`),
  KEY `idx_students_status` (`status`),
  KEY `idx_students_category` (`category`),
  KEY `idx_students_family_id` (`family_id`),
  CONSTRAINT `fk_students_class`
    FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_students_section`
    FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. monthly_fees — Month-wise fee ledger (PAID / PARTIAL / DUE)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `monthly_fees`;
CREATE TABLE `monthly_fees` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`   INT UNSIGNED NOT NULL,
  `fee_month`    TINYINT UNSIGNED NOT NULL COMMENT '1-12',
  `fee_year`     SMALLINT UNSIGNED NOT NULL,
  `fee_amount`   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `paid_amount`  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `due_amount`   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status`       ENUM('DUE', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'DUE',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_monthly_fees_student_month` (`student_id`, `fee_year`, `fee_month`),
  KEY `idx_monthly_fees_status` (`status`),
  KEY `idx_monthly_fees_due` (`student_id`, `status`),
  CONSTRAINT `fk_monthly_fees_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. student_additional_fees — Optional custom fees attached to a student
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `student_additional_fees`;
CREATE TABLE `student_additional_fees` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`    INT UNSIGNED NOT NULL,
  `fee_type_id`   INT UNSIGNED NOT NULL,
  `description`   VARCHAR(255) DEFAULT NULL,
  `amount`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `due_date`      DATE         DEFAULT NULL,
  `status`        ENUM('DUE', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'DUE',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_saf_student` (`student_id`),
  CONSTRAINT `fk_saf_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_saf_fee_type`
    FOREIGN KEY (`fee_type_id`) REFERENCES `fee_types` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. payments — Cash payment header records
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_number`    VARCHAR(20) NOT NULL,
  `student_id`        INT UNSIGNED NOT NULL,
  `family_id`         VARCHAR(64) DEFAULT NULL,
  `amount`            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payment_mode`      ENUM('CASH', 'ONLINE', 'CHEQUE', 'UPI') NOT NULL DEFAULT 'CASH',
  `payment_category`  ENUM('MONTHLY_FEE', 'ADMISSION_CHARGE', 'FAMILY_FEE', 'CUSTOM_FEE') NOT NULL DEFAULT 'MONTHLY_FEE',
  `payment_date`      DATE         NOT NULL,
  `notes`             VARCHAR(255) DEFAULT NULL,
  `recorded_by`       INT UNSIGNED DEFAULT NULL,
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_receipt` (`receipt_number`),
  KEY `idx_payments_student` (`student_id`),
  KEY `idx_payments_family_id` (`family_id`),
  KEY `idx_payments_date` (`payment_date`),
  CONSTRAINT `fk_payments_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_recorded_by`
    FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. payment_allocations — FIFO link between a payment and monthly fees
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payment_allocations`;
CREATE TABLE `payment_allocations` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id`       INT UNSIGNED NOT NULL,
  `monthly_fee_id`   INT UNSIGNED NOT NULL,
  `allocated_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pa_payment` (`payment_id`),
  KEY `idx_pa_monthly_fee` (`monthly_fee_id`),
  CONSTRAINT `fk_pa_payment`
    FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pa_monthly_fee`
    FOREIGN KEY (`monthly_fee_id`) REFERENCES `monthly_fees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. receipts — Generated PDF receipt metadata
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `receipts`;
CREATE TABLE `receipts` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id`     INT UNSIGNED NOT NULL,
  `receipt_number` VARCHAR(20)  NOT NULL,
  `file_path`      VARCHAR(255) DEFAULT NULL,
  `generated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipts_payment` (`payment_id`),
  KEY `idx_receipts_number` (`receipt_number`),
  CONSTRAINT `fk_receipts_payment`
    FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. message_templates — SMS / WhatsApp template definitions
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `message_templates`;
CREATE TABLE `message_templates` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(80)  NOT NULL,
  `channel`     ENUM('sms', 'whatsapp', 'both') NOT NULL DEFAULT 'both',
  `body`        TEXT         NOT NULL,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14. message_logs — Dispatch history for sent reminders
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `message_logs`;
CREATE TABLE `message_logs` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`      INT UNSIGNED DEFAULT NULL,
  `template_id`     INT UNSIGNED DEFAULT NULL,
  `channel`         ENUM('sms', 'whatsapp') NOT NULL,
  `recipient`       VARCHAR(20)  DEFAULT NULL,
  `message`         TEXT         NOT NULL,
  `status`          ENUM('sent', 'failed', 'mock') NOT NULL DEFAULT 'mock',
  `error_message`   VARCHAR(255) DEFAULT NULL,
  `sent_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_logs_student` (`student_id`),
  CONSTRAINT `fk_msg_logs_student`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_msg_logs_template`
    FOREIGN KEY (`template_id`) REFERENCES `message_templates` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14b. messaging_settings — SMS & WhatsApp configuration
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `messaging_settings`;
CREATE TABLE `messaging_settings` (
  `id`                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sms_enabled`             TINYINT(1)   NOT NULL DEFAULT 0,
  `sms_provider`            ENUM('twilio', 'msg91') NOT NULL DEFAULT 'twilio',
  `sms_api_key`             VARCHAR(255) DEFAULT NULL,
  `sms_sender_id`           VARCHAR(50)  DEFAULT NULL,
  `sms_mock_mode`           TINYINT(1)   NOT NULL DEFAULT 1,
  `whatsapp_enabled`        TINYINT(1)   NOT NULL DEFAULT 0,
  `whatsapp_provider`       ENUM('twilio', 'meta') NOT NULL DEFAULT 'meta',
  `whatsapp_api_key`        VARCHAR(255) DEFAULT NULL,
  `whatsapp_phone_number_id` VARCHAR(50) DEFAULT NULL,
  `whatsapp_mock_mode`      TINYINT(1)   NOT NULL DEFAULT 1,
  `updated_at`              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 15. audit_logs — Complete payment / change audit trail
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED DEFAULT NULL,
  `action`      VARCHAR(80)  NOT NULL,
  `entity_type` VARCHAR(40)  DEFAULT NULL,
  `entity_id`   INT UNSIGNED DEFAULT NULL,
  `description` TEXT         DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_entity` (`entity_type`, `entity_id`),
  CONSTRAINT `fk_audit_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 16. backup_logs — Database backup / restore history
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `backup_logs`;
CREATE TABLE `backup_logs` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type`         ENUM('export', 'restore') NOT NULL,
  `file_name`    VARCHAR(255) NOT NULL,
  `file_size`    BIGINT UNSIGNED DEFAULT 0,
  `performed_by` INT UNSIGNED DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_backup_type` (`type`),
  CONSTRAINT `fk_backup_user`
    FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 17. backups — Backup file metadata for management UI
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `backups`;
CREATE TABLE `backups` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename`     VARCHAR(255) NOT NULL,
  `file_path`    VARCHAR(500) NOT NULL,
  `file_size`    BIGINT UNSIGNED DEFAULT 0,
  `status`       ENUM('completed', 'failed', 'restored') NOT NULL DEFAULT 'completed',
  `created_by`   INT UNSIGNED DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_backups_filename` (`filename`),
  KEY `idx_backups_status` (`status`),
  CONSTRAINT `fk_backups_user`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

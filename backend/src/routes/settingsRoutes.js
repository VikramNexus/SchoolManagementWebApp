/**
 * Settings Routes — School Management System
 *
 * Day 4: Settings, Fees & Application Shell.
 *
 * All routes require authentication (JWT).
 */

const express = require('express');
const {
  getSchool,
  updateSchool,
  getClasses,
  createClass,
  deleteClass,
  getSections,
  createSection,
  deleteSection,
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getFeeTypes,
  createFeeType,
  updateFeeType,
  deleteFeeType,
} = require('../controllers/settingsController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All settings routes require authentication
router.use(authenticateToken);

/**
 * School Profile
 */
router.get('/school', getSchool);
router.put('/school', updateSchool);

/**
 * Classes
 */
router.get('/classes', getClasses);
router.post('/classes', createClass);
router.delete('/classes/:id', deleteClass);

/**
 * Sections
 */
router.get('/sections', getSections);
router.post('/sections', createSection);
router.delete('/sections/:id', deleteSection);

/**
 * Fee Structures (Day Scholar / Hosteller monthly base rates)
 */
router.get('/fee-structures', getFeeStructures);
router.post('/fee-structures', createFeeStructure);
router.put('/fee-structures/:id', updateFeeStructure);
router.delete('/fee-structures/:id', deleteFeeStructure);

/**
 * Fee Types (custom charges: Admission, Exam, Transport, etc.)
 */
router.get('/fee-types', getFeeTypes);
router.post('/fee-types', createFeeType);
router.put('/fee-types/:id', updateFeeType);
router.delete('/fee-types/:id', deleteFeeType);

module.exports = router;
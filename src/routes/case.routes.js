/* ==========================================================================
   /api/v1/cases
   ========================================================================== */

const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/authorize');
const controller = require('../controllers/case.controller');
const { CASE_CATEGORIES, CASE_PRIORITIES, CASE_STATUSES } = require('../config/constants');

const router = express.Router();

router.get('/', authorize('case:read'), controller.list);
router.get('/:number', authorize('case:read'), controller.detail);

router.post('/',
  authorize('case:create'),
  body('title').trim().isLength({ min: 5, max: 200 })
    .withMessage('Give the docket a descriptive title, for example "Armed robbery — Pretoria Street spaza".'),
  body('category').isIn(CASE_CATEGORIES).withMessage('Choose a listed crime category.'),
  body('priority').isIn(CASE_PRIORITIES).withMessage('Choose Critical, High, Medium or Low.'),
  body('description').trim().isLength({ min: 10 })
    .withMessage('Record what happened, as reported by the complainant.'),
  body('location').trim().notEmpty().withMessage('Record where the incident occurred.'),
  body('complainantIdNumber').optional({ checkFalsy: true }).matches(/^\d{13}$/)
    .withMessage('A South African identity number is 13 digits.'),
  validate,
  controller.create);

router.patch('/:number/status',
  authorize('case:update'),
  body('status').isIn(CASE_STATUSES).withMessage('That is not a recognised docket status.'),
  validate,
  controller.changeStatus);

router.patch('/:number/assign',
  authorize('case:assign'),
  body('detectiveId').isInt({ min: 1 }).withMessage('Choose a detective.'),
  validate,
  controller.assign);

router.post('/:number/notes',
  authorize('case:note'),
  body('body').trim().isLength({ min: 3 }).withMessage('Write the note before saving it.'),
  validate,
  controller.addNote);

module.exports = router;

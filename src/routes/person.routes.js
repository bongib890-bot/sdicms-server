/* ==========================================================================
   /api/v1/suspects and /api/v1/statements
   ========================================================================== */

const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/authorize');
const controller = require('../controllers/person.controller');
const { SUSPECT_STATUSES, STATEMENT_TYPES } = require('../config/constants');

const suspects = express.Router();
const statements = express.Router();

suspects.get('/', authorize('case:read'), controller.listSuspects);

suspects.post('/',
  authorize('suspect:create'),
  body('caseNumber').trim().notEmpty().withMessage('Choose the docket.'),
  body('fullName').trim().isLength({ min: 3 })
    .withMessage('Enter a name, or a description beginning "Unknown".'),
  body('status').optional().isIn(SUSPECT_STATUSES),
  body('idNumber').optional({ checkFalsy: true }).matches(/^\d{13}$/)
    .withMessage('A South African identity number is 13 digits.'),
  validate,
  controller.createSuspect);

statements.get('/', authorize('case:read'), controller.listStatements);

statements.post('/',
  authorize('statement:create'),
  body('caseNumber').trim().notEmpty().withMessage('Choose the docket.'),
  body('deponentName').trim().isLength({ min: 3 }).withMessage('Enter the deponent\'s full name.'),
  body('deponentType').isIn(STATEMENT_TYPES).withMessage('Choose the statement type.'),
  body('body').trim().isLength({ min: 10 })
    .withMessage('Record the account in the deponent\'s own words.'),
  validate,
  controller.createStatement);

statements.patch('/:id/sign', authorize('statement:create'), controller.signStatement);

module.exports = { suspects, statements };

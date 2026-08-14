/* ==========================================================================
   /api/v1/evidence
   ========================================================================== */

const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/authorize');
const { evidenceUpload } = require('../middleware/upload');
const controller = require('../controllers/evidence.controller');
const { EVIDENCE_TYPES } = require('../config/constants');

const router = express.Router();

router.get('/', authorize('evidence:read'), controller.list);
router.get('/:number', authorize('evidence:read'), controller.detail);
router.get('/:number/file', authorize('evidence:read'), controller.download);

// Multipart: multer must run before validation so req.body is populated.
router.post('/',
  authorize('evidence:create'),
  evidenceUpload,
  body('caseNumber').trim().notEmpty().withMessage('Choose the docket this exhibit belongs to.'),
  body('label').trim().isLength({ min: 3 }).withMessage('Describe the exhibit.'),
  body('evidenceType').isIn(EVIDENCE_TYPES).withMessage('Choose a listed exhibit type.'),
  body('storageLocation').trim().notEmpty().withMessage('Record where the exhibit is stored.'),
  validate,
  controller.create);

router.post('/:number/custody',
  authorize('evidence:custody'),
  body('toParty').trim().notEmpty().withMessage('Record who is receiving the exhibit.'),
  body('action').trim().notEmpty().withMessage('Record the reason for the transfer.'),
  validate,
  controller.transferCustody);

router.patch('/:number/verify', authorize('evidence:verify'), controller.verify);

module.exports = router;

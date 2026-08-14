/* ==========================================================================
   /api/v1/documents
   ========================================================================== */

const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/authorize');
const { documentUpload } = require('../middleware/upload');
const controller = require('../controllers/document.controller');

const router = express.Router();

router.get('/', authorize('document:read'), controller.list);
router.get('/:id/file', authorize('document:read'), controller.download);

router.post('/',
  authorize('document:create'),
  documentUpload,
  body('caseNumber').trim().notEmpty().withMessage('Choose the docket this document belongs to.'),
  body('title').trim().isLength({ min: 3 }).withMessage('Give the document a title.'),
  validate,
  controller.create);

module.exports = router;

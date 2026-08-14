/* ==========================================================================
   /api/v1/users
   ========================================================================== */

const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/authorize');
const controller = require('../controllers/user.controller');
const { ROLES } = require('../config/permissions');

const router = express.Router();

// Placed before /:id-style routes so "station-admins" is never mistaken
// for an id parameter.
router.get('/station-admins', authorize('admin:oversight'), controller.stationAdminOversight);

router.get('/', authorize('user:read'), controller.list);

router.post('/',
  authorize('user:create'),
  body('fullName').trim().isLength({ min: 3 }).withMessage('Enter the officer\'s full name.'),
  body('badgeNumber').trim().matches(/^[A-Z]{2}-\d{4}$/)
    .withMessage('Badge numbers follow the pattern SA-0000.'),
  body('email').isEmail().withMessage('Enter a valid service email.').normalizeEmail(),
  body('rankTitle').trim().notEmpty().withMessage('Enter a rank or job title.'),
  body('role').isIn(ROLES).withMessage('Choose a recognised role.'),
  // A Station Administrator's station is forced server-side to their own,
  // regardless of what is submitted here — so it is not required from them.
  body('stationId').custom((value, { req }) => {
    if (req.user && req.user.role === 'station_admin') return true;
    if (!Number.isInteger(Number(value)) || Number(value) < 1) {
      throw new Error('Choose a station.');
    }
    return true;
  }),
  validate,
  controller.create);

router.patch('/:id',
  authorize('user:update'),
  param('id').isInt(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(ROLES),
  body('status').optional().isIn(['active', 'flagged', 'suspended']),
  validate,
  controller.update);

router.post('/:id/reset-password',
  authorize('user:resetPassword'),
  param('id').isInt(),
  validate,
  controller.resetPassword);

module.exports = router;

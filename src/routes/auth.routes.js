/* ==========================================================================
   /api/v1/auth
   ========================================================================== */

const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { loginLimiter } = require('../middleware/rateLimiter');
const controller = require('../controllers/auth.controller');

const router = express.Router();

/**
 * Password policy. Deliberately about length and variety rather than a maze
 * of rules: long passphrases beat short complex ones.
 */
const passwordRules = (field) => body(field)
  .isLength({ min: 10 }).withMessage('Use at least 10 characters.')
  .matches(/[a-z]/).withMessage('Include a lower-case letter.')
  .matches(/[A-Z]/).withMessage('Include an upper-case letter.')
  .matches(/[0-9]/).withMessage('Include a digit.');

router.post('/login',
  loginLimiter,
  body('email').isEmail().withMessage('Enter the service email issued with your badge.').normalizeEmail(),
  body('password').notEmpty().withMessage('Enter your password.'),
  validate,
  controller.login);

router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);

router.post('/change-password',
  authenticate,
  body('currentPassword').notEmpty().withMessage('Enter your current password.'),
  passwordRules('newPassword'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('The two new passwords do not match.');
    return true;
  }),
  validate,
  controller.changePassword);

module.exports = router;

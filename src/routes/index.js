/* ==========================================================================
   API router
   Everything under /api/v1. Authentication is applied once here rather than
   route by route, so a new endpoint cannot accidentally ship unprotected.
   ========================================================================== */

const express = require('express');
const { body } = require('express-validator');

const authenticate = require('../middleware/authenticate');
const { authorize, withScope } = require('../middleware/authorize');
const validate = require('../middleware/validate');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const caseRoutes = require('./case.routes');
const evidenceRoutes = require('./evidence.routes');
const personRoutes = require('./person.routes');
const documentRoutes = require('./document.routes');
const misc = require('../controllers/misc.controller');

const router = express.Router();

/* --- Public ------------------------------------------------------------- */
router.get('/health', (req, res) => res.json({
  success: true,
  data: { status: 'ok', time: new Date().toISOString() }
}));

// Unauthenticated by design. Returns only national aggregate counts — no
// case titles, no names, no station-level breakdown, nothing that could
// identify a person or a docket. This is what the login screen's right-hand
// panel actually reads; without it, that panel had nothing real to show.
router.get('/public/overview', misc.publicOverview);

router.use('/auth', authRoutes);

/* --- Everything below requires a valid access token --------------------- */
router.use(authenticate, withScope);

router.get('/bootstrap', misc.bootstrap);

router.use('/users', userRoutes);
router.use('/cases', caseRoutes);
router.use('/evidence', evidenceRoutes);
router.use('/suspects', personRoutes.suspects);
router.use('/statements', personRoutes.statements);
router.use('/documents', documentRoutes);

router.get('/stations', authorize('station:read'), misc.listStations);
router.post('/stations',
  authorize('station:write'),
  body('code').trim().notEmpty().withMessage('Enter the station code.'),
  body('name').trim().notEmpty().withMessage('Enter the station name.'),
  body('province').trim().notEmpty().withMessage('Choose a province.'),
  validate,
  misc.createStation);

router.get('/audit', authorize('audit:read'), misc.listAudit);
router.get('/audit/verify', authorize('audit:read'), misc.verifyAudit);

router.get('/notifications', misc.listNotifications);
router.patch('/notifications/read', misc.markNotificationsRead);

router.get('/ai/insights', misc.listInsights);
router.patch('/ai/insights/:id', misc.resolveInsight);
router.post('/ai/ask',
  body('question').trim().isLength({ min: 2 }).withMessage('Type a question first.'),
  validate,
  misc.ask);

module.exports = router;

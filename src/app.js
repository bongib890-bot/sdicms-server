/* ==========================================================================
   Express application
   Exported without a listener so it can be imported directly by tests.
   ========================================================================== */

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const logger = require('./config/logger');
const requestContext = require('./middleware/requestContext');
const { globalLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

/* --- Security headers ----------------------------------------------------
   The frontend is served from this same origin, so the policy can be tight.
   Google Fonts is the only external origin allowed.                        */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'same-site' }
}));

/* --- CORS ----------------------------------------------------------------
   Same-origin in normal use. The allowance exists for running the frontend
   on a separate dev server; credentials are required for the refresh cookie. */
app.use(cors({
  origin: env.nodeEnv === 'production' ? env.appUrl : true,
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(requestContext);

/* --- Request log ---------------------------------------------------------- */
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.originalUrl.startsWith('/api')) {
      logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });
  next();
});

app.use('/api', globalLimiter);
app.use('/api/v1', routes);

/* --- Frontend ------------------------------------------------------------
   The single-page client is served from public/. Evidence and documents are
   NOT served statically: they live in storage/ outside the web root and are
   reachable only through an authenticated, audited controller.             */
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: 'index.html' }));

app.get('/app', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'app.html')));

app.use('/api', notFound);
app.use((req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.use(errorHandler);

module.exports = app;

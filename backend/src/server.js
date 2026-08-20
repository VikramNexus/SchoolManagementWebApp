/**
 * School Student & Fee Management System — Backend Server
 * Entry point for the Express REST API.
 *
 * Day 1: Project setup & architecture skeleton.
 * Later days wire in auth, settings, students, payments, receipts,
 * messaging, reports, and backup routes via src/routes/index.js.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Security Middleware
// ---------------------------------------------------------------------------

// Helmet for security headers (CSP, XSS protection, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration — permit mobile APKs (Capacitor/WebView) and Web clients
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman) or any client origin
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// Rate limiting for API endpoints (5 min window, 1000 requests max)
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});

// Stricter rate limit for auth endpoints (relaxed for local development)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // 100 attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for local development or auth verification endpoints
    return req.path === '/me' || req.path === '/verify';
  },
  message: {
    success: false,
    message: 'Too many login attempts, please try again in a moment.',
  },
});

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// Apply auth rate limiting to auth routes
app.use('/api/auth', authLimiter);

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging for audit trail
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`
      );
    }
  });
  next();
});

// ---------------------------------------------------------------------------
// Health & Keep-Alive Heartbeat endpoints
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'school-management-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get(['/ping', '/api/ping'], (req, res) => {
  res.status(200).send('pong');
});

// ---------------------------------------------------------------------------
// Mount API routers (auth, settings, students, payments, ...)
// ---------------------------------------------------------------------------
app.use('/api', apiRoutes);

// ---------------------------------------------------------------------------
// Static Web App Serving & SPA Fallback (Live Auto-Sync)
// ---------------------------------------------------------------------------
const frontendDist = path.join(__dirname, '../../frontend/dist');
const backendPublic = path.join(__dirname, '../public');
const staticDir = fs.existsSync(frontendDist) ? frontendDist : (fs.existsSync(backendPublic) ? backendPublic : null);

if (staticDir) {
  app.use(express.static(staticDir));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl === '/ping') {
      return next();
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'Aryavart School Management System API',
      docs: '/api/health',
    });
  });
}

// ---------------------------------------------------------------------------
// 404 handler for unknown API routes
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ---------------------------------------------------------------------------
// Central error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 100MB.',
    });
  }
  if (err.message && err.message.includes('Only .sql files')) {
    return res.status(400).json({
      success: false,
      message: 'Only .sql files are allowed for upload.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);

  // Initialize background WhatsApp companion gateway
  try {
    const { initWhatsAppGateway } = require('./services/localWhatsAppGateway');
    initWhatsAppGateway().catch((err) => console.error('[WhatsApp Gateway Startup]', err));
  } catch (err) {
    console.error('[WhatsApp Gateway Startup Error]', err);
  }
});

// Graceful shutdown for `node --watch` dev restarts and process signals
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;

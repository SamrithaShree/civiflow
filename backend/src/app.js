require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { limiter } = require('./middleware/rateLimiter');
const auditLog = require('./middleware/auditLog');

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const issuesRoutes = require('./modules/issues/issues.routes');
const assignmentsRoutes = require('./modules/assignments/assignments.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const wardsRoutes = require('./modules/wards/wards.routes');

// Workers
const { startSLAWorker } = require('./workers/slaWorker');

const app = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================
app.use(helmet());
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        // Exact match
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // Vercel preview branch support (allows any .vercel.app)
        if (origin.endsWith('.vercel.app')) return callback(null, true);

        // Reject instead of throwing error to prevent 500s
        callback(null, false);
    },
    credentials: true,
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files — set cross-origin header so the frontend can load images
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../uploads')));

// Audit logging
app.use(auditLog);

// ============================================================
// API ROUTES
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wards', wardsRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'CiviFlow API', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 5MB)' });
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🏛️  CiviFlow API running at http://localhost:${PORT}`);
    console.log('📋 Routes: /api/auth, /api/issues, /api/assignments, /api/analytics, /api/admin, /api/wards');

    // Start background workers
    startSLAWorker();
});

module.exports = app;

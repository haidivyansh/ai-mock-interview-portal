const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const { connectDB } = require('./config/db');

// Load environment variables first
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production set ALLOWED_ORIGIN=https://your-frontend-domain.com in .env
// Falls back to * for local development so the dev server always works.
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/interview', require('./routes/interview'));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'AI Mock Interview Portal API is running' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Catches any error thrown by route handlers (Express 5 forwards async errors automatically).
// Returns JSON instead of an HTML stack trace in production.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred.'
    : err.message || 'Internal Server Error';
  console.error('[Global Error Handler]', err.message);
  res.status(status).json({ message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

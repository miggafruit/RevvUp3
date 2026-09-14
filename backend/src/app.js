const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Sentry = require('./config/sentry');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const businessRoutes = require('./routes/businessRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const ehailingRoutes = require('./routes/ehailingRoutes');
const locationRoutes = require('./routes/locationRoutes');
const promotionRoutes = require('./routes/promotionRoutes'); // ✅ ADD THIS
const deliveryRoutes = require('./routes/deliveryRoutes'); // ✅ ADD THIS
const adminRoutes = require('./routes/adminRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');

const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimiter');
const { allowedOrigins } = require('./config/corsOrigins');

const app = express();

// Security headers (CSP, X-Frame-Options, HSTS, etc). Doesn't affect
// the mobile app at all (native HTTP clients don't enforce these),
// but matters for the two browser-based surfaces this API serves: the
// admin dashboard and the Expo web build.
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.get('/api/health', (req, res) => {
  // Previously always returned 200 regardless of whether the database
  // was actually reachable — meaning a load balancer or uptime monitor
  // using this endpoint would report "healthy" even while every real
  // request was failing on a dropped DB connection. readyState 1 is
  // Mongoose's "connected" state.
  const mongoose = require('mongoose');
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    db: dbConnected ? 'connected' : 'disconnected'
  });
});

app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/ehailing', ehailingRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/promotions', promotionRoutes); // ✅ ADD THIS
app.use('/api/deliveries', deliveryRoutes); // ✅ ADD THIS
app.use('/api/admin', adminRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/inquiries', inquiryRoutes);

app.use(notFound);
// Reports thrown/passed-to-next(err) errors to Sentry (no-ops if
// SENTRY_DSN isn't set — see config/sentry.js) before handing off to
// our own error handler below, which is what actually shapes the JSON
// response sent back to the client. Order matters: this has to sit
// between notFound and errorHandler, not before all routes.
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

module.exports = app;
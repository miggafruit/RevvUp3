const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
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

const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
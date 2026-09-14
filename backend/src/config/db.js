const mongoose = require('mongoose');
const Sentry = require('./sentry');

const connectDB = async () => {
  // Once connected, Mongoose auto-reconnects on a dropped connection
  // by default — but previously nothing was listening for that at
  // all, so a mid-session DB blip (network hiccup, Atlas failover,
  // etc.) was completely invisible: every request would just start
  // failing with generic 500s until someone happened to notice and go
  // digging through logs for a MongoNetworkError. These make it show
  // up as a Sentry event the moment it happens, and confirm in the
  // logs when it recovers.
  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
    Sentry.captureException(err, { tags: { area: 'mongodb-connection' } });
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected — Mongoose will attempt to reconnect automatically');
    Sentry.captureMessage('MongoDB disconnected', { level: 'warning', tags: { area: 'mongodb-connection' } });
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Reconnected');
  });

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // The process is about to exit anyway (this is the one case where
    // that's correct — a server that can't reach its database at boot
    // has nothing useful to do), but still worth a record in Sentry
    // that a deploy/restart failed and why, rather than only ever
    // being visible in whatever platform's raw startup logs.
    Sentry.captureException(error, { tags: { area: 'mongodb-connection', fatal: true } });
    await Sentry.close(2000);
    process.exit(1);
  }
};

module.exports = connectDB;

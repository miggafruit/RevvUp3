require('dotenv').config();
const validateEnv = require('./config/validateEnv');
validateEnv();

// Must be required before ./app (and everything ./app requires) so
// Sentry's instrumentation can wrap Node's http module from the start.
const Sentry = require('./config/sentry');

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const socketSetup = require('./config/socket');
const { allowedOrigins } = require('./config/corsOrigins');
 
const PORT = process.env.PORT || 5000;
 
// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
 
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});
 
// Make io accessible inside controllers via req.app.get('io')
app.set('io', io);
 
// Register all socket event handlers
socketSetup(io);

// Previously an uncaught exception or unhandled promise rejection
// anywhere in the app would just crash the process with a stack trace
// in stdout and nothing else — no record of it happening once the
// process restarted (and no restart at all if you're not running this
// under something like PM2/systemd that respawns crashed processes).
// These two handlers make sure Sentry gets the error before the
// process exits, and exit deliberately rather than leaving the
// process in an unknown state.
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
  Sentry.captureException(err);
  // Flush before exiting so the event actually reaches Sentry instead
  // of being dropped mid-send by process.exit.
  Sentry.close(2000).finally(() => process.exit(1));
});

// Connect DB then start server
connectDB().then(() => {
  server.listen(PORT, '0.0.0.0',() => {
    console.log(`Server running on port ${PORT}`);

    if (process.env.MATCHING_TEST_MODE === 'true') {
      console.warn('');
      console.warn('⚠️  ⚠️  ⚠️   MATCHING_TEST_MODE IS ON  ⚠️  ⚠️  ⚠️');
      console.warn('Driver matching is ignoring distance entirely — any online,');
      console.warn('capable driver anywhere will match any request. This is for');
      console.warn('local testing only. Remove MATCHING_TEST_MODE from your .env');
      console.warn('before publishing this app.');
      console.warn('');
    }
  });
});

// Graceful shutdown — previously the process had no shutdown handling
// at all, so a deploy/restart (most hosting platforms send SIGTERM
// before killing a container) would drop in-flight requests and the
// Mongo connection abruptly rather than finishing what was already in
// progress.
const shutdown = (signal) => {
  console.log(`\n[Shutdown] ${signal} received, closing gracefully...`);
  server.close(() => {
    console.log('[Shutdown] HTTP server closed');
    require('mongoose').connection.close(false).then(() => {
      console.log('[Shutdown] MongoDB connection closed');
      process.exit(0);
    });
  });
  // Don't hang forever waiting for connections to drain.
  setTimeout(() => {
    console.warn('[Shutdown] Forcing exit after timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
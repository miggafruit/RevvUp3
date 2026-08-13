require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const socketSetup = require('./config/socket');
 
const PORT = process.env.PORT || 5000;
 
// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
 
const io = new Server(server, {
  cors: {
    origin: '*', // tighten to your frontend URL in production
    methods: ['GET', 'POST'],
  },
});
 
// Make io accessible inside controllers via req.app.get('io')
app.set('io', io);
 
// Register all socket event handlers
socketSetup(io);
 
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
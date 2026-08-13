/**
 * Socket.IO configuration for the eHailing + delivery real-time systems.
 *
 * Room conventions:
 *   "drivers"          — all connected drivers join this room
 *   "client_<id>"      — client joins their personal room to receive updates
 *   "driver_<id>"      — driver joins their personal room for targeted messages
 *
 * Every connection is authenticated with the same JWT access token used
 * for REST calls (socket.handshake.auth.token) — previously
 * register_client/register_driver trusted whatever id the client sent,
 * meaning anyone could claim to be any client or driver and receive
 * (or send) updates meant for someone else. Room membership now comes
 * from the verified token, not from event payloads.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketSetup = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[Socket] Connected: ${socket.id} (user ${user._id})`);

    // Every socket joins its own personal room, and anyone eligible for
    // either delivery (isDriver) or roadside dispatch (roadsideServices)
    // additionally joins "drivers" + their own driver_<id> room — both
    // derived from the verified token, not a client-supplied payload.
    // Checking only isDriver here would mean a pure roadside responder
    // (isDriver: false, roadsideServices: ['towing']) never joins
    // driver_<id> at all, so ehailingController's new_request emit to
    // that room would silently never reach them.
    socket.join(`client_${user._id}`);
    const isDispatchEligible = user.isDriver || (user.roadsideServices && user.roadsideServices.length > 0);
    if (isDispatchEligible) {
      socket.join('drivers');
      socket.join(`driver_${user._id}`);
    }

    // ─── DRIVER LOCATION BROADCAST (eHailing rides) ───────────────────────────
    // request_id/client_id still come from the payload (they identify
    // *which ride* this update is for, not *who* is sending it — that
    // part is already known from socket.data.user).
    socket.on('driver_location', ({ request_id, client_id, latitude, longitude }) => {
      io.to(`client_${client_id}`).emit('driver_location_update', {
        request_id,
        latitude,
        longitude
      });
    });

    // ─── DRIVER LOCATION BROADCAST (deliveries) ───────────────────────────────
    // Same pattern as driver_location above, kept as a separate event so
    // ride-tracking and delivery-tracking clients never cross-receive updates
    // meant for the other.
    socket.on('delivery_location', ({ delivery_id, client_id, latitude, longitude }) => {
      io.to(`client_${client_id}`).emit('delivery_location_update', {
        delivery_id,
        latitude,
        longitude
      });
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
};

module.exports = socketSetup;

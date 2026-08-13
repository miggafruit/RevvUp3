const Ride = require('../models/Ride');
const User = require('../models/User');
const { getDistanceAndDuration } = require('../utils/distance');
const { estimateTowFare, estimateCalloutFare } = require('../config/pricing');
const { findNearbyAvailableDrivers } = require('../utils/matching');
const { verifyPaystackTransaction } = require('../utils/paystack');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { clientRoomId } = require('../utils/socketHelpers');
const { createPayoutEntry } = require('../utils/payouts');

const TOW_SERVICE_TYPES = ['tow_sling', 'tow_rollback'];

/**
 * CLIENT: Create a new roadside/eHailing request
 * POST /api/ehailing/request
 */
const createRequest = async (req, res, next) => {
  try {
    const {
      service_type,
      location,
      destination,
      transmission_type,
      is_accident_scene,
      vehicle_details,
      issue_description,
      for_someone_else,
      beneficiary_name,
      beneficiary_phone
    } = req.body;

    if (!service_type || !location?.address || location?.latitude == null || location?.longitude == null) {
      return res.status(400).json({
        success: false,
        message: 'service_type and a location with address, latitude, and longitude are required.'
      });
    }

    // Roadside/tow is necessarily pay-after — you can't prepay a tow
    // truck for work that hasn't happened yet, unlike a marketplace
    // order. But nothing was stopping a client from requesting job
    // after job while leaving every previous one unpaid. This doesn't
    // require prepayment (that would be the wrong fix for this kind of
    // service); it just requires settling up before starting a new one.
    const unpaidCompletedRide = await Ride.findOne({
      client: req.user._id,
      status: 'completed',
      paymentStatus: { $ne: 'paid' }
    });
    if (unpaidCompletedRide) {
      return res.status(400).json({
        success: false,
        message: 'You have a completed request that still needs to be paid before you can make a new one.',
        unpaidRequestId: unpaidCompletedRide._id
      });
    }

    // Mapped explicitly rather than passed through as-is: the request
    // body uses license_plate (matching the mobile form field name),
    // but the schema uses licensePlate (matching User.vehicleDetails'
    // convention) — passing the raw object through would have Mongoose
    // silently drop the unrecognized field, losing the plate entirely.
    const mappedVehicleDetails = vehicle_details
      ? {
          make: vehicle_details.make,
          model: vehicle_details.model,
          licensePlate: vehicle_details.license_plate
        }
      : undefined;

    const isTow = TOW_SERVICE_TYPES.includes(service_type);
    let fare;
    let distanceKm;

    if (isTow) {
      // A tow works exactly like an Uber/Bolt request — pickup point to
      // delivery point, both known upfront, so (unlike the other
      // roadside services below) the fare is real and final right now,
      // not an estimate deferred to whichever driver happens to accept.
      if (!destination?.address || destination?.latitude == null || destination?.longitude == null) {
        return res.status(400).json({
          success: false,
          message: 'A delivery point (destination) is required for a tow request.'
        });
      }
      if (!['manual', 'automatic'].includes(transmission_type)) {
        return res.status(400).json({
          success: false,
          message: 'transmission_type must be "manual" or "automatic" for a tow request.'
        });
      }
      // Enforced server-side regardless of what the mobile UI allows —
      // a sling truck cannot physically tow an automatic car.
      if (service_type === 'tow_sling' && transmission_type === 'automatic') {
        return res.status(400).json({
          success: false,
          message: 'A sling truck can only tow manual-transmission vehicles. Please request a Rollback instead.'
        });
      }

      const distanceResult = await getDistanceAndDuration(location, destination);
      distanceKm = distanceResult.distanceKm;
      fare = estimateTowFare(service_type, distanceKm).fare;
    }

    const ride = await Ride.create({
      client: req.user._id,
      serviceType: service_type,
      location,
      destination: isTow ? destination : undefined,
      transmissionType: isTow ? transmission_type : undefined,
      isAccidentScene: isTow ? !!is_accident_scene : false,
      vehicleDetails: mappedVehicleDetails,
      issueDescription: issue_description || '',
      forSomeoneElse: !!for_someone_else,
      beneficiaryName: beneficiary_name,
      beneficiaryPhone: beneficiary_phone,
      distanceKm,
      fare,
      status: 'pending'
    });

    // Broadcast to nearby available drivers only, not every connected
    // driver everywhere — same room convention as before ("drivers"),
    // but the prototype broadcast to literally everyone regardless of
    // distance. Real matching lands here instead.
    const nearbyDrivers = await findNearbyAvailableDrivers(location, 15, service_type);
    const populatedRide = await Ride.findById(ride._id).populate('client', 'name phone pushToken');
    const io = req.app.get('io');
    if (io) {
      nearbyDrivers.forEach((driver) => {
        io.to(`driver_${driver._id}`).emit('new_request', populatedRide);
      });
    }

    // Push covers what the socket can't — a driver whose app is
    // backgrounded or closed still gets notified. Sent to everyone
    // matched, same audience as the socket broadcast above, not sent
    // synchronously blocking the response since a push failure should
    // never delay or break the actual request creation.
    sendPushNotifications(nearbyDrivers, {
      title: 'New job request',
      body: `A ${service_type.replace('_', ' ')} request just came in near you.`,
      data: { type: 'new_request', rideId: String(ride._id) }
    });

    return res.status(201).json({ success: true, data: populatedRide });
  } catch (error) {
    next(error);
  }
};

/**
 * DRIVER: Get all pending requests (fallback for polling / missed socket events)
 * GET /api/ehailing/requests/pending
 */
/**
 * CLIENT: Preview the fare for a tow before actually requesting one —
 * same as Uber/Bolt showing you a price before you commit. Pure
 * calculation, no Ride is created here.
 * GET /api/ehailing/estimate/tow?service_type=&pickupLat=&pickupLng=&destLat=&destLng=&transmission_type=
 */
const getTowEstimate = async (req, res, next) => {
  try {
    const { service_type, pickupLat, pickupLng, destLat, destLng, transmission_type } = req.query;

    if (!TOW_SERVICE_TYPES.includes(service_type)) {
      return res.status(400).json({ success: false, message: 'service_type must be tow_sling or tow_rollback.' });
    }
    if ([pickupLat, pickupLng, destLat, destLng].some((v) => v == null)) {
      return res.status(400).json({ success: false, message: 'Pickup and destination coordinates are required.' });
    }
    if (!['manual', 'automatic'].includes(transmission_type)) {
      return res.status(400).json({ success: false, message: 'transmission_type must be "manual" or "automatic".' });
    }
    if (service_type === 'tow_sling' && transmission_type === 'automatic') {
      return res.status(400).json({
        success: false,
        message: 'A sling truck can only tow manual-transmission vehicles. Please request a Rollback instead.'
      });
    }

    const { distanceKm, durationMinutes } = await getDistanceAndDuration(
      { latitude: Number(pickupLat), longitude: Number(pickupLng) },
      { latitude: Number(destLat), longitude: Number(destLng) }
    );
    const { tier, fare } = estimateTowFare(service_type, distanceKm);

    return res.json({ success: true, data: { distanceKm, durationMinutes, tier, fare } });
  } catch (error) {
    next(error);
  }
};

const getPendingRequests = async (req, res, next) => {
  try {
    // Only show jobs this account actually offers — same filtering the
    // socket broadcast in createRequest already applies. Without this,
    // the polling fallback would let a driver see (and potentially
    // accept) e.g. a towing job even if they never listed towing as a
    // service they offer.
    const offeredServices = req.user.roadsideServices || [];
    if (offeredServices.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const pending = await Ride.find({ status: 'pending', serviceType: { $in: offeredServices } })
      .sort({ createdAt: -1 })
      .populate('client', 'name phone pushToken');
    return res.json({ success: true, data: pending });
  } catch (error) {
    next(error);
  }
};

/**
 * DRIVER: Accept a request
 * POST /api/ehailing/request/:id/accept
 */
const acceptRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const ride = await Ride.findById(id).populate('client', 'name phone pushToken');
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (ride.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Request already taken.' });
    }

    // Matching already filters by kycStatus: 'approved' — this is a
    // second check, not the only one, for anyone who reaches this
    // endpoint some other way (a stale cached list, a direct API call)
    // rather than trusting that the driver in front of us was actually
    // in the matched set.
    if (req.user.kycStatus !== 'approved') {
      return res.status(403).json({ success: false, message: 'Your account needs to complete verification before accepting jobs.' });
    }

    // Tow requests are already fully priced — fare was computed at
    // request time using pickup-to-destination distance, known upfront
    // just like an Uber/Bolt fare. Recomputing it here using
    // driver-to-client distance would be wrong (that's not what a tow
    // is priced on) and would silently overwrite the real fare the
    // client already saw before requesting.
    const isTow = TOW_SERVICE_TYPES.includes(ride.serviceType);

    // The distance that determines the fare for non-tow services is
    // driver-to-client — not knowable until now, since which driver
    // accepts wasn't known when the request was created. Prefer fresh
    // GPS sent in the request body (the mobile app captures this at the
    // moment of accepting) over the stored User.currentLocation, which
    // defaults to [0,0] until a driver has ever called
    // updateDriverLocation — trusting only the stored value would
    // silently compute fare from Null Island on a driver's very first
    // accept.
    const bodyLocation = req.body.driver_location;
    const driverLocation =
      bodyLocation?.latitude != null && bodyLocation?.longitude != null
        ? { latitude: bodyLocation.latitude, longitude: bodyLocation.longitude }
        : req.user.currentLocation && req.user.currentLocation.coordinates.some((c) => c !== 0)
          ? { latitude: req.user.currentLocation.coordinates[1], longitude: req.user.currentLocation.coordinates[0] }
          : null;

    let distanceKm;
    let fare;
    if (!isTow && driverLocation) {
      const estimate = await getDistanceAndDuration(driverLocation, ride.location);
      distanceKm = estimate.distanceKm;
      fare = estimateCalloutFare(distanceKm);

      // Keep the driver's own User document current too, since this is
      // the freshest location we have for them.
      await User.findByIdAndUpdate(req.user._id, {
        currentLocation: { type: 'Point', coordinates: [driverLocation.longitude, driverLocation.latitude] }
      });
    } else if (driverLocation) {
      // Still worth updating the driver's stored location for a tow
      // acceptance, just without letting it touch the fare.
      await User.findByIdAndUpdate(req.user._id, {
        currentLocation: { type: 'Point', coordinates: [driverLocation.longitude, driverLocation.latitude] }
      });
    }

    // Driver identity comes from the authenticated session, never from
    // the request body — the prototype trusted client-supplied
    // driver_name/driver_phone, which meant anyone could claim to be
    // any driver.
    ride.status = 'accepted';
    ride.driver = {
      driver_id: req.user._id,
      driver_name: req.user.name,
      driver_phone: req.user.phone,
      driver_vehicle: req.user.vehicleDetails
        ? `${req.user.vehicleDetails.make || ''} ${req.user.vehicleDetails.model || ''}`.trim()
        : undefined,
      driver_location: driverLocation || undefined
    };
    if (distanceKm !== undefined) ride.distanceKm = distanceKm;
    if (fare !== undefined) ride.fare = fare;
    ride.acceptedAt = new Date();
    await ride.save();

    await User.findByIdAndUpdate(req.user._id, { isAvailable: false });

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${clientRoomId(ride)}`).emit('request_accepted', ride);
      io.to('drivers').emit('request_taken', { request_id: id });
    }

    sendPushNotifications([ride.client], {
      title: 'Driver on the way',
      body: `${req.user.name} accepted your request and is heading your way.`,
      data: { type: 'request_accepted', rideId: id }
    });

    return res.json({ success: true, data: ride });
  } catch (error) {
    next(error);
  }
};

/**
 * DRIVER: Update location (called periodically while en-route)
 * POST /api/ehailing/request/:id/location
 */
const updateDriverLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required.' });
    }

    const ride = await Ride.findById(id).populate('client', 'name phone pushToken');
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (!ride.driver?.driver_id || String(ride.driver.driver_id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You're not the assigned driver for this request." });
    }

    ride.driver.driver_location = { latitude, longitude };
    await ride.save();

    // Keep the driver's own User document current too, so the next
    // ride-matching query reflects where they actually are.
    await User.findByIdAndUpdate(req.user._id, {
      currentLocation: { type: 'Point', coordinates: [longitude, latitude] }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${clientRoomId(ride)}`).emit('driver_location_update', {
        request_id: id,
        latitude,
        longitude
      });
    }

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * DRIVER: Mark request as in-progress (driver arrived / trip underway)
 * POST /api/ehailing/request/:id/arrived
 */
const markArrived = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ride = await Ride.findById(id).populate('client', 'name phone pushToken');
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (!ride.driver?.driver_id || String(ride.driver.driver_id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You're not the assigned driver for this request." });
    }
    if (ride.status !== 'accepted') {
      return res.status(409).json({ success: false, message: `Can't mark arrived from status "${ride.status}".` });
    }

    ride.status = 'in_progress';
    ride.startedAt = new Date();
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${clientRoomId(ride)}`).emit('driver_arrived', { request_id: id });
    }

    sendPushNotifications([ride.client], {
      title: 'Your driver has arrived',
      body: 'They should be with you shortly.',
      data: { type: 'driver_arrived', rideId: id }
    });

    return res.json({ success: true, data: ride });
  } catch (error) {
    next(error);
  }
};

/**
 * DRIVER: Complete the request
 * POST /api/ehailing/request/:id/complete
 */
const completeRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ride = await Ride.findById(id).populate('client', 'name phone pushToken');
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (!ride.driver?.driver_id || String(ride.driver.driver_id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You're not the assigned driver for this request." });
    }
    if (ride.status !== 'in_progress') {
      return res.status(409).json({ success: false, message: `Can't complete from status "${ride.status}".` });
    }

    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save();

    await User.findByIdAndUpdate(req.user._id, { isAvailable: true });

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${clientRoomId(ride)}`).emit('request_completed', { request_id: id, fare: ride.fare });
    }

    sendPushNotifications([ride.client], {
      title: 'Job completed',
      body: ride.fare ? `Your request is done — R${ride.fare} due.` : 'Your request is done.',
      data: { type: 'request_completed', rideId: id }
    });

    return res.json({ success: true, data: ride });
  } catch (error) {
    next(error);
  }
};

/**
 * CLIENT or DRIVER: Cancel a request
 * POST /api/ehailing/request/:id/cancel
 */
const cancelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ride = await Ride.findById(id).populate('client', 'name phone pushToken');
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });

    const isClientOwner = clientRoomId(ride) === String(req.user._id);
    const isAssignedDriver = ride.driver?.driver_id && String(ride.driver.driver_id) === String(req.user._id);

    if (!isClientOwner && !isAssignedDriver) {
      return res.status(403).json({ success: false, message: "You're not part of this request." });
    }
    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(409).json({ success: false, message: `Can't cancel from status "${ride.status}".` });
    }

    ride.status = 'cancelled';
    ride.cancelledBy = isClientOwner ? 'client' : 'driver';
    ride.cancelReason = req.body.reason;
    await ride.save();

    if (isAssignedDriver) {
      await User.findByIdAndUpdate(req.user._id, { isAvailable: true });
    }

    const io = req.app.get('io');
    if (io) {
      io.to('drivers').emit('request_cancelled', { request_id: id });
      if (ride.driver?.driver_id) {
        io.to(`driver_${ride.driver.driver_id}`).emit('assigned_request_cancelled', { request_id: id });
      }
      io.to(`client_${clientRoomId(ride)}`).emit('assigned_request_cancelled', { request_id: id });
    }

    // Only notify whichever party didn't cancel it themselves — a push
    // telling you your own action just happened is just noise.
    if (isClientOwner && ride.driver?.driver_id) {
      const driverUser = await User.findById(ride.driver.driver_id).select('pushToken');
      sendPushNotifications([driverUser], {
        title: 'Request cancelled',
        body: 'The client cancelled this request.',
        data: { type: 'request_cancelled', rideId: id }
      });
    } else if (isAssignedDriver) {
      sendPushNotifications([ride.client], {
        title: 'Request cancelled',
        body: 'Your driver had to cancel. Feel free to request again.',
        data: { type: 'request_cancelled', rideId: id }
      });
    }

    return res.json({ success: true, data: ride });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single request by ID (for polling) — participant-only.
 * GET /api/ehailing/request/:id
 */
const getRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ride = await Ride.findById(id).populate('client', 'name phone pushToken');
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });

    const isClientOwner = clientRoomId(ride) === String(req.user._id);
    const isAssignedDriver = ride.driver?.driver_id && String(ride.driver.driver_id) === String(req.user._id);
    if (!isClientOwner && !isAssignedDriver) {
      return res.status(403).json({ success: false, message: "You're not part of this request." });
    }

    return res.json({ success: true, data: ride });
  } catch (error) {
    next(error);
  }
};

/**
 * CLIENT or DRIVER: Ride request history — whichever rides this account
 * was actually part of, either as the requester or the assigned
 * responder. Deliberately not branching on isDriver/roadsideServices:
 * those are eligibility flags for new jobs, not a reliable signal for
 * which past rides someone participated in (a pure roadside responder
 * has isDriver: false but can still have a driver-side history).
 * GET /api/ehailing/history
 */
const getHistory = async (req, res, next) => {
  try {
    const rides = await Ride.find({
      $or: [{ client: req.user._id }, { 'driver.driver_id': req.user._id }]
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('client', 'name phone pushToken');
    return res.json({ success: true, data: rides });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/ehailing/request/:id/pay
// @access  Private (client only, must own the ride)
// body: { paymentReference }
// Only usable once the job is completed — same guard payOrder uses for
// orders ("the seller has not accepted this order yet"), adapted: you
// can't pay for roadside help that hasn't actually happened yet. This
// mirrors orderController.payOrder's verification pattern exactly
// (verify via Paystack, check status, check amount matches), since
// there's no reason ride payment should behave differently from order
// payment on the same backend.
const payRide = async (req, res, next) => {
  try {
    const { paymentReference } = req.body;
    if (!paymentReference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });

    if (ride.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You do not have permission to pay for this request' });
    }
    if (ride.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'This request has not been completed yet' });
    }
    if (ride.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'This request has already been paid' });
    }
    if (!ride.fare) {
      return res.status(400).json({ success: false, message: 'This request has no fare recorded' });
    }

    let verification;
    try {
      verification = await verifyPaystackTransaction(paymentReference);
    } catch (verifyError) {
      console.error('Paystack verification request failed:', verifyError?.response?.data || verifyError.message);
      return res.status(402).json({ success: false, message: 'Could not verify payment. Please try again.' });
    }

    if (!verification || verification.status !== 'success') {
      return res.status(402).json({ success: false, message: 'Payment was not successful' });
    }

    // See orderController.payOrder for why this check exists — amount
    // matching alone doesn't stop a real reference being replayed
    // against an unrelated ride of the same fare.
    if (verification.metadata?.rideId !== ride._id.toString()) {
      return res.status(402).json({ success: false, message: 'This payment reference does not match this request.' });
    }

    const expectedAmountInCents = Math.round(ride.fare * 100);
    if (verification.amount !== expectedAmountInCents) {
      return res.status(402).json({ success: false, message: "Payment amount does not match this request's fare" });
    }

    ride.paymentStatus = 'paid';
    ride.paymentMethod = 'paystack';
    ride.paymentReference = paymentReference;
    await ride.save();

    if (ride.driver?.driver_id) {
      await createPayoutEntry({
        recipient: ride.driver.driver_id,
        amount: ride.fare,
        sourceType: 'ride_fare',
        sourceId: ride._id
      });
    }

    return res.status(200).json({ success: true, data: ride });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/ehailing/request/:id/pay-cash
// @access  Private (client only, must own the ride)
// Marks a completed ride as paid by cash — no verification is possible
// here the way Paystack lets us verify a real transaction, since cash
// changes hands outside the app entirely. This is a record-keeping
// action, not a payment-processing one: the client is declaring cash
// was handed over, not proving it.
const payCash = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });

    if (ride.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You do not have permission to pay for this request' });
    }
    if (ride.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'This request has not been completed yet' });
    }
    if (ride.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'This request has already been paid' });
    }
    if (!ride.fare) {
      return res.status(400).json({ success: false, message: 'This request has no fare recorded' });
    }

    ride.paymentStatus = 'paid';
    ride.paymentMethod = 'cash';
    await ride.save();

    // Deliberately no payout entry here, unlike payRide — cash goes
    // directly from client to driver, in person. The platform never
    // touches this money, so it owes the driver nothing for it. A
    // payout entry would incorrectly claim the platform still owes
    // money it never actually collected.
    return res.status(200).json({ success: true, data: ride });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRequest,
  getTowEstimate,
  getPendingRequests,
  acceptRequest,
  updateDriverLocation,
  markArrived,
  completeRequest,
  cancelRequest,
  getRequest,
  getHistory,
  payRide,
  payCash
};

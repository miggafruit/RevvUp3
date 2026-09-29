const Ride = require('../models/Ride');
const User = require('../models/User');
const { getDistanceAndDuration } = require('../utils/distance');
const { haversineDistanceKm } = require('../utils/geo');
const { estimateTowFare, estimateCalloutFare } = require('../config/pricing');
const { findNearbyAvailableDrivers } = require('../utils/matching');
const { verifyPaystackTransaction } = require('../utils/paystack');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { clientRoomId } = require('../utils/socketHelpers');
const { createPayoutEntry } = require('../utils/payouts');
const { amountMatchesExpected } = require('../utils/paymentVerification');
const { reportSilentFailure } = require('../utils/reportSilentFailure');

const TOW_SERVICE_TYPES = ['tow_sling', 'tow_rollback'];

/**
 * Actually notifies drivers a request exists — socket broadcast + push
 * notification. Only ever called once payment has succeeded (from
 * payRide), never from createRequest directly, which is the whole
 * mechanism behind "a request can only be sent once payment is
 * successful." Re-queries availability fresh at call time rather than
 * reusing whoever was online back when the ride was first priced —
 * payment can take the client a minute or two, so who's actually online
 * now may have changed. If literally nobody is available by the time
 * payment clears, this just dispatches to an empty list; the ride still
 * sits in 'pending' and any driver who opens their app afterward will
 * still see it via the polling fallback in getPendingRequests, so a
 * paid ride is never silently stranded.
 */
const dispatchToNearbyDrivers = async (ride, io) => {
  const nearbyDrivers = await findNearbyAvailableDrivers(ride.location, 15, ride.serviceType);

  if (io) {
    nearbyDrivers.forEach((driver) => {
      io.to(`driver_${driver._id}`).emit('new_request', ride);
    });
  }

  sendPushNotifications(nearbyDrivers, {
    title: 'New job request',
    body: `A ${ride.serviceType.replace('_', ' ')} request just came in near you.`,
    data: { type: 'new_request', rideId: String(ride._id) }
  });
};

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

    // Card-payment-before-dispatch (see below) replaces the old "settle
    // your last unpaid completed ride first" guard entirely — a ride
    // can no longer reach 'completed' without already being paid, since
    // payment is now required before a driver ever sees the request at
    // all. What can still pile up is a ride sitting in
    // 'awaiting_payment' if someone abandons the payment step, so that's
    // what's actually guarded against now: one unfinished request at a
    // time, not one unpaid one.
    const unfinishedRide = await Ride.findOne({
      client: req.user._id,
      status: 'awaiting_payment'
    });
    if (unfinishedRide) {
      return res.status(400).json({
        success: false,
        message: 'You already have a request waiting on payment. Complete or cancel it before making a new one.',
        unfinishedRequestId: unfinishedRide._id
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
      // delivery point, both known upfront, so the fare is real and
      // final right now, not an estimate deferred to whichever driver
      // happens to accept.
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

    // Checked for every service type now, before the ride is even
    // created — previously a client could pay for a callout with
    // literally nobody online to respond to it, and only find that out
    // after handing over their card details. This is also what prices
    // a callout: the same way Uber shows you a fare before you request
    // based on nearby driver positions, the nearest currently-available
    // responder's distance is what the flat-plus-per-km callout rate is
    // computed against, rather than waiting to know which specific
    // driver ultimately accepts.
    const nearbyDrivers = await findNearbyAvailableDrivers(location, 15, service_type);
    if (nearbyDrivers.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'No one is available for this service near you right now. Please try again shortly.'
      });
    }

    if (!isTow) {
      const nearest = nearbyDrivers.find((d) => d.currentLocation?.coordinates);
      distanceKm = nearest
        ? haversineDistanceKm(location, {
            latitude: nearest.currentLocation.coordinates[1],
            longitude: nearest.currentLocation.coordinates[0]
          })
        : 0;
      fare = estimateCalloutFare(distanceKm);
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
      status: 'awaiting_payment'
    });

    // Deliberately NOT dispatched yet — no socket broadcast, no push
    // notification to drivers. That only happens once payment actually
    // succeeds (see payRide), which is the entire point: a driver
    // should never see, and can never accept, a request that hasn't
    // been paid for.
    const populatedRide = await Ride.findById(ride._id).populate('client', 'name phone pushToken');
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

// @route   PATCH /api/ehailing/availability
// @access  Private (service_provider only)
// body: { isOnline: boolean }
//
// This is the piece that was entirely missing: isOnline/isAvailable
// both default to false on every User, and until this endpoint
// existed, NOTHING anywhere ever set isOnline to true — meaning
// findNearbyAvailableDrivers (used for both the real-time socket
// "new_request" broadcast and the "New job request" push
// notification in createRequest) could never match a single driver,
// ever, regardless of how many were using the app. The
// accept/complete/cancel handlers below already correctly toggle
// isAvailable during a job's lifecycle — this is just the missing
// "start of shift" / "end of shift" switch that lets a driver enter
// that lifecycle in the first place.
//
// Going online sets both flags true (a driver who's just started
// their shift and never done a job yet has no other way to become
// isAvailable — nothing else would ever set it for them). Going
// offline sets both false, so an offline driver can never accidentally
// still match a nearby-driver query.
const setAvailability = async (req, res, next) => {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isOnline (boolean) is required.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isOnline, isAvailable: isOnline },
      { new: true }
    ).select('isOnline isAvailable');

    return res.json({ success: true, data: { isOnline: user.isOnline, isAvailable: user.isAvailable } });
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

    // Driver's current location is still worth capturing for live
    // tracking, but the fare itself must NOT be touched here anymore.
    // Under the pay-before-dispatch model, the client already paid an
    // exact amount before this job was ever dispatched (see
    // createRequest/payRide) — recomputing it against whichever
    // specific driver happens to accept would silently replace the
    // amount actually charged with a different number, which is
    // exactly the kind of mismatch that would make the platform pay a
    // driver more (or less) than it actually collected. The fare is
    // locked in at request time now, full stop.
    const bodyLocation = req.body.driver_location;
    const driverLocation =
      bodyLocation?.latitude != null && bodyLocation?.longitude != null
        ? { latitude: bodyLocation.latitude, longitude: bodyLocation.longitude }
        : req.user.currentLocation && req.user.currentLocation.coordinates.some((c) => c !== 0)
          ? { latitude: req.user.currentLocation.coordinates[1], longitude: req.user.currentLocation.coordinates[0] }
          : null;

    if (driverLocation) {
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

    // Payment already happened before this job was ever dispatched
    // (see createRequest/payRide) — this is now the moment the driver
    // has actually earned it, so the payout entry is created here
    // instead of at payment time. Crediting it at payment time would
    // have meant paying a driver for a job that could still be
    // cancelled or abandoned before completion.
    if (ride.driver?.driver_id) {
      await createPayoutEntry({
        recipient: ride.driver.driver_id,
        amount: ride.fare,
        sourceType: 'ride_fare',
        sourceId: ride._id
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${clientRoomId(ride)}`).emit('request_completed', { request_id: id, fare: ride.fare });
    }

    sendPushNotifications([ride.client], {
      title: 'Job completed',
      body: 'Your request is done — thanks for using RevvUp!',
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
        io.to(`driver_${ride.driver.driver_id}`).emit('assigned_request_cancelled', {
          request_id: id,
          cancelledBy: ride.cancelledBy
        });
      }
      // Only tell the client if they weren't the one who cancelled —
      // previously this fired unconditionally, including back at the
      // client who'd just cancelled their own request. Because the
      // socket emit happens here, before this HTTP response is even
      // sent, that event could arrive at the client's app before its
      // own cancelRequest() call resolves — a genuine race, not a
      // theoretical one — which meant a client cancelling their own
      // request could see a confusing "Your driver had to cancel this
      // request" alert about their own action.
      if (!isClientOwner) {
        io.to(`client_${clientRoomId(ride)}`).emit('assigned_request_cancelled', {
          request_id: id,
          cancelledBy: ride.cancelledBy
        });
      }
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
// This is the actual "request can only be sent once payment succeeds"
// mechanism: the ride was created in 'awaiting_payment' with no driver
// ever notified (see createRequest) — only once this verifies a real,
// successful Paystack charge does the ride flip to 'pending' and
// actually get dispatched. Mirrors orderController.payOrder's
// verification pattern (verify via Paystack, check status, check
// amount matches) since there's no reason ride payment should behave
// differently from order payment on the same backend.
const payRide = async (req, res, next) => {
  try {
    const { paymentReference } = req.body;
    if (!paymentReference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    const ride = await Ride.findById(req.params.id).populate('client', 'name phone pushToken');
    if (!ride) return res.status(404).json({ success: false, message: 'Request not found.' });

    if (ride.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You do not have permission to pay for this request' });
    }
    if (ride.status !== 'awaiting_payment') {
      return res.status(400).json({ success: false, message: 'This request is not awaiting payment.' });
    }
    if (!ride.fare) {
      return res.status(400).json({ success: false, message: 'This request has no fare recorded' });
    }

    let verification;
    try {
      verification = await verifyPaystackTransaction(paymentReference);
    } catch (verifyError) {
      console.error('Paystack verification request failed:', verifyError?.response?.data || verifyError.message);
      reportSilentFailure(verifyError, 'paystack-verification', {
        rideId: ride._id.toString(),
        paymentReference
      });
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

    if (!amountMatchesExpected(verification.amount, ride.fare)) {
      return res.status(402).json({ success: false, message: "Payment amount does not match this request's fare" });
    }

    ride.paymentStatus = 'paid';
    ride.paymentMethod = 'paystack';
    ride.paymentReference = paymentReference;
    ride.status = 'pending';
    await ride.save();

    const io = req.app.get('io');
    await dispatchToNearbyDrivers(ride, io);

    return res.status(200).json({ success: true, data: ride });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRequest,
  getTowEstimate,
  setAvailability,
  getPendingRequests,
  acceptRequest,
  updateDriverLocation,
  markArrived,
  completeRequest,
  cancelRequest,
  getRequest,
  getHistory,
  payRide
};

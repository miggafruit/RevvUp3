// src/routes/ehailingRoutes.js
const express = require("express");
const router = express.Router();
const {
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
  payCash,
} = require("../controllers/ehailingController");
const { protect } = require("../middleware/authMiddleware");

// Every e-hailing route requires a logged-in user — the prototype had
// none of this wired up, meaning any unauthenticated request could
// create, accept, or cancel rides. Role-level checks (client vs.
// isDriver) happen inside each controller function, since the same
// User can technically flip roles later and req.user is what's used
// to derive identity rather than anything client-supplied.
router.use(protect);

// CLIENT routes
router.post("/request", createRequest);                         // Create a new request
router.get("/estimate/tow", getTowEstimate);                     // Preview tow fare before requesting
router.get("/request/:id", getRequest);                         // Poll request status
router.post("/request/:id/cancel", cancelRequest);               // Client (or assigned driver) cancels
router.post("/request/:id/pay", payRide);                         // Client pays once completed
router.post("/request/:id/pay-cash", payCash);                    // Client marks paid by cash
router.get("/history", getHistory);                              // Past requests (client or driver)

// DRIVER routes
router.get("/requests/pending", getPendingRequests);             // List open jobs
router.post("/request/:id/accept", acceptRequest);                // Driver accepts
router.post("/request/:id/location", updateDriverLocation);       // Driver broadcasts location
router.post("/request/:id/arrived", markArrived);                 // Driver marks arrived
router.post("/request/:id/complete", completeRequest);            // Driver completes job

module.exports = router;

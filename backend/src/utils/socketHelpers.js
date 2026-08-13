// Shared across any controller that needs to target a client's socket
// room. `ride.client` (or a Delivery's equivalent) may or may not be
// populated depending on the query that fetched it — using it directly
// in a template literal silently produces garbage for a populated
// Mongoose document (it doesn't stringify to just the id), which
// caused a real bug once already (see ehailingController.js history).
// This always resolves to the real id string either way.
const clientRoomId = (doc) => String(doc.client?._id ?? doc.client);

module.exports = { clientRoomId };

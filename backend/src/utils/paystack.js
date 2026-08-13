const axios = require('axios');

// Verifies a transaction server-side with Paystack's secret key — never trust
// a client-reported "payment succeeded" message on its own.
const verifyPaystackTransaction = async (reference) => {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  );
  return response.data.data;
};

module.exports = { verifyPaystackTransaction };
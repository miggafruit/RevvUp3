// scripts/seedTestDriver.js
//
// TESTING ONLY. Creates (or refreshes) a ready-to-use delivery driver so you
// can test the full delivery flow without going through registration + admin
// approval + police clearance each time.
//
//   CONFIRM=yes DRIVER_EMAIL=testdriver@example.com DRIVER_PASSWORD=ChangeMe123 npm run seed:test-driver
//
// The account is marked approved, has a verified police clearance, is online
// and available. DELETE it (and any test data) before going live — it is a
// fake, pre-approved account by design. Refuses to run without CONFIRM=yes.
require('dotenv').config();
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const run = async () => {
  if (process.env.CONFIRM !== 'yes') {
    console.error('This creates a fake pre-approved driver in the database named by MONGO_URI.');
    console.error('Re-run with CONFIRM=yes if that is what you want.');
    process.exit(1);
  }
  const email = (process.env.DRIVER_EMAIL || 'testdriver@revvup.test').toLowerCase();
  const password = process.env.DRIVER_PASSWORD;
  if (!password || password.length < 8) {
    console.error('Set DRIVER_PASSWORD (min 8 chars).');
    process.exit(1);
  }
  await connectDB();

  const fields = {
    name: 'Test Driver',
    phone: '0710000000',
    role: 'service_provider',
    businessName: 'Test Driver (Delivery)',
    businessAddress: 'Johannesburg',
    category: 'Roadside & Delivery',
    isDriver: true,
    providerType: 'individual',
    vehicleDetails: { make: 'Toyota', model: 'Hilux', licensePlate: 'TEST 001 GP' },
    isOnline: true,
    isAvailable: true,
    kycStatus: 'approved',
    policeClearance: { issuedOn: new Date(), referenceNumber: 'TEST-ONLY', verifiedAt: new Date() },
    bankingDetails: { accountHolder: 'Test Driver', bankName: 'Test Bank', accountNumber: '0000000000', branchCode: '000000', accountType: 'cheque' },
    waiverAccepted: true,
    waiverAcceptedAt: new Date()
  };

  let user = await User.findOne({ email });
  if (user) {
    if (user.role !== 'service_provider') {
      console.error(`${email} exists with role ${user.role}; refusing to overwrite.`);
      process.exit(1);
    }
    Object.assign(user, fields);
    user.password = password;
  } else {
    user = new User({ email, password, ...fields });
  }
  await user.save();
  console.log(`✅ Test delivery driver ready: ${email} (online, approved, clearance verified)`);
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });

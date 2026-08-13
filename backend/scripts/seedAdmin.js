// scripts/seedAdmin.js
//
// Creates (or updates) the one admin account, run directly against the
// database — this is deliberately the ONLY way an admin account gets
// created. There is no public registration path for role: 'admin'
// (see the comment on ROLES in models/User.js), so this script is not
// a convenience, it's the actual security boundary.
//
// Usage:
//   ADMIN_NAME="Your Name" ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=changeme npm run seed:admin
// Or just `npm run seed:admin` and answer the prompts.

require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const ask = (question) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
};

const run = async () => {
  await connectDB();

  const name = process.env.ADMIN_NAME || (await ask('Admin name: '));
  const email = (process.env.ADMIN_EMAIL || (await ask('Admin email: '))).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password (min 6 chars): '));
  const phone = process.env.ADMIN_PHONE || (await ask('Admin phone: '));

  if (!name || !email || !password || !phone) {
    console.error('Name, email, phone, and password are all required.');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      console.error(
        `An account with this email already exists with role "${existing.role}", not admin. Refusing to overwrite it — use a different email.`
      );
      process.exit(1);
    }
    existing.name = name;
    existing.phone = phone;
    existing.password = password; // pre-save hook hashes this
    await existing.save();
    console.log(`Updated existing admin account: ${email}`);
    process.exit(0);
  }

  await User.create({
    name,
    email,
    phone,
    password,
    role: 'admin',
    waiverAccepted: true
  });

  console.log(`Admin account created: ${email}`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Failed to seed admin account:', err.message);
  process.exit(1);
});

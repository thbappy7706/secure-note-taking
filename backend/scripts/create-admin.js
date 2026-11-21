/**
 * Creates (or promotes) an admin account, since registration only creates users.
 *
 * Usage:
 *   npm run seed:admin -- "Admin Name" admin@example.com "StrongPassword123"
 */
require('dotenv').config();

const mongoose = require('mongoose');

const { connectDatabase } = require('../src/config/db');
const User = require('../src/models/User');

async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error('Usage: npm run seed:admin -- "Admin Name" admin@example.com "StrongPassword123"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  await connectDatabase();

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await User.hashPassword(password);
  const existing = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (existing) {
    existing.name = name.trim();
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Promoted existing account ${normalizedEmail} to admin and reset its password.`);
  } else {
    await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'admin',
      interests: [],
    });
    console.log(`Created admin account ${normalizedEmail}.`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`Failed to create admin: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

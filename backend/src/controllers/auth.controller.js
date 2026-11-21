const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { authPayload } = require('../utils/token');
const {
  requireString,
  requireEmail,
  requirePassword,
  parseInterests,
} = require('../utils/validate');

/** POST /api/auth/register - always creates a regular user. */
async function register(req, res) {
  const body = req.body || {};
  const name = requireString(body.name, 'name', { max: 80 });
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const interests = parseInterests(body.interests);

  const passwordHash = await User.hashPassword(password);

  const user = await User.create({
    name,
    email,
    passwordHash,
    interests,
    // Role is never taken from the request body: registration cannot self-elevate.
    role: 'user',
  });

  res.status(201).json(authPayload(user));
}

/** POST /api/auth/login */
async function login(req, res) {
  const body = req.body || {};
  const email = requireEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user ? await user.verifyPassword(password) : false;
  if (!user || !valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  res.json(authPayload(user));
}

module.exports = { register, login };

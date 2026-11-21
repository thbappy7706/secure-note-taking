const jwt = require('jsonwebtoken');

const config = require('../config');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/**
 * Verifies the Bearer token and re-loads the user, so a deleted account or a
 * changed role takes effect immediately instead of at token expiry.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(/\s+/);

    if (!/^Bearer$/i.test(scheme) || !token) {
      throw ApiError.unauthorized('Authentication required: provide a Bearer token');
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('Account no longer exists');

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };

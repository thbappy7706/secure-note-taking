const jwt = require('jsonwebtoken');

const config = require('../config');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function authPayload(user) {
  return {
    token: signToken(user),
    tokenType: 'Bearer',
    expiresIn: config.jwtExpiresIn,
    user,
  };
}

module.exports = { signToken, authPayload };

const mongoose = require('mongoose');
const ApiError = require('./ApiError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTEREST_LIMIT = 20;
const INTEREST_MAX_LENGTH = 40;

function requireString(value, field, { min = 1, max = 10000 } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw ApiError.badRequest(`${field} is required and must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw ApiError.badRequest(`${field} must be between ${min} and ${max} characters`);
  }
  return trimmed;
}

function optionalString(value, field, { min = 1, max = 10000 } = {}) {
  if (value === undefined) return undefined;
  return requireString(value, field, { min, max });
}

function requireEmail(value) {
  const email = requireString(value, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw ApiError.badRequest('email must be a valid email address');
  return email;
}

function requirePassword(value) {
  if (typeof value !== 'string') throw ApiError.badRequest('password is required');
  // bcrypt only considers the first 72 bytes, so longer secrets add no strength.
  if (value.length < 8 || Buffer.byteLength(value) > 72) {
    throw ApiError.badRequest('password must be between 8 and 72 bytes');
  }
  return value;
}

/** Normalises a list of interests: trimmed, lower-cased, unique. */
function parseInterests(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw ApiError.badRequest('interests must be an array of strings');
  if (value.length > INTEREST_LIMIT) {
    throw ApiError.badRequest(`interests cannot contain more than ${INTEREST_LIMIT} entries`);
  }
  const cleaned = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw ApiError.badRequest('each interest must be a non-empty string');
    }
    const interest = entry.trim().toLowerCase();
    if (interest.length > INTEREST_MAX_LENGTH) {
      throw ApiError.badRequest(`each interest must be at most ${INTEREST_MAX_LENGTH} characters`);
    }
    if (!cleaned.includes(interest)) cleaned.push(interest);
  }
  return cleaned;
}

function toObjectId(value, field) {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
    throw ApiError.badRequest(`${field} must be a valid MongoDB id`);
  }
  return new mongoose.Types.ObjectId(value);
}

module.exports = {
  requireString,
  optionalString,
  requireEmail,
  requirePassword,
  parseInterests,
  toObjectId,
};

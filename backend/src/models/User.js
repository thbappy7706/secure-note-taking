const { Schema, model, models } = require('mongoose');
const bcrypt = require('bcryptjs');

const config = require('../config');

const ROLES = ['user', 'admin'];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'user' },
    interests: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

/**
 * Index strategy - only what the API's queries/aggregations actually need.
 *
 * 1. { email: 1 } unique  -> login lookup (findOne by email) + accounts cannot share an email.
 * 2. { createdAt: -1, _id: -1 } -> admin user listing, sorted newest first across pages.
 *    (_id is the tie-breaker so the sort order is deterministic during pagination.)
 * 3. { interests: 1 } -> multikey index backing the "users grouped by interests"
 *    aggregation pipeline, which walks the interests array.
 *
 * Lookups by _id (profile, update, delete) are already served by MongoDB's default _id index.
 */
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1, _id: -1 });
userSchema.index({ interests: 1 });

userSchema.statics.ROLES = ROLES;

userSchema.statics.hashPassword = function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, config.bcryptRounds);
};

userSchema.methods.verifyPassword = function verifyPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = models.User || model('User', userSchema);

require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and set it.`
    );
  }
  return value;
}

function list(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/secure_note_taking',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  // Browser origins allowed to call the API. Use "*" to allow any origin.
  corsOrigins: list(
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173'
  ),
});

module.exports = config;

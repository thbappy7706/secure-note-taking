const mongoose = require('mongoose');
const config = require('./index');

async function connectDatabase(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.db.command({ ping: 1 });
  return mongoose.connection;
}

module.exports = { connectDatabase };

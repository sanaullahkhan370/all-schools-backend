const mongoose = require('mongoose');

let connection;

const getBusTrackingConnection = () => {
  if (connection) return connection;

  const uri = process.env.BUS_TRACKING_MONGO_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('BUS_TRACKING_MONGO_URI or MONGO_URI is required');
  }

  connection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  connection.on('connected', () => {
    console.log('✅ Bus Tracking MongoDB Connected');
  });

  connection.on('error', (error) => {
    console.error('❌ Bus Tracking MongoDB Error:', error.message);
  });

  return connection;
};

module.exports = { getBusTrackingConnection };

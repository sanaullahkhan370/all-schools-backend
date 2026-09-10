const mongoose = require('mongoose');

let connection;

const getMainServerConnection = () => {
  if (connection) return connection;

  const uri = process.env.MAIN_SERVER_MONGO_URL || process.env.MONGO_URL || process.env.MONGO_URI;
  if (!uri) throw new Error('MAIN_SERVER_MONGO_URL or MONGO_URI is required');

  connection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 });
  connection.on('connected', () => console.log('✅ Main Server MongoDB Connected'));
  connection.on('error', (error) => console.error('❌ Main Server MongoDB Error:', error.message));

  return connection;
};

module.exports = { getMainServerConnection };

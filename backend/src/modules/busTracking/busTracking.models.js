const mongoose = require('mongoose');
const { getBusTrackingConnection } = require('./busTracking.database');

const connection = getBusTrackingConnection();

const busSchema = new mongoose.Schema({
  busId: { type: String, required: true },
  latitude: Number,
  longitude: Number,
  updatedAt: Date,
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'student' },
});

const paymentSchema = new mongoose.Schema({
  txnId: { type: String, required: true },
  sender: String,
  createdAt: { type: Date, default: Date.now },
});

const Bus = connection.model('Bus', busSchema, 'buses');
const BusTrackerUser = connection.model('BusTrackerUser', userSchema, 'users');
const BusTrackerPayment = connection.model('BusTrackerPayment', paymentSchema, 'payments');

module.exports = { Bus, BusTrackerUser, BusTrackerPayment };

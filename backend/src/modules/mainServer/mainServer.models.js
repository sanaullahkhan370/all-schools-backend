const mongoose = require('mongoose');
const { getMainServerConnection } = require('./mainServer.database');

const connection = getMainServerConnection();

const busSchema = new mongoose.Schema({
  busId: { type: String, required: true },
  latitude: Number,
  longitude: Number,
  speed: { type: Number, default: 0 },
  driverName: String,
  phoneNumber: String,
  updatedAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  password: String,
  rollNo: String,
  email: String,
  trialStartDate: Date,
  trialEndDate: Date,
  isSubscribed: { type: Boolean, default: false },
});

const paymentSchema = new mongoose.Schema({
  userId: String,
  amount: String,
  txnId: String,
  image: String,
  rawText: String,
  createdAt: { type: Date, default: Date.now },
});

const transactionSchema = new mongoose.Schema({
  tid: String,
  amount: Number,
  isUsed: { type: Boolean, default: false },
}, { timestamps: true });

const MainServerBus = connection.model('MainServerBus', busSchema, 'buses');
const MainServerUser = connection.model('MainServerUser', userSchema, 'users');
const MainServerPayment = connection.model('MainServerPayment', paymentSchema, 'payments');
const MainServerTransaction = connection.model('MainServerTransaction', transactionSchema, 'transactions');

module.exports = { MainServerBus, MainServerUser, MainServerPayment, MainServerTransaction };

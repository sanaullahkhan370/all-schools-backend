const express = require('express');
const controller = require('./busTracking.controller');

const router = express.Router();

// Existing Map_Bustracking_Backend paths are kept for Flutter app compatibility.
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/location/update', controller.updateLocation);
router.get('/buses', controller.getBuses);
router.post('/payment-sms', controller.receivePaymentSms);

module.exports = router;

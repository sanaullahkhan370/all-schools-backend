const express = require('express');
const multer = require('multer');
const controller = require('./mainServer.controller');
const { trackerAuth } = require('./mainServer.middleware');

const rootRoutes = express.Router();
const busRoutes = express.Router();
const locationRoutes = express.Router();
const paymentRoutes = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

rootRoutes.post('/register', controller.register);
rootRoutes.post('/login', controller.login);
rootRoutes.get('/check-access', controller.checkAccess);
busRoutes.post('/update', controller.updateBus);
busRoutes.get('/', controller.getBuses);
locationRoutes.post('/update', trackerAuth, controller.updateTrackerLocation);
paymentRoutes.post('/upload', upload.single('image'), controller.uploadPayment);

module.exports = { rootRoutes, busRoutes, locationRoutes, paymentRoutes };

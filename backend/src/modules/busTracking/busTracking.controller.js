const { Bus, BusTrackerUser, BusTrackerPayment } = require('./busTracking.models');

const register = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username & password required' });
    }

    if (await BusTrackerUser.findOne({ username })) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const user = await BusTrackerUser.create({ username, password, role: role || 'student' });
    return res.json({
      success: true,
      message: 'User registered successfully',
      user: { username: user.username, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username & password required' });
    }

    const user = await BusTrackerUser.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    return res.json({
      success: true,
      message: 'Login successful',
      user: { username: user.username, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const { busId, lat, lng } = req.body;
    if (!busId || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'busId, lat, lng required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, message: 'lat and lng must be valid numbers' });
    }

    await Bus.updateOne(
      { busId },
      { latitude, longitude, updatedAt: new Date() },
      { upsert: true }
    );
    return res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    return next(error);
  }
};

const getBuses = async (_req, res, next) => {
  try {
    const buses = await Bus.find().sort({ updatedAt: -1 });
    return res.json(buses);
  } catch (error) {
    return next(error);
  }
};

const receivePaymentSms = async (req, res, next) => {
  try {
    const { txnId, sender } = req.body;
    if (!txnId || !sender) {
      return res.status(400).json({ success: false, message: 'txnId and sender required' });
    }

    if (await BusTrackerPayment.findOne({ txnId })) {
      return res.json({ success: true, message: 'Already exists' });
    }

    await BusTrackerPayment.create({ txnId, sender });
    return res.json({ success: true, message: 'Payment saved' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, updateLocation, getBuses, receivePaymentSms };

const bcrypt = require('bcryptjs');
const Tesseract = require('tesseract.js');
const { MainServerBus, MainServerUser, MainServerPayment } = require('./mainServer.models');

const register = async (req, res, next) => {
  try {
    const { name, phone, password, rollNo, email } = req.body;
    if (!phone || !password) return res.status(400).json({ msg: 'Phone and password required' });
    if (await MainServerUser.findOne({ phone })) return res.status(400).json({ msg: 'User already exists' });

    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    const user = await MainServerUser.create({
      name,
      phone,
      password: await bcrypt.hash(password, 10),
      rollNo,
      email,
      trialStartDate: now,
      trialEndDate,
      isSubscribed: false,
    });
    return res.status(200).json({ msg: 'User registered with 7 days trial', token: user._id, user });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const user = await MainServerUser.findOne({ phone });
    if (!user) return res.status(400).json({ msg: 'User not found' });
    if (!(await bcrypt.compare(password, user.password))) return res.status(400).json({ msg: 'Invalid password' });
    return res.status(200).json({ msg: 'Login success', token: user._id, user });
  } catch (error) {
    return next(error);
  }
};

const checkAccess = async (req, res, next) => {
  try {
    const user = await MainServerUser.findById(req.get('Authorization'));
    if (!user) return res.status(401).json({ msg: 'No user' });
    if (user.isSubscribed) return res.status(200).json({ msg: 'Access granted (Subscribed)' });
    if (user.trialEndDate && new Date() <= user.trialEndDate) {
      return res.status(200).json({ msg: 'Access granted (Trial)' });
    }
    return res.status(403).json({ msg: 'Trial expired - renew required' });
  } catch (error) {
    return next(error);
  }
};

const updateBus = async (req, res, next) => {
  try {
    const { busId, lat, lng } = req.body;
    if (!busId || lat == null || lng == null) return res.status(400).json({ msg: 'Missing data' });
    await MainServerBus.updateOne(
      { busId },
      { latitude: Number(lat), longitude: Number(lng), updatedAt: new Date() },
      { upsert: true }
    );
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

const getBuses = async (_req, res, next) => {
  try {
    return res.json(await MainServerBus.find());
  } catch (error) {
    return next(error);
  }
};

const distanceInMetres = (lat1, lon1, lat2, lon2) => {
  const radius = 6371e3;
  const toRad = (value) => (value * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const updateTrackerLocation = async (req, res, next) => {
  try {
    const { busId, lat, lng, driverName, phoneNumber } = req.body;
    if (!busId || lat == null || lng == null) {
      return res.status(400).json({ success: false, message: 'Missing data' });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const oldBus = await MainServerBus.findOne({ busId });
    let speed = 0;
    if (oldBus?.latitude != null && oldBus?.longitude != null && oldBus?.updatedAt) {
      const seconds = (Date.now() - oldBus.updatedAt.getTime()) / 1000;
      if (seconds > 2) speed = (distanceInMetres(oldBus.latitude, oldBus.longitude, latitude, longitude) / seconds) * 3.6;
      if (speed < 1 || speed > 120) speed = 0;
    }

    const bus = await MainServerBus.findOneAndUpdate(
      { busId },
      {
        latitude,
        longitude,
        speed,
        driverName: driverName ? driverName.trim() : oldBus?.driverName || '',
        phoneNumber: phoneNumber ? phoneNumber.trim() : oldBus?.phoneNumber || '',
        updatedAt: new Date(),
      },
      { new: true, upsert: true }
    );
    return res.status(200).json({ success: true, message: 'Location updated successfully', data: bus });
  } catch (error) {
    return next(error);
  }
};

const uploadPayment = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'Image required' });
    const user = await MainServerUser.findById(req.get('Authorization'));
    if (!user) return res.status(401).json({ msg: 'User not found' });

    const result = await Tesseract.recognize(req.file.buffer, 'eng');
    const text = result.data.text;
    const amount = text.match(/Rs\.?\s?(\d+)/i)?.[1] || '0';
    const transactionId = text.match(/TID[:\s]*([0-9]+)/i)?.[1] || 'UNKNOWN';

    await MainServerPayment.create({
      userId: user._id,
      amount,
      txnId: transactionId,
      image: req.file.originalname,
      rawText: text,
    });
    return res.json({ success: true, amount, transactionId });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, checkAccess, updateBus, getBuses, updateTrackerLocation, uploadPayment };

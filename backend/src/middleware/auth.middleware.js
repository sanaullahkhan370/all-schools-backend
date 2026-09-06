const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');
const School = require('../models/school.model');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Token ko header se alag karna
      token = req.headers.authorization.split(' ')[1];

      // Token verify karna
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Token ko kisi doosray school database mein use honay se rokna
      if (decoded.schoolCode && decoded.schoolCode !== req.schoolCode) {
        res.status(401);
        throw new Error('This login token belongs to another school');
      }

      // User details nikalna (baghair password ke)
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        res.status(401);
        throw new Error('User not found');
      }

      // Check if user is active
      if (!user.isActive) {
        res.status(403);
        throw new Error('Your account is deactivated');
      }

      // Agar user Super Admin nahi hai, to School status check karna
      if (user.role !== 'superAdmin') {
        const school = await School.findById(user.schoolId);

        if (!school) {
          res.status(404);
          throw new Error('School not found');
        }

        if (school.status === 'suspended') {
          res.status(403);
          throw new Error('Your school is suspended. Please contact support.');
        }

        if (school.status === 'inactive') {
          res.status(403);
          throw new Error('Your school is currently inactive.');
        }
      }

      // User ko request object mein shamil karna
      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        res.status(401);
        throw new Error(
          error.name === 'TokenExpiredError'
            ? 'Session expired, please log in again'
            : 'Not authorized, token failed'
        );
      }
      throw error;
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

module.exports = { protect };

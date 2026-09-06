const jwt = require('jsonwebtoken');

const generateToken = (id, role, schoolCode = 'city_school') => {
  return jwt.sign({ id, role, schoolCode }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

module.exports = generateToken;

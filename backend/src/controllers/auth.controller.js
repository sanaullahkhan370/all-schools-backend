const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, phone, password } = req.body;

  // Login ya email se ho sakta hai ya phone se
  const query = email ? { email } : { phone };

  const user = await User.findOne(query).select('+password');

  if (user && (await user.matchPassword(password))) {
    // Last login update karna
    user.lastLogin = Date.now();
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          schoolId: user.schoolId,
          profileImage: user.profileImage,
        },
        token: generateToken(user._id, user.role, req.schoolCode),
        schoolCode: req.schoolCode,
      },
    });
  } else {
    res.status(401);
    throw new Error('Invalid email/phone or password');
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      success: true,
      data: user,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

module.exports = {
  loginUser,
  getMe,
};

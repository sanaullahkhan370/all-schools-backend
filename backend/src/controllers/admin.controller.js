const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');
const Student = require('../models/student.model');
const SchoolClass = require('../models/class.model');
const ParentStudent = require('../models/parentStudent.model');

// @desc    Create a teacher
// @route   POST /api/admin/teachers
// @access  Private/Admin
const createTeacher = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  const userExists = await User.findOne({ $or: [{ email }, { phone }] });

  if (userExists) {
    res.status(400);
    throw new Error('User with this email or phone already exists');
  }

  const teacher = await User.create({
    name,
    email,
    phone,
    password,
    role: 'teacher',
    schoolId: req.user.schoolId, // Admin's school ID automatically assigned
    createdBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Teacher created successfully',
    data: {
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role,
      schoolId: teacher.schoolId,
    },
  });
});

// @desc    Create a parent
// @route   POST /api/admin/parents
// @access  Private/Admin
const createParent = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  const studentIds = [...new Set((req.body.studentIds || []).map(String))];

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
    res.status(400);
    throw new Error('Parent name, email, phone and password are required');
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must contain at least 6 characters');
  }
  if (!studentIds.length) {
    res.status(400);
    throw new Error('Select at least one child for this Parent account');
  }

  const [userExists, students] = await Promise.all([
    User.findOne({
      schoolId: req.user.schoolId,
      $or: [
        { email: email.trim().toLowerCase() },
        { phone: phone.trim() },
      ],
    }),
    Student.find({
      _id: { $in: studentIds },
      schoolId: req.user.schoolId,
      deletedAt: null,
    }).select('_id fullName admissionNumber'),
  ]);

  if (userExists) {
    res.status(409);
    throw new Error('User with this email or phone already exists');
  }
  if (students.length !== studentIds.length) {
    res.status(400);
    throw new Error('One or more selected Students are invalid');
  }

  const parent = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    password,
    role: 'parent',
    schoolId: req.user.schoolId,
    createdBy: req.user._id,
  });

  try {
    await ParentStudent.insertMany(students.map((student, index) => ({
      schoolId: req.user.schoolId,
      parentId: parent._id,
      studentId: student._id,
      relationship: req.body.relationship || 'father',
      isPrimaryGuardian: index === 0,
      canViewAcademicData: true,
      canPayFees: true,
      isActive: true,
      createdBy: req.user._id,
    })));
  } catch (error) {
    await User.deleteOne({ _id: parent._id });
    throw error;
  }

  res.status(201).json({
    success: true,
    message: 'Parent login created and linked with selected children',
    data: {
      _id: parent._id,
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
      role: parent.role,
      children: students,
    },
  });
});

const listParents = asyncHandler(async (req, res) => {
  const parents = await User.find({
    schoolId: req.user.schoolId,
    role: 'parent',
    deletedAt: null,
  }).select('name email phone isActive createdAt').sort({ name: 1 });

  const data = await Promise.all(parents.map(async (parent) => {
    const links = await ParentStudent.find({
      schoolId: req.user.schoolId,
      parentId: parent._id,
      isActive: true,
    }).populate('studentId', 'fullName admissionNumber');
    return {
      ...parent.toObject(),
      children: links.filter((link) => link.studentId).map((link) => link.studentId),
    };
  }));

  res.json({ success: true, data });
});

const updateParent = asyncHandler(async (req, res) => {
  const parent = await User.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    role: 'parent',
    deletedAt: null,
  });
  if (!parent) {
    res.status(404);
    throw new Error('Parent account not found');
  }

  for (const field of ['name', 'email', 'phone']) {
    if (req.body[field] !== undefined && !String(req.body[field]).trim()) {
      res.status(400);
      throw new Error(`${field} cannot be empty`);
    }
  }
  if (req.body.password !== undefined && String(req.body.password).length < 6) {
    res.status(400);
    throw new Error('Password must contain at least 6 characters');
  }

  const email = req.body.email?.trim().toLowerCase();
  const phone = req.body.phone?.trim();
  if (email || phone) {
    const duplicate = await User.findOne({
      _id: { $ne: parent._id },
      schoolId: req.user.schoolId,
      $or: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    });
    if (duplicate) {
      res.status(409);
      throw new Error('Email or phone is already used by another account');
    }
  }

  if (req.body.name !== undefined) parent.name = req.body.name.trim();
  if (email) parent.email = email;
  if (phone) parent.phone = phone;
  if (req.body.password) parent.password = String(req.body.password);
  if (req.body.isActive !== undefined) parent.isActive = req.body.isActive === true;
  await parent.save();

  if (Array.isArray(req.body.studentIds)) {
    const studentIds = [...new Set(req.body.studentIds.map(String))];
    if (!studentIds.length) {
      res.status(400);
      throw new Error('Select at least one child');
    }
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: req.user.schoolId,
      deletedAt: null,
    }).select('_id');
    if (students.length !== studentIds.length) {
      res.status(400);
      throw new Error('One or more selected Students are invalid');
    }
    await ParentStudent.updateMany(
      { schoolId: req.user.schoolId, parentId: parent._id },
      { $set: { isActive: false, updatedBy: req.user._id } }
    );
    for (let index = 0; index < studentIds.length; index += 1) {
      await ParentStudent.findOneAndUpdate(
        {
          schoolId: req.user.schoolId,
          parentId: parent._id,
          studentId: studentIds[index],
        },
        {
          $set: {
            relationship: req.body.relationship || 'guardian',
            isPrimaryGuardian: index === 0,
            canViewAcademicData: true,
            canPayFees: true,
            isActive: true,
            updatedBy: req.user._id,
          },
          $setOnInsert: { createdBy: req.user._id },
        },
        { upsert: true, runValidators: true }
      );
    }
  }

  res.json({ success: true, message: 'Parent account updated', data: parent });
});

const deleteParent = asyncHandler(async (req, res) => {
  const parent = await User.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    role: 'parent',
    deletedAt: null,
  });
  if (!parent) {
    res.status(404);
    throw new Error('Parent account not found');
  }
  parent.isActive = false;
  parent.deletedAt = new Date();
  parent.deletedBy = req.user._id;
  await parent.save();
  await ParentStudent.updateMany(
    { schoolId: req.user.schoolId, parentId: parent._id, isActive: true },
    { $set: { isActive: false, updatedBy: req.user._id } }
  );
  res.json({ success: true, message: 'Parent account deactivated' });
});

// @desc    Get all users of the school
// @route   GET /api/admin/users
// @access  Private/Admin
const getSchoolUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ schoolId: req.user.schoolId });
  res.json({
    success: true,
    data: users,
  });
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const schoolId = req.user.schoolId;
  const [students, teachers, classes] = await Promise.all([
    Student.countDocuments({ schoolId, status: 'active' }),
    User.countDocuments({ schoolId, role: 'teacher', isActive: true }),
    SchoolClass.countDocuments({ schoolId }),
  ]);
  res.json({ success: true, data: { students, teachers, classes } });
});

module.exports = {
  createTeacher,
  createParent,
  listParents,
  updateParent,
  deleteParent,
  getSchoolUsers,
  getDashboardStats,
};

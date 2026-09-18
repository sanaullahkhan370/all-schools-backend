const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');
const TeacherProfile = require('../models/teacherProfile.model');
const TeacherAssignment = require('../models/teacherAssignment.model');

const userFields = ['name', 'email', 'phone', 'profileImage'];
const profileFields = [
  'employeeId', 'gender', 'dateOfBirth', 'cnic', 'qualification',
  'specialization', 'joiningDate', 'address', 'emergencyContact', 'employmentType',
];

const pick = (source, fields) => Object.fromEntries(
  fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])
);

const safeTeacher = (teacher) => {
  const value = teacher.toObject();
  delete value.password;
  return value;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findTeacher = async (req, res) => {
  const teacher = await User.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    role: 'teacher',
    deletedAt: null,
  });
  if (!teacher) {
    res.status(404);
    throw new Error('Teacher not found');
  }
  return teacher;
};

const createTeacher = asyncHandler(async (req, res) => {
  for (const field of ['name', 'email', 'phone', 'password', 'employeeId']) {
    if (!req.body[field]?.toString().trim()) {
      res.status(400);
      throw new Error(`${field} is required`);
    }
  }
  const email = req.body.email.trim().toLowerCase();
  const phone = req.body.phone.trim();
  if (await User.exists({ $or: [{ email }, { phone }] })) {
    res.status(409);
    throw new Error('User with this email or phone already exists');
  }

  const teacher = await User.create({
    ...pick(req.body, userFields),
    email,
    phone,
    password: req.body.password,
    role: 'teacher',
    schoolId: req.user.schoolId,
    createdBy: req.user._id,
  });
  try {
    const profile = await TeacherProfile.create({
      ...pick(req.body, profileFields),
      schoolId: req.user.schoolId,
      userId: teacher._id,
      createdBy: req.user._id,
    });
    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: { teacher: safeTeacher(teacher), profile },
    });
  } catch (error) {
    await User.deleteOne({ _id: teacher._id });
    throw error;
  }
});

const listTeachers = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId, role: 'teacher', deletedAt: null };
  if (req.query.status === 'active') query.isActive = true;
  if (req.query.status === 'inactive') query.isActive = false;
  if (req.query.search?.trim()) {
    const search = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    query.$or = [{ name: search }, { email: search }, { phone: search }];
  }
  const teachers = await User.find(query).sort({ name: 1 }).lean();
  const ids = teachers.map((teacher) => teacher._id);
  const [profiles, counts] = await Promise.all([
    TeacherProfile.find({ schoolId: req.user.schoolId, userId: { $in: ids } }).lean(),
    TeacherAssignment.aggregate([
      { $match: { schoolId: req.user.schoolId, teacherId: { $in: ids }, isActive: true } },
      { $group: { _id: '$teacherId', count: { $sum: 1 } } },
    ]),
  ]);
  const profileMap = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));
  const countMap = new Map(counts.map((item) => [item._id.toString(), item.count]));
  const data = teachers.map((teacher) => ({
    ...teacher,
    profile: profileMap.get(teacher._id.toString()) || null,
    activeAssignments: countMap.get(teacher._id.toString()) || 0,
  }));
  res.json({ success: true, data });
});

const getTeacher = asyncHandler(async (req, res) => {
  const teacher = await findTeacher(req, res);
  const [profile, assignments] = await Promise.all([
    TeacherProfile.findOne({ schoolId: req.user.schoolId, userId: teacher._id }),
    TeacherAssignment.find({ schoolId: req.user.schoolId, teacherId: teacher._id })
      .populate('academicSessionId', 'name')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .sort({ isActive: -1, createdAt: -1 }),
  ]);
  res.json({ success: true, data: { teacher, profile, assignments } });
});

const updateTeacher = asyncHandler(async (req, res) => {
  const teacher = await findTeacher(req, res);
  const updates = pick(req.body, userFields);
  if (updates.email) updates.email = updates.email.trim().toLowerCase();
  if (updates.phone) updates.phone = updates.phone.trim();
  const identityChecks = [
    ...(updates.email ? [{ email: updates.email }] : []),
    ...(updates.phone ? [{ phone: updates.phone }] : []),
  ];
  const duplicate = identityChecks.length
      ? await User.findOne({ _id: { $ne: teacher._id }, $or: identityChecks })
      : null;
  if (duplicate) { res.status(409); throw new Error('Email or phone is already in use'); }
  Object.assign(teacher, updates);
  if (req.body.password?.trim()) teacher.password = req.body.password;
  await teacher.save();

  const profile = await TeacherProfile.findOneAndUpdate(
    { schoolId: req.user.schoolId, userId: teacher._id },
    {
      $set: { ...pick(req.body, profileFields), updatedBy: req.user._id },
      $setOnInsert: { schoolId: req.user.schoolId, userId: teacher._id, createdBy: req.user._id },
    },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({
    success: true,
    message: 'Teacher updated successfully',
    data: { teacher: safeTeacher(teacher), profile },
  });
});

const changeTeacherStatus = asyncHandler(async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') {
    res.status(400);
    throw new Error('isActive must be true or false');
  }
  const teacher = await findTeacher(req, res);
  teacher.isActive = req.body.isActive;
  await teacher.save();
  res.json({ success: true, message: `Teacher ${teacher.isActive ? 'activated' : 'deactivated'}`, data: teacher });
});

const deleteTeacher = asyncHandler(async (req, res) => {
  const teacher = await findTeacher(req, res);
  const now = new Date();

  teacher.isActive = false;
  teacher.deletedAt = now;
  teacher.deletedBy = req.user._id;
  await teacher.save();

  await TeacherAssignment.updateMany(
    { schoolId: req.user.schoolId, teacherId: teacher._id, isActive: true },
    {
      $set: {
        isActive: false,
        deactivatedBy: req.user._id,
        deactivatedAt: now,
      },
    }
  );

  res.json({ success: true, message: 'Teacher deleted successfully' });
});

module.exports = {
  createTeacher, listTeachers, getTeacher, updateTeacher,
  changeTeacherStatus, deleteTeacher,
};

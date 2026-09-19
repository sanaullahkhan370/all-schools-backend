const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const Student = require('../models/student.model');
const StudentEnrollment = require('../models/studentEnrollment.model');
const ParentStudent = require('../models/parentStudent.model');
const StudentCard = require('../models/studentCard.model');
const AcademicSession = require('../models/academicSession.model');
const SchoolClass = require('../models/class.model');
const Section = require('../models/section.model');
const User = require('../models/user.model');

const editableStudentFields = [
  'admissionNumber', 'registrationNumber', 'fullName', 'fatherName',
  'motherName', 'gender', 'dateOfBirth', 'bFormNumber', 'phone',
  'alternativePhone', 'address', 'profileImage', 'admissionDate',
];

const pick = (source, fields) => Object.fromEntries(
  fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])
);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const requireFields = (res, body, fields) => {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === '');
  if (missing.length) {
    res.status(400);
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};

const findStudent = async (req, res) => {
  const student = await Student.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    deletedAt: null,
  });
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  return student;
};

const validateEnrollment = async ({ schoolId, academicSessionId, classId, sectionId }) => {
  const [session, schoolClass, section] = await Promise.all([
    AcademicSession.findOne({ _id: academicSessionId, schoolId }),
    SchoolClass.findOne({ _id: classId, schoolId }),
    Section.findOne({ _id: sectionId, schoolId }),
  ]);
  if (!session || !schoolClass || !section) throw new Error('Invalid Session, Class or Section');
  if (!schoolClass.academicSessionId.equals(session._id) ||
      !section.academicSessionId.equals(session._id) ||
      !section.classId.equals(schoolClass._id)) {
    throw new Error('Session, Class and Section do not match');
  }
  return { session, schoolClass, section };
};

const populateStudent = (query) => query.populate({
  path: 'currentEnrollmentId',
  populate: [
    { path: 'academicSessionId', select: 'name isCurrent status' },
    { path: 'classId', select: 'name' },
    { path: 'sectionId', select: 'name' },
  ],
});

const createStudent = asyncHandler(async (req, res) => {
  requireFields(res, req.body, [
    'admissionNumber', 'fullName', 'fatherName', 'gender', 'dateOfBirth',
    'academicSessionId', 'classId', 'sectionId', 'rollNumber',
  ]);

  try {
    await validateEnrollment({
      schoolId: req.user.schoolId,
      academicSessionId: req.body.academicSessionId,
      classId: req.body.classId,
      sectionId: req.body.sectionId,
    });
  } catch (error) {
    res.status(400);
    throw error;
  }

  const student = await Student.create({
    ...pick(req.body, editableStudentFields),
    schoolId: req.user.schoolId,
    createdBy: req.user._id,
  });

  try {
    const enrollment = await StudentEnrollment.create({
      schoolId: req.user.schoolId,
      studentId: student._id,
      academicSessionId: req.body.academicSessionId,
      classId: req.body.classId,
      sectionId: req.body.sectionId,
      rollNumber: req.body.rollNumber,
      createdBy: req.user._id,
    });
    student.currentEnrollmentId = enrollment._id;
    await student.save();
  } catch (error) {
    await Student.deleteOne({ _id: student._id });
    throw error;
  }

  const result = await populateStudent(Student.findById(student._id));
  res.status(201).json({ success: true, message: 'Student created successfully', data: result });
});

const listStudents = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const query = { schoolId: req.user.schoolId, deletedAt: null };

  if (req.query.status) query.status = req.query.status;
  if (req.query.search?.trim()) {
    const search = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    query.$or = [
      { fullName: search }, { fatherName: search },
      { admissionNumber: search }, { registrationNumber: search },
    ];
  }

  if (req.query.classId || req.query.sectionId || req.query.academicSessionId || req.query.rollNumber) {
    const enrollmentQuery = { schoolId: req.user.schoolId, isCurrent: true };
    for (const field of ['classId', 'sectionId', 'academicSessionId']) {
      if (req.query[field]) enrollmentQuery[field] = req.query[field];
    }
    if (req.query.rollNumber?.trim()) {
      enrollmentQuery.rollNumber = req.query.rollNumber.trim().toUpperCase();
    }
    const enrollmentIds = await StudentEnrollment.find(enrollmentQuery).distinct('_id');
    query.currentEnrollmentId = { $in: enrollmentIds };
  }

  const [students, total] = await Promise.all([
    populateStudent(Student.find(query))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Student.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: students,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const getStudent = asyncHandler(async (req, res) => {
  await findStudent(req, res);
  const [student, parents, cards, enrollments] = await Promise.all([
    populateStudent(Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId })),
    ParentStudent.find({ studentId: req.params.id, schoolId: req.user.schoolId, isActive: true })
      .populate('parentId', 'name email phone isActive'),
    StudentCard.find({ studentId: req.params.id, schoolId: req.user.schoolId }).sort({ createdAt: -1 }),
    StudentEnrollment.find({ studentId: req.params.id, schoolId: req.user.schoolId })
      .populate('academicSessionId', 'name')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .sort({ createdAt: -1 }),
  ]);
  res.json({ success: true, data: { student, parents, cards, enrollments } });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await findStudent(req, res);
  Object.assign(student, pick(req.body, editableStudentFields), { updatedBy: req.user._id });
  await student.save();
  const result = await populateStudent(Student.findById(student._id));
  res.json({ success: true, message: 'Student updated successfully', data: result });
});

const changeStudentStatus = asyncHandler(async (req, res) => {
  const allowed = ['active', 'inactive', 'transferred', 'graduated', 'suspended'];
  if (!allowed.includes(req.body.status)) {
    res.status(400);
    throw new Error('Invalid student status');
  }
  const student = await findStudent(req, res);
  student.status = req.body.status;
  student.updatedBy = req.user._id;
  await student.save();
  res.json({ success: true, message: 'Student status updated', data: student });
});

const changeEnrollment = asyncHandler(async (req, res) => {
  requireFields(res, req.body, ['academicSessionId', 'classId', 'sectionId', 'rollNumber']);
  const student = await findStudent(req, res);
  try {
    await validateEnrollment({ schoolId: req.user.schoolId, ...pick(req.body, ['academicSessionId', 'classId', 'sectionId']) });
  } catch (error) {
    res.status(400);
    throw error;
  }

  const duplicateRoll = await StudentEnrollment.findOne({
    schoolId: req.user.schoolId,
    academicSessionId: req.body.academicSessionId,
    classId: req.body.classId,
    sectionId: req.body.sectionId,
    rollNumber: req.body.rollNumber.trim().toUpperCase(),
    studentId: { $ne: student._id },
  });
  if (duplicateRoll) {
    res.status(409);
    throw new Error('Roll number is already assigned in this Class and Section');
  }

  await StudentEnrollment.updateMany(
    { schoolId: req.user.schoolId, studentId: student._id, isCurrent: true },
    { $set: { isCurrent: false, status: 'completed', endedBy: req.user._id, endedAt: new Date() } }
  );
  const enrollment = await StudentEnrollment.create({
    schoolId: req.user.schoolId,
    studentId: student._id,
    ...pick(req.body, ['academicSessionId', 'classId', 'sectionId', 'rollNumber']),
    createdBy: req.user._id,
  });
  student.currentEnrollmentId = enrollment._id;
  student.updatedBy = req.user._id;
  await student.save();
  res.json({ success: true, message: 'Student enrollment changed', data: enrollment });
});

const linkParent = asyncHandler(async (req, res) => {
  requireFields(res, req.body, ['parentId']);
  const student = await findStudent(req, res);
  const parent = await User.findOne({
    _id: req.body.parentId,
    schoolId: req.user.schoolId,
    role: 'parent',
    isActive: true,
  });
  if (!parent) {
    res.status(400);
    throw new Error('Valid active Parent account is required');
  }
  const link = await ParentStudent.findOneAndUpdate(
    { schoolId: req.user.schoolId, parentId: parent._id, studentId: student._id },
    {
      $set: {
        relationship: req.body.relationship || 'father',
        isPrimaryGuardian: req.body.isPrimaryGuardian !== false,
        canViewAcademicData: req.body.canViewAcademicData !== false,
        canPayFees: req.body.canPayFees !== false,
        isActive: true,
        updatedBy: req.user._id,
      },
      $setOnInsert: { createdBy: req.user._id },
    },
    { new: true, upsert: true, runValidators: true }
  ).populate('parentId', 'name email phone');
  res.status(201).json({ success: true, message: 'Parent linked with Student', data: link });
});

const unlinkParent = asyncHandler(async (req, res) => {
  const link = await ParentStudent.findOne({
    _id: req.params.linkId,
    studentId: req.params.id,
    schoolId: req.user.schoolId,
  });
  if (!link) { res.status(404); throw new Error('Parent link not found'); }
  link.isActive = false;
  link.updatedBy = req.user._id;
  await link.save();
  res.json({ success: true, message: 'Parent link removed' });
});

const generateStudentCard = asyncHandler(async (req, res) => {
  const student = await findStudent(req, res);
  if (!student.currentEnrollmentId) {
    res.status(400);
    throw new Error('Student needs a current enrollment before Card generation');
  }
  const enrollment = await StudentEnrollment.findOne({
    _id: student.currentEnrollmentId,
    schoolId: req.user.schoolId,
    isCurrent: true,
  });
  if (!enrollment) { res.status(400); throw new Error('Current enrollment not found'); }

  await StudentCard.updateMany(
    { schoolId: req.user.schoolId, studentId: student._id, status: 'active' },
    {
      $set: {
        status: 'revoked', revokedBy: req.user._id,
        revokedAt: new Date(), revokeReason: 'New card generated',
      },
    }
  );
  const code = `STU-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const card = await StudentCard.create({
    schoolId: req.user.schoolId,
    studentId: student._id,
    academicSessionId: enrollment.academicSessionId,
    cardCode: code,
    expiresAt: req.body.expiresAt || undefined,
    issuedBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Student Card generated', data: card });
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await findStudent(req, res);
  const now = new Date();

  student.status = 'inactive';
  student.deletedAt = now;
  student.deletedBy = req.user._id;
  student.updatedBy = req.user._id;
  await student.save();

  await Promise.all([
    StudentEnrollment.updateMany(
      { schoolId: req.user.schoolId, studentId: student._id, isCurrent: true },
      { $set: { isCurrent: false, status: 'cancelled', endedBy: req.user._id, endedAt: now } }
    ),
    ParentStudent.updateMany(
      { schoolId: req.user.schoolId, studentId: student._id, isActive: true },
      { $set: { isActive: false, updatedBy: req.user._id } }
    ),
    StudentCard.updateMany(
      { schoolId: req.user.schoolId, studentId: student._id, status: 'active' },
      { $set: { status: 'revoked', revokedBy: req.user._id, revokedAt: now, revokeReason: 'Student deleted' } }
    ),
  ]);

  res.json({ success: true, message: 'Student deleted successfully' });
});

module.exports = {
  createStudent, listStudents, getStudent, updateStudent, deleteStudent,
  changeStudentStatus, changeEnrollment,
  linkParent, unlinkParent, generateStudentCard,
};

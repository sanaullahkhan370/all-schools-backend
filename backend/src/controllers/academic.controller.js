const asyncHandler = require('express-async-handler');
const AcademicSession = require('../models/academicSession.model');
const Term = require('../models/term.model');
const SchoolClass = require('../models/class.model');
const Section = require('../models/section.model');
const Subject = require('../models/subject.model');
const TeacherAssignment = require('../models/teacherAssignment.model');
const User = require('../models/user.model');
const StudentEnrollment = require('../models/studentEnrollment.model');
const ExamSubject = require('../models/examSubject.model');

const allowed = (source, fields) => Object.fromEntries(
  fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])
);

const requireFields = (res, body, fields) => {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === '');
  if (missing.length) {
    res.status(400);
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};

const findOwned = async (Model, id, schoolId, label) => {
  const record = await Model.findOne({ _id: id, schoolId });
  if (!record) {
    const error = new Error(`${label} not found`);
    error.statusCode = 404;
    throw error;
  }
  return record;
};

const validateDates = (res, startDate, endDate) => {
  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    res.status(400);
    throw new Error('End date must be after start date');
  }
};

const createSession = asyncHandler(async (req, res) => {
  requireFields(res, req.body, ['name', 'startDate', 'endDate']);
  validateDates(res, req.body.startDate, req.body.endDate);
  const session = await AcademicSession.create({
    ...allowed(req.body, ['name', 'startDate', 'endDate', 'status']),
    schoolId: req.user.schoolId,
    isCurrent: false,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Academic session created', data: session });
});

const listSessions = asyncHandler(async (req, res) => {
  const sessions = await AcademicSession.find({ schoolId: req.user.schoolId }).sort({ startDate: -1 });
  res.json({ success: true, data: sessions });
});

const updateSession = asyncHandler(async (req, res) => {
  const session = await findOwned(AcademicSession, req.params.id, req.user.schoolId, 'Academic session');
  const updates = allowed(req.body, ['name', 'startDate', 'endDate', 'status']);
  validateDates(res, updates.startDate || session.startDate, updates.endDate || session.endDate);
  Object.assign(session, updates, { updatedBy: req.user._id });
  await session.save();
  res.json({ success: true, message: 'Academic session updated', data: session });
});

const setCurrentSession = asyncHandler(async (req, res) => {
  const session = await findOwned(AcademicSession, req.params.id, req.user.schoolId, 'Academic session');
  if (session.status === 'archived') {
    res.status(400);
    throw new Error('Archived session cannot be made current');
  }
  await AcademicSession.updateMany(
    { schoolId: req.user.schoolId, isCurrent: true },
    { $set: { isCurrent: false, updatedBy: req.user._id } }
  );
  session.isCurrent = true;
  session.status = 'active';
  session.updatedBy = req.user._id;
  await session.save();
  res.json({ success: true, message: 'Current academic session changed', data: session });
});

const createTerm = asyncHandler(async (req, res) => {
  requireFields(res, req.body, ['academicSessionId', 'name', 'startDate', 'endDate']);
  validateDates(res, req.body.startDate, req.body.endDate);
  const session = await findOwned(AcademicSession, req.body.academicSessionId, req.user.schoolId, 'Academic session');
  if (new Date(req.body.startDate) < session.startDate || new Date(req.body.endDate) > session.endDate) {
    res.status(400);
    throw new Error('Term dates must be inside the academic session dates');
  }
  const term = await Term.create({
    ...allowed(req.body, ['academicSessionId', 'name', 'startDate', 'endDate', 'resultPublishDate', 'status']),
    schoolId: req.user.schoolId,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Term created', data: term });
});

const listTerms = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId };
  if (req.query.academicSessionId) query.academicSessionId = req.query.academicSessionId;
  const terms = await Term.find(query).populate('academicSessionId', 'name').sort({ startDate: 1 });
  res.json({ success: true, data: terms });
});

const createClass = asyncHandler(async (req, res) => {
  requireFields(res, req.body, ['academicSessionId', 'name']);
  await findOwned(AcademicSession, req.body.academicSessionId, req.user.schoolId, 'Academic session');
  const record = await SchoolClass.create({
    ...allowed(req.body, ['academicSessionId', 'name', 'displayOrder']),
    schoolId: req.user.schoolId,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Class created', data: record });
});

const listClasses = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId };
  if (req.query.academicSessionId) query.academicSessionId = req.query.academicSessionId;
  const records = await SchoolClass.find(query).sort({ displayOrder: 1, name: 1 });
  res.json({ success: true, data: records });
});

const createSection = asyncHandler(async (req, res) => {
  requireFields(res, req.body, ['academicSessionId', 'classId', 'name']);
  const session = await findOwned(AcademicSession, req.body.academicSessionId, req.user.schoolId, 'Academic session');
  const schoolClass = await findOwned(SchoolClass, req.body.classId, req.user.schoolId, 'Class');
  if (!schoolClass.academicSessionId.equals(session._id)) {
    res.status(400);
    throw new Error('Class does not belong to the selected academic session');
  }
  if (req.body.classTeacherId) {
    const teacher = await User.findOne({ _id: req.body.classTeacherId, schoolId: req.user.schoolId, role: 'teacher', isActive: true });
    if (!teacher) { res.status(400); throw new Error('Valid active teacher is required'); }
  }
  const record = await Section.create({
    ...allowed(req.body, ['academicSessionId', 'classId', 'name', 'classTeacherId']),
    schoolId: req.user.schoolId,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Section created', data: record });
});

const listSections = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId };
  for (const field of ['academicSessionId', 'classId']) if (req.query[field]) query[field] = req.query[field];
  const records = await Section.find(query)
    .populate('classId', 'name')
    .populate('classTeacherId', 'name email')
    .sort({ name: 1 });
  res.json({ success: true, data: records });
});

const updateSection = asyncHandler(async (req, res) => {
  const record = await findOwned(Section, req.params.id, req.user.schoolId, 'Section');
  const academicSessionId = req.body.academicSessionId || record.academicSessionId;
  const classId = req.body.classId || record.classId;
  const [session, schoolClass] = await Promise.all([
    findOwned(AcademicSession, academicSessionId, req.user.schoolId, 'Academic session'),
    findOwned(SchoolClass, classId, req.user.schoolId, 'Class'),
  ]);
  if (!schoolClass.academicSessionId.equals(session._id)) {
    res.status(400);
    throw new Error('Class does not belong to the selected academic session');
  }
  if (req.body.classTeacherId) {
    const teacher = await User.findOne({
      _id: req.body.classTeacherId,
      schoolId: req.user.schoolId,
      role: 'teacher',
      isActive: true,
    });
    if (!teacher) { res.status(400); throw new Error('Valid active teacher is required'); }
  }
  const updates = allowed(req.body, ['academicSessionId', 'classId', 'name', 'classTeacherId']);
  if (updates.classTeacherId === '') updates.classTeacherId = null;
  Object.assign(record, updates, { updatedBy: req.user._id });
  await record.save();
  res.json({ success: true, message: 'Section updated', data: record });
});

const deleteSection = asyncHandler(async (req, res) => {
  const record = await findOwned(Section, req.params.id, req.user.schoolId, 'Section');
  const dependencyQuery = { schoolId: req.user.schoolId, sectionId: record._id };
  const [assignment, enrollment, examSubject] = await Promise.all([
    TeacherAssignment.exists(dependencyQuery),
    StudentEnrollment.exists(dependencyQuery),
    ExamSubject.exists(dependencyQuery),
  ]);
  if (assignment || enrollment || examSubject) {
    res.status(409);
    throw new Error('Section is in use and cannot be deleted');
  }
  await record.deleteOne();
  res.json({ success: true, message: 'Section deleted' });
});

const createSubject = asyncHandler(async (req, res) => {
  requireFields(res, req.body, ['academicSessionId', 'name']);
  await findOwned(AcademicSession, req.body.academicSessionId, req.user.schoolId, 'Academic session');
  const record = await Subject.create({
    ...allowed(req.body, ['academicSessionId', 'name', 'code']),
    schoolId: req.user.schoolId,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Subject created', data: record });
});

const listSubjects = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId };
  if (req.query.academicSessionId) query.academicSessionId = req.query.academicSessionId;
  const records = await Subject.find(query).sort({ name: 1 });
  res.json({ success: true, data: records });
});

const updateSubject = asyncHandler(async (req, res) => {
  const record = await findOwned(Subject, req.params.id, req.user.schoolId, 'Subject');
  if (req.body.academicSessionId) {
    await findOwned(AcademicSession, req.body.academicSessionId, req.user.schoolId, 'Academic session');
  }
  const updates = allowed(req.body, ['academicSessionId', 'name', 'code']);
  Object.assign(record, updates, { updatedBy: req.user._id });
  await record.save();
  res.json({ success: true, message: 'Subject updated', data: record });
});

const deleteSubject = asyncHandler(async (req, res) => {
  const record = await findOwned(Subject, req.params.id, req.user.schoolId, 'Subject');
  const dependencyQuery = { schoolId: req.user.schoolId, subjectId: record._id };
  const [assignment, examSubject] = await Promise.all([
    TeacherAssignment.exists(dependencyQuery),
    ExamSubject.exists(dependencyQuery),
  ]);
  if (assignment || examSubject) {
    res.status(409);
    throw new Error('Subject is in use and cannot be deleted');
  }
  await record.deleteOne();
  res.json({ success: true, message: 'Subject deleted' });
});

const createTeacherAssignment = asyncHandler(async (req, res) => {
  requireFields(res, req.body, ['academicSessionId', 'teacherId', 'classId', 'sectionId', 'subjectId']);
  const [session, schoolClass, section, subject, teacher] = await Promise.all([
    findOwned(AcademicSession, req.body.academicSessionId, req.user.schoolId, 'Academic session'),
    findOwned(SchoolClass, req.body.classId, req.user.schoolId, 'Class'),
    findOwned(Section, req.body.sectionId, req.user.schoolId, 'Section'),
    findOwned(Subject, req.body.subjectId, req.user.schoolId, 'Subject'),
    User.findOne({ _id: req.body.teacherId, schoolId: req.user.schoolId, role: 'teacher', isActive: true }),
  ]);
  if (!teacher) { res.status(400); throw new Error('Valid active teacher is required'); }
  const sameSession = [schoolClass, section, subject].every((item) => item.academicSessionId.equals(session._id));
  if (!sameSession || !section.classId.equals(schoolClass._id)) {
    res.status(400);
    throw new Error('Session, class, section and subject must match');
  }
  const record = await TeacherAssignment.create({
    schoolId: req.user.schoolId,
    academicSessionId: session._id,
    teacherId: teacher._id,
    classId: schoolClass._id,
    sectionId: section._id,
    subjectId: subject._id,
    assignmentRole: 'primary',
    assignedBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Teacher assigned', data: record });
});

const listTeacherAssignments = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId };
  for (const field of ['academicSessionId', 'teacherId', 'classId', 'sectionId', 'subjectId']) {
    if (req.query[field]) query[field] = req.query[field];
  }
  const records = await TeacherAssignment.find(query)
    .populate('teacherId', 'name email phone')
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .populate('subjectId', 'name code')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: records });
});

const updateTeacherAssignment = asyncHandler(async (req, res) => {
  const record = await findOwned(TeacherAssignment, req.params.id, req.user.schoolId, 'Teacher assignment');
  const academicSessionId = req.body.academicSessionId || record.academicSessionId;
  const teacherId = req.body.teacherId || record.teacherId;
  const classId = req.body.classId || record.classId;
  const sectionId = req.body.sectionId || record.sectionId;
  const subjectId = req.body.subjectId || record.subjectId;
  const [session, schoolClass, section, subject, teacher] = await Promise.all([
    findOwned(AcademicSession, academicSessionId, req.user.schoolId, 'Academic session'),
    findOwned(SchoolClass, classId, req.user.schoolId, 'Class'),
    findOwned(Section, sectionId, req.user.schoolId, 'Section'),
    findOwned(Subject, subjectId, req.user.schoolId, 'Subject'),
    User.findOne({ _id: teacherId, schoolId: req.user.schoolId, role: 'teacher', isActive: true }),
  ]);
  if (!teacher) { res.status(400); throw new Error('Valid active teacher is required'); }
  const sameSession = [schoolClass, section, subject].every((item) =>
    item.academicSessionId.equals(session._id)
  );
  if (!sameSession || !section.classId.equals(schoolClass._id)) {
    res.status(400);
    throw new Error('Session, class, section and subject must match');
  }
  Object.assign(record, {
    academicSessionId: session._id,
    teacherId: teacher._id,
    classId: schoolClass._id,
    sectionId: section._id,
    subjectId: subject._id,
    assignmentRole: req.body.assignmentRole || record.assignmentRole,
    isActive: req.body.isActive === undefined ? record.isActive : req.body.isActive,
  });
  if (record.isActive) {
    record.deactivatedBy = undefined;
    record.deactivatedAt = undefined;
  }
  await record.save();
  res.json({ success: true, message: 'Teacher assignment updated', data: record });
});

const deleteTeacherAssignment = asyncHandler(async (req, res) => {
  const record = await findOwned(TeacherAssignment, req.params.id, req.user.schoolId, 'Teacher assignment');
  await record.deleteOne();
  res.json({ success: true, message: 'Teacher assignment deleted' });
});

const deactivateTeacherAssignment = asyncHandler(async (req, res) => {
  const record = await findOwned(TeacherAssignment, req.params.id, req.user.schoolId, 'Teacher assignment');
  record.isActive = false;
  record.deactivatedBy = req.user._id;
  record.deactivatedAt = new Date();
  await record.save();
  res.json({ success: true, message: 'Teacher assignment deactivated', data: record });
});

module.exports = {
  createSession, listSessions, updateSession, setCurrentSession,
  createTerm, listTerms,
  createClass, listClasses,
  createSection, listSections, updateSection, deleteSection,
  createSubject, listSubjects, updateSubject, deleteSubject,
  createTeacherAssignment, listTeacherAssignments, updateTeacherAssignment,
  deleteTeacherAssignment, deactivateTeacherAssignment,
};

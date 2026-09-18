const asyncHandler = require('express-async-handler');
const Examination = require('../models/examination.model');
const AcademicSession = require('../models/academicSession.model');
const Term = require('../models/term.model');
const ExamSubject = require('../models/examSubject.model');
const ExamMark = require('../models/examMark.model');
const StudentEnrollment = require('../models/studentEnrollment.model');
const ParentStudent = require('../models/parentStudent.model');
const HomeworkMark = require('../models/homeworkMark.model');
const StudentStar = require('../models/studentStar.model');
const StudentCard = require('../models/studentCard.model');
const ExamAnswerSheet = require('../models/examAnswerSheet.model');

const accessiblePaper = async (req, res, id, allowLocked = false) => {
  const paper = await ExamSubject.findOne({ _id: id, schoolId: req.user.schoolId });
  if (!paper || (req.user.role === 'teacher' && !paper.assignedTeacherId.equals(req.user._id))) {
    res.status(403);
    throw new Error('Exam paper access denied');
  }
  if (!allowLocked && paper.isLocked) throw new Error('This exam paper is locked');
  return paper;
};

const createExam = asyncHandler(async (req, res) => {
  const { academicSessionId, termId, name, startDate, endDate } = req.body;
  if (!academicSessionId || !termId || !name || !startDate || !endDate) { res.status(400); throw new Error('Session, Term, name and dates are required'); }
  if (new Date(endDate) <= new Date(startDate)) { res.status(400); throw new Error('End date must be after start date'); }
  const data = await Examination.create({ schoolId: req.user.schoolId, academicSessionId, termId, name, startDate, endDate, createdBy: req.user._id });
  res.status(201).json({ success: true, message: 'Examination created', data });
});

const listExams = asyncHandler(async (req, res) => {
  const data = await Examination.find({ schoolId: req.user.schoolId }).populate('academicSessionId', 'name').populate('termId', 'name').sort({ startDate: -1 });
  res.json({ success: true, data });
});

const createExamSubject = asyncHandler(async (req, res) => {
  const required = ['examinationId', 'classId', 'sectionId', 'subjectId', 'assignedTeacherId', 'examDate', 'maximumMarks', 'passingMarks'];
  if (required.some((field) => req.body[field] === undefined || req.body[field] === '')) { res.status(400); throw new Error('All Exam Subject fields are required'); }
  if (Number(req.body.passingMarks) > Number(req.body.maximumMarks)) { res.status(400); throw new Error('Passing marks cannot exceed maximum marks'); }
  const exam = await Examination.findOne({ _id: req.body.examinationId, schoolId: req.user.schoolId });
  if (!exam) { res.status(404); throw new Error('Examination not found'); }
  const data = await ExamSubject.create({ ...req.body, schoolId: req.user.schoolId, createdBy: req.user._id });
  res.status(201).json({ success: true, message: 'Exam Subject added', data });
});

const listExamSubjects = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId };
  if (req.query.examinationId) query.examinationId = req.query.examinationId;
  if (req.user.role === 'teacher') query.assignedTeacherId = req.user._id;
  const data = await ExamSubject.find(query).populate('examinationId', 'name status').populate('classId', 'name').populate('sectionId', 'name').populate('subjectId', 'name').populate('assignedTeacherId', 'name').sort({ examDate: 1 });
  res.json({ success: true, data });
});

const getMarkSheet = asyncHandler(async (req, res) => {
  const examSubject = await ExamSubject.findOne({ _id: req.params.examSubjectId, schoolId: req.user.schoolId });
  if (!examSubject || (req.user.role === 'teacher' && !examSubject.assignedTeacherId.equals(req.user._id))) { res.status(403); throw new Error('Exam Subject access denied'); }
  const enrollments = await StudentEnrollment.find({ schoolId: req.user.schoolId, classId: examSubject.classId, sectionId: examSubject.sectionId, isCurrent: true }).populate('studentId', 'fullName admissionNumber');
  const marks = await ExamMark.find({ examSubjectId: examSubject._id });
  const markMap = new Map(marks.map((mark) => [mark.studentId.toString(), mark]));
  const students = enrollments.filter((item) => item.studentId).map((item) => ({ student: item.studentId, rollNumber: item.rollNumber, mark: markMap.get(item.studentId._id.toString()) || null }));
  res.json({ success: true, data: { examSubject, students } });
});

const saveMarks = asyncHandler(async (req, res) => {
  const examSubject = await ExamSubject.findOne({ _id: req.params.examSubjectId, schoolId: req.user.schoolId });
  if (!examSubject || examSubject.isLocked || (req.user.role === 'teacher' && !examSubject.assignedTeacherId.equals(req.user._id))) { res.status(403); throw new Error('Marks entry is not allowed'); }
  if (!Array.isArray(req.body.marks)) { res.status(400); throw new Error('Marks list is required'); }
  for (const item of req.body.marks) {
    const status = item.attendanceStatus || 'present';
    const obtained = status === 'present' ? Number(item.obtainedMarks) : undefined;
    if (status === 'present' && (!Number.isFinite(obtained) || obtained < 0 || obtained > examSubject.maximumMarks)) continue;
    await ExamMark.findOneAndUpdate(
      { examSubjectId: examSubject._id, studentId: item.studentId },
      { $set: { schoolId: req.user.schoolId, obtainedMarks: obtained, attendanceStatus: status, remarks: item.remarks || '', enteredBy: req.user._id, updatedBy: req.user._id } },
      { upsert: true, new: true, runValidators: true }
    );
  }
  res.json({ success: true, message: 'Exam marks saved' });
});

const listAnswerSheets = asyncHandler(async (req, res) => {
  const paper = await accessiblePaper(req, res, req.params.examSubjectId, true);
  const data = await ExamAnswerSheet.find({ examSubjectId: paper._id, schoolId: req.user.schoolId })
    .populate('studentId', 'fullName admissionNumber').sort({ rollNumber: 1 });
  res.json({ success: true, data });
});

const allocateAnswerSheet = asyncHandler(async (req, res) => {
  const paper = await accessiblePaper(req, res, req.params.examSubjectId);
  const cardCode = String(req.body.cardCode || '').trim().toUpperCase();
  const sheetNumber = String(req.body.sheetNumber || '').trim().toUpperCase();
  if (!cardCode || !sheetNumber) { res.status(400); throw new Error('Student Card and Answer Sheet codes are required'); }
  const card = await StudentCard.findOne({ schoolId: req.user.schoolId, cardCode, status: 'active' });
  if (!card || (card.expiresAt && card.expiresAt < new Date())) { res.status(404); throw new Error('Student Card is invalid, expired or revoked'); }
  const enrollment = await StudentEnrollment.findOne({ schoolId: req.user.schoolId, studentId: card.studentId, classId: paper.classId, sectionId: paper.sectionId, isCurrent: true, status: 'active' }).populate('studentId', 'fullName admissionNumber');
  if (!enrollment) { res.status(400); throw new Error('Student is not enrolled in this paper Class and Section'); }
  const usedSheet = await ExamAnswerSheet.findOne({ schoolId: req.user.schoolId, sheetNumber });
  if (usedSheet && (!usedSheet.examSubjectId.equals(paper._id) || !usedSheet.studentId.equals(card.studentId))) { res.status(409); throw new Error('Answer Sheet code is already allocated'); }
  const sheet = await ExamAnswerSheet.findOneAndUpdate(
    { examSubjectId: paper._id, studentId: card.studentId },
    { $setOnInsert: { schoolId: req.user.schoolId, enrollmentId: enrollment._id, sheetNumber, studentCardCode: cardCode, rollNumber: enrollment.rollNumber, attendanceStatus: 'present', scannedAt: new Date(), scannedBy: req.user._id } },
    { upsert: true, new: true, runValidators: true }
  ).populate('studentId', 'fullName admissionNumber');
  await ExamMark.findOneAndUpdate(
    { examSubjectId: paper._id, studentId: card.studentId },
    { $set: { schoolId: req.user.schoolId, attendanceStatus: 'present', enteredBy: req.user._id, updatedBy: req.user._id } },
    { upsert: true, new: true, runValidators: true }
  );
  res.status(201).json({ success: true, message: 'Sheet allocated and exam attendance marked', data: sheet });
});

const allocateAnswerSheetManually = asyncHandler(async (req, res) => {
  const paper = await accessiblePaper(req, res, req.params.examSubjectId);
  const rollNumber = String(req.body.rollNumber || '').trim().toUpperCase();
  const sheetNumber = String(req.body.sheetNumber || '').trim().toUpperCase();
  if (!rollNumber || !sheetNumber) {
    res.status(400);
    throw new Error('Roll Number and Answer Sheet Number are required');
  }
  const enrollment = await StudentEnrollment.findOne({
    schoolId: req.user.schoolId,
    classId: paper.classId,
    sectionId: paper.sectionId,
    rollNumber,
    isCurrent: true,
    status: 'active',
  }).populate('studentId', 'fullName admissionNumber');
  if (!enrollment || !enrollment.studentId) {
    res.status(404);
    throw new Error('No active student found with this Roll Number in the paper Class and Section');
  }
  const usedSheet = await ExamAnswerSheet.findOne({ schoolId: req.user.schoolId, sheetNumber });
  if (usedSheet && (!usedSheet.examSubjectId.equals(paper._id) || !usedSheet.studentId.equals(enrollment.studentId._id))) {
    res.status(409);
    throw new Error('Answer Sheet Number is already allocated to another student');
  }
  const existingStudentSheet = await ExamAnswerSheet.findOne({ examSubjectId: paper._id, studentId: enrollment.studentId._id });
  if (existingStudentSheet && existingStudentSheet.sheetNumber !== sheetNumber) {
    res.status(409);
    throw new Error(`This student is already linked with sheet ${existingStudentSheet.sheetNumber}`);
  }
  const sheet = existingStudentSheet || await ExamAnswerSheet.create({
    schoolId: req.user.schoolId,
    examSubjectId: paper._id,
    studentId: enrollment.studentId._id,
    enrollmentId: enrollment._id,
    sheetNumber,
    studentCardCode: 'MANUAL',
    rollNumber: enrollment.rollNumber,
    attendanceStatus: 'present',
    scannedAt: new Date(),
    scannedBy: req.user._id,
  });
  await sheet.populate('studentId', 'fullName admissionNumber');
  await ExamMark.findOneAndUpdate(
    { examSubjectId: paper._id, studentId: enrollment.studentId._id },
    { $set: { schoolId: req.user.schoolId, attendanceStatus: 'present', enteredBy: req.user._id, updatedBy: req.user._id } },
    { upsert: true, new: true, runValidators: true }
  );
  res.status(201).json({ success: true, message: 'Sheet linked by Roll Number and exam attendance marked', data: sheet });
});

const getAnswerSheet = asyncHandler(async (req, res) => {
  const sheet = await ExamAnswerSheet.findOne({ schoolId: req.user.schoolId, sheetNumber: req.params.sheetNumber.toUpperCase() }).populate('studentId', 'fullName admissionNumber');
  if (!sheet) { res.status(404); throw new Error('Answer Sheet not found'); }
  await accessiblePaper(req, res, sheet.examSubjectId, true);
  res.json({ success: true, data: sheet });
});

const submitAnswerSheetMarks = asyncHandler(async (req, res) => {
  const sheet = await ExamAnswerSheet.findOne({ schoolId: req.user.schoolId, sheetNumber: req.params.sheetNumber.toUpperCase() });
  if (!sheet) { res.status(404); throw new Error('Answer Sheet not found'); }
  const paper = await accessiblePaper(req, res, sheet.examSubjectId);
  if (!Array.isArray(req.body.questionMarks) || req.body.questionMarks.length === 0) { res.status(400); throw new Error('Question-wise marks are required'); }
  const seen = new Set();
  const questionMarks = req.body.questionMarks.map((item) => {
    const questionNumber = String(item.questionNumber || '').trim();
    const obtainedMarks = Number(item.obtainedMarks);
    if (!questionNumber || seen.has(questionNumber) || !Number.isFinite(obtainedMarks) || obtainedMarks < 0) throw new Error('Every question needs a unique number and valid marks');
    seen.add(questionNumber);
    return { questionNumber, obtainedMarks };
  });
  const total = questionMarks.reduce((sum, item) => sum + item.obtainedMarks, 0);
  if (total > paper.maximumMarks) { res.status(400); throw new Error(`Total cannot exceed ${paper.maximumMarks}`); }
  sheet.questionMarks = questionMarks;
  sheet.totalObtained = total;
  sheet.status = 'submitted';
  sheet.submittedAt = new Date();
  sheet.submittedBy = req.user._id;
  sheet.remarks = req.body.remarks || '';
  await sheet.save();
  await ExamMark.findOneAndUpdate(
    { examSubjectId: paper._id, studentId: sheet.studentId },
    { $set: { schoolId: req.user.schoolId, obtainedMarks: total, attendanceStatus: 'present', remarks: sheet.remarks, enteredBy: req.user._id, updatedBy: req.user._id } },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ success: true, message: 'Question marks and result submitted', data: sheet });
});

const updateExam = asyncHandler(async (req, res) => {
  const exam = await Examination.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!exam) { res.status(404); throw new Error('Examination not found'); }

  const academicSessionId = req.body.academicSessionId || exam.academicSessionId;
  const termId = req.body.termId || exam.termId;
  const [session, term] = await Promise.all([
    AcademicSession.findOne({ _id: academicSessionId, schoolId: req.user.schoolId }),
    Term.findOne({ _id: termId, schoolId: req.user.schoolId }),
  ]);
  if (!session || !term) {
    res.status(400);
    throw new Error('Valid academic session and term are required');
  }
  if (!term.academicSessionId.equals(session._id)) {
    res.status(400);
    throw new Error('Term does not belong to the selected academic session');
  }

  const startDate = req.body.startDate ? new Date(req.body.startDate) : exam.startDate;
  const endDate = req.body.endDate ? new Date(req.body.endDate) : exam.endDate;
  if (endDate <= startDate) {
    res.status(400);
    throw new Error('End date must be after start date');
  }
  if (startDate < term.startDate || endDate > term.endDate) {
    res.status(400);
    throw new Error('Examination dates must be inside the selected term dates');
  }

  const fields = ['name', 'status'];
  for (const field of fields) {
    if (req.body[field] !== undefined) exam[field] = req.body[field];
  }
  exam.academicSessionId = session._id;
  exam.termId = term._id;
  exam.startDate = startDate;
  exam.endDate = endDate;
  exam.updatedBy = req.user._id;
  await exam.save();
  res.json({ success: true, message: 'Examination updated', data: exam });
});

const updateExamStatus = asyncHandler(async (req, res) => {
  const allowed = ['draft', 'active', 'completed', 'published'];
  if (!allowed.includes(req.body.status)) {
    res.status(400);
    throw new Error('Valid examination status is required');
  }
  const data = await Examination.findOneAndUpdate(
    { _id: req.params.id, schoolId: req.user.schoolId },
    { $set: { status: req.body.status } },
    { new: true, runValidators: true }
  );
  if (!data) {
    res.status(404);
    throw new Error('Examination not found');
  }
  res.json({ success: true, message: 'Examination status updated', data });
});

const getParentResults = asyncHandler(async (req, res) => {
  const links = await ParentStudent.find({
    schoolId: req.user.schoolId,
    parentId: req.user._id,
    isActive: true,
    canViewAcademicData: true,
  }).populate('studentId', 'fullName admissionNumber profileImage status');

  const children = [];
  for (const link of links) {
    if (!link.studentId) continue;
    const marks = await ExamMark.find({
      schoolId: req.user.schoolId,
      studentId: link.studentId._id,
    })
      .populate({
        path: 'examSubjectId',
        match: { schoolId: req.user.schoolId },
        populate: [
          {
            path: 'examinationId',
            match: { schoolId: req.user.schoolId, status: 'published' },
            select: 'name status startDate endDate academicSessionId termId',
            populate: [
              { path: 'academicSessionId', select: 'name' },
              { path: 'termId', select: 'name' },
            ],
          },
          { path: 'subjectId', select: 'name' },
          { path: 'classId', select: 'name' },
          { path: 'sectionId', select: 'name' },
        ],
      })
      .sort({ createdAt: 1 });

    const examMap = new Map();
    for (const mark of marks) {
      const paper = mark.examSubjectId;
      const exam = paper?.examinationId;
      if (!paper || !exam) continue;
      const examId = exam._id.toString();
      if (!examMap.has(examId)) {
        examMap.set(examId, {
          examination: exam,
          class: paper.classId,
          section: paper.sectionId,
          subjects: [],
          obtainedTotal: 0,
          maximumTotal: 0,
          result: 'pass',
        });
      }
      const group = examMap.get(examId);
      const isPresent = mark.attendanceStatus === 'present';
      const obtained = isPresent ? Number(mark.obtainedMarks || 0) : null;
      const passed = mark.attendanceStatus === 'exempted' ||
        (isPresent && obtained >= paper.passingMarks);
      group.subjects.push({
        subject: paper.subjectId,
        examDate: paper.examDate,
        maximumMarks: paper.maximumMarks,
        passingMarks: paper.passingMarks,
        obtainedMarks: obtained,
        attendanceStatus: mark.attendanceStatus,
        remarks: mark.remarks,
        passed,
      });
      if (mark.attendanceStatus !== 'exempted') {
        group.maximumTotal += Number(paper.maximumMarks);
        group.obtainedTotal += obtained || 0;
      }
      if (!passed) group.result = 'fail';
    }

    const results = Array.from(examMap.values()).map((group) => ({
      ...group,
      percentage: group.maximumTotal === 0
        ? 0
        : Number(((group.obtainedTotal / group.maximumTotal) * 100).toFixed(2)),
    }));
    const homeworkMarks = await HomeworkMark.find({
      schoolId: req.user.schoolId,
      studentId: link.studentId._id,
    }).populate({
      path: 'homeworkId',
      select: 'title maximumMarks assignedDate dueDate subjectId',
      populate: { path: 'subjectId', select: 'name' },
    }).sort({ checkedAt: -1 });
    const validHomeworkMarks = homeworkMarks.filter((mark) => mark.homeworkId);
    const homeworkObtainedTotal = validHomeworkMarks.reduce(
      (sum, mark) => sum + Number(mark.obtainedMarks || 0),
      0
    );
    const homeworkMaximumTotal = validHomeworkMarks.reduce(
      (sum, mark) => sum + Number(mark.homeworkId.maximumMarks || 10),
      0
    );
    const homeworkStars = await StudentStar.find({
      schoolId: req.user.schoolId,
      studentId: link.studentId._id,
      category: 'homework',
    })
      .populate('teacherId', 'name')
      .populate({
        path: 'homeworkId',
        select: 'title assignedDate subjectId',
        populate: { path: 'subjectId', select: 'name' },
      })
      .sort({ awardedAt: -1 });
    const homeworkStarAverage = homeworkStars.length === 0
      ? 0
      : Number((homeworkStars.reduce((sum, item) => sum + item.stars, 0) / homeworkStars.length).toFixed(1));
    children.push({
      student: link.studentId,
      homeworkSummary: {
        checkedCount: validHomeworkMarks.length,
        obtainedTotal: homeworkObtainedTotal,
        maximumTotal: homeworkMaximumTotal,
        percentage: homeworkMaximumTotal === 0
          ? 0
          : Number(((homeworkObtainedTotal / homeworkMaximumTotal) * 100).toFixed(1)),
        recentMarks: validHomeworkMarks.slice(0, 5),
        starAverage: homeworkStarAverage,
        starCount: homeworkStars.length,
        recentStars: homeworkStars.slice(0, 5),
      },
      results: results.reverse(),
    });
  }
  res.json({ success: true, data: children });
});

module.exports = {
  createExam,
  listExams,
  createExamSubject,
  listExamSubjects,
  getMarkSheet,
  saveMarks,
  updateExam,
  updateExamStatus,
  getParentResults,
  listAnswerSheets,
  allocateAnswerSheet,
  allocateAnswerSheetManually,
  getAnswerSheet,
  submitAnswerSheetMarks,
};

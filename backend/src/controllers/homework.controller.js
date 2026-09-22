const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { Readable } = require('stream');
const { getTenant } = require('../config/tenantModels');
const Homework = require('../models/homework.model');
const TeacherAssignment = require('../models/teacherAssignment.model');
const ParentStudent = require('../models/parentStudent.model');
const StudentEnrollment = require('../models/studentEnrollment.model');
const HomeworkMark = require('../models/homeworkMark.model');
const StudentStar = require('../models/studentStar.model');
const HomeworkResponse = require('../models/homeworkResponse.model');

const getAdminHomeworkMarks = asyncHandler(async (req, res) => {
  const query = req.user.role === 'superAdmin' ? {} : { schoolId: req.user.schoolId };
  if (req.query.studentId) query.studentId = req.query.studentId;
  if (req.query.teacherId) query.teacherId = req.query.teacherId;
  if (req.query.homeworkId) query.homeworkId = req.query.homeworkId;
  const data = await HomeworkMark.find(query)
    .populate('schoolId', 'name')
    .populate('studentId', 'fullName admissionNumber')
    .populate('teacherId', 'name')
    .populate({
      path: 'homeworkId',
      select: 'title maximumMarks assignedDate dueDate classId sectionId subjectId',
      populate: [
        { path: 'classId', select: 'name' },
        { path: 'sectionId', select: 'name' },
        { path: 'subjectId', select: 'name' },
      ],
    })
    .sort({ checkedAt: -1, createdAt: -1 })
    .limit(500);
  res.json({ success: true, data: data.filter((item) => item.homeworkId) });
});

const populateHomework = (query) => query
  .populate('schoolId', 'name')
  .populate('academicSessionId', 'name')
  .populate('classId', 'name')
  .populate('sectionId', 'name')
  .populate('subjectId', 'name')
  .populate('teacherId', 'name');

const requireOwnAssignment = async (req, assignmentId) => {
  const assignment = await TeacherAssignment.findOne({
    _id: assignmentId,
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
    isActive: true,
  });
  if (!assignment) {
    const error = new Error('Active Teacher assignment not found');
    error.statusCode = 403;
    throw error;
  }
  return assignment;
};

const allowedAttachmentExtensions = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx',
  'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'mp4', 'mov', 'webm',
]);

const uploadHomeworkAttachment = asyncHandler(async (req, res) => {
  const { fileName, mimeType, data } = req.body;
  const safeName = String(fileName || '').replace(/[^a-zA-Z0-9._ -]/g, '_').trim();
  const extension = safeName.includes('.') ? safeName.split('.').pop().toLowerCase() : '';
  if (!safeName || !data || !allowedAttachmentExtensions.has(extension)) {
    res.status(400);
    throw new Error('Select a supported image, document or video file');
  }
  let buffer;
  try {
    buffer = Buffer.from(String(data), 'base64');
  } catch (_error) {
    res.status(400);
    throw new Error('Invalid attachment data');
  }
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) {
    res.status(400);
    throw new Error('Attachment must be smaller than 20 MB');
  }
  const tenant = getTenant();
  const bucket = new mongoose.mongo.GridFSBucket(tenant.connection.db, {
    bucketName: 'homeworkAttachments',
  });
  const uploadStream = bucket.openUploadStream(safeName, {
    contentType: String(mimeType || 'application/octet-stream'),
    metadata: {
      schoolId: req.user.schoolId.toString(),
      uploadedBy: req.user._id.toString(),
      schoolCode: req.schoolCode,
    },
  });
  await new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(uploadStream).on('error', reject).on('finish', resolve);
  });
  res.status(201).json({
    success: true,
    data: {
      attachmentUrl: `/api/homework/attachments/${uploadStream.id}?schoolCode=${encodeURIComponent(req.schoolCode)}`,
      attachmentName: safeName,
      attachmentType: String(mimeType || 'application/octet-stream'),
    },
  });
});

const downloadHomeworkAttachment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.fileId)) {
    res.status(404);
    throw new Error('Attachment not found');
  }
  const tenant = getTenant();
  const bucket = new mongoose.mongo.GridFSBucket(tenant.connection.db, {
    bucketName: 'homeworkAttachments',
  });
  const files = await bucket.find({ _id: new mongoose.Types.ObjectId(req.params.fileId) }).toArray();
  if (!files.length) {
    res.status(404);
    throw new Error('Attachment not found');
  }
  const file = files[0];
  res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${String(file.filename).replace(/"/g, '')}"`);
  bucket.openDownloadStream(file._id).on('error', (error) => {
    if (!res.headersSent) res.status(404).json({ success: false, message: error.message });
    else res.destroy(error);
  }).pipe(res);
});

const getTeacherHomework = asyncHandler(async (req, res) => {
  const data = await populateHomework(Homework.find({
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
  }).sort({ assignedDate: -1, createdAt: -1 }));
  res.json({ success: true, data });
});

const createHomework = asyncHandler(async (req, res) => {
  const {
    assignmentId, title, description, assignedDate, dueDate, status,
    attachmentUrl, attachmentName, attachmentType, maximumMarks,
  } = req.body;
  if (!assignmentId || !title?.trim() || !description?.trim() || !dueDate) {
    res.status(400);
    throw new Error('Assignment, title, description and due date are required');
  }
  const assignment = await requireOwnAssignment(req, assignmentId);
  const start = assignedDate ? new Date(assignedDate) : new Date();
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime()) || due < start) {
    res.status(400);
    throw new Error('Due date must be on or after assigned date');
  }
  const item = await Homework.create({
    schoolId: req.user.schoolId,
    academicSessionId: assignment.academicSessionId,
    assignmentId: assignment._id,
    teacherId: req.user._id,
    classId: assignment.classId,
    sectionId: assignment.sectionId,
    subjectId: assignment.subjectId,
    title: title.trim(),
    description: description.trim(),
    assignedDate: start,
    dueDate: due,
    status: ['draft', 'published'].includes(status) ? status : 'published',
    attachmentUrl: attachmentUrl?.trim() || '',
    attachmentName: attachmentName?.trim() || '',
    attachmentType: attachmentType?.trim() || '',
    maximumMarks: Number(maximumMarks) > 0 ? Number(maximumMarks) : 10,
  });
  const data = await populateHomework(Homework.findById(item._id));
  res.status(201).json({ success: true, data });
});

const updateHomework = asyncHandler(async (req, res) => {
  const item = await Homework.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
  });
  if (!item) {
    res.status(404);
    throw new Error('Homework not found');
  }
  const allowed = [
    'title', 'description', 'assignedDate', 'dueDate', 'status',
    'attachmentUrl', 'attachmentName', 'attachmentType', 'maximumMarks',
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  }
  if (!item.title.trim() || !item.description.trim() || item.dueDate < item.assignedDate) {
    res.status(400);
    throw new Error('Valid title, description and due date are required');
  }
  item.updatedBy = req.user._id;
  await item.save();
  const data = await populateHomework(Homework.findById(item._id));
  res.json({ success: true, data });
});

const deleteHomework = asyncHandler(async (req, res) => {
  const item = await Homework.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
  });
  if (!item) {
    res.status(404);
    throw new Error('Homework not found');
  }
  await item.deleteOne();
  res.json({ success: true, data: { id: req.params.id } });
});

const getParentHomework = asyncHandler(async (req, res) => {
  const links = await ParentStudent.find({
    schoolId: req.user.schoolId,
    parentId: req.user._id,
    isActive: true,
    canViewAcademicData: true,
  }).populate('studentId', 'fullName admissionNumber profileImage status');

  const groups = [];
  for (const link of links) {
    if (!link.studentId || link.studentId.status !== 'active') continue;
    const enrollment = await StudentEnrollment.findOne({
      schoolId: req.user.schoolId,
      studentId: link.studentId._id,
      isCurrent: true,
      status: 'active',
    })
      .populate('classId', 'name')
      .populate('sectionId', 'name');
    if (!enrollment) continue;
    const homeworkDocuments = await populateHomework(Homework.find({
      schoolId: req.user.schoolId,
      academicSessionId: enrollment.academicSessionId,
      classId: enrollment.classId._id,
      sectionId: enrollment.sectionId._id,
      status: { $in: ['published', 'closed'] },
    }).sort({ assignedDate: -1, createdAt: -1 }));
    const homeworks = [];
    for (const homework of homeworkDocuments) {
      const mark = await HomeworkMark.findOne({
        schoolId: req.user.schoolId,
        homeworkId: homework._id,
        studentId: link.studentId._id,
      }).populate('teacherId', 'name');
      const star = await StudentStar.findOne({
        schoolId: req.user.schoolId,
        homeworkId: homework._id,
        studentId: link.studentId._id,
        category: 'homework',
      }).populate('teacherId', 'name');
      const parentResponse = await HomeworkResponse.findOne({
        schoolId: req.user.schoolId,
        homeworkId: homework._id,
        studentId: link.studentId._id,
        parentId: req.user._id,
      });
      homeworks.push({ ...homework.toObject(), mark, star, parentResponse });
    }
    groups.push({ student: link.studentId, enrollment, homeworks });
  }
  res.json({ success: true, data: groups });
});

const getHomeworkMarkSheet = asyncHandler(async (req, res) => {
  const homework = await populateHomework(Homework.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
  }));
  if (!homework) {
    res.status(404);
    throw new Error('Homework not found');
  }
  const enrollments = await StudentEnrollment.find({
    schoolId: req.user.schoolId,
    academicSessionId: homework.academicSessionId._id,
    classId: homework.classId._id,
    sectionId: homework.sectionId._id,
    isCurrent: true,
    status: 'active',
  })
    .populate({ path: 'studentId', match: { status: 'active' }, select: 'fullName admissionNumber' })
    .sort({ rollNumber: 1 });
  const students = [];
  for (const enrollment of enrollments) {
    if (!enrollment.studentId) continue;
    const mark = await HomeworkMark.findOne({ homeworkId: homework._id, studentId: enrollment.studentId._id });
    const star = await StudentStar.findOne({
      homeworkId: homework._id,
      studentId: enrollment.studentId._id,
      category: 'homework',
    });
    students.push({ enrollmentId: enrollment._id, rollNumber: enrollment.rollNumber, student: enrollment.studentId, mark, star });
  }
  res.json({ success: true, data: { homework, students } });
});

const saveHomeworkMarks = asyncHandler(async (req, res) => {
  const homework = await Homework.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
  });
  if (!homework) {
    res.status(404);
    throw new Error('Homework not found');
  }
  const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
  if (!entries.length) {
    res.status(400);
    throw new Error('At least one Student mark is required');
  }
  for (const entry of entries) {
    const obtainedMarks = Number(entry.obtainedMarks);
    if (entry.obtainedMarks === null || entry.obtainedMarks === undefined || !entry.studentId || Number.isNaN(obtainedMarks) || obtainedMarks < 0 || obtainedMarks > homework.maximumMarks) {
      res.status(400);
      throw new Error(`Marks must be between 0 and ${homework.maximumMarks}`);
    }
    const enrollment = await StudentEnrollment.findOne({
      schoolId: req.user.schoolId,
      studentId: entry.studentId,
      academicSessionId: homework.academicSessionId,
      classId: homework.classId,
      sectionId: homework.sectionId,
      isCurrent: true,
      status: 'active',
    });
    if (!enrollment) {
      res.status(400);
      throw new Error('One selected Student is not enrolled in this Homework Class');
    }
    await HomeworkMark.updateOne(
      { homeworkId: homework._id, studentId: entry.studentId },
      {
        $set: {
          schoolId: req.user.schoolId,
          teacherId: req.user._id,
          obtainedMarks,
          remarks: entry.remarks?.trim() || '',
          checkedAt: new Date(),
        },
      },
      { upsert: true }
    );
    if (entry.stars !== null && entry.stars !== undefined && entry.stars !== '') {
      const numericStars = Number(entry.stars);
      if (!Number.isInteger(numericStars) || numericStars < 1 || numericStars > 5) {
        res.status(400);
        throw new Error('Homework stars must be between 1 and 5');
      }
      await StudentStar.updateOne(
        { homeworkId: homework._id, studentId: entry.studentId },
        {
          $set: {
            schoolId: req.user.schoolId,
            academicSessionId: homework.academicSessionId,
            assignmentId: homework.assignmentId,
            teacherId: req.user._id,
            classId: homework.classId,
            sectionId: homework.sectionId,
            category: 'homework',
            stars: numericStars,
            comment: entry.starComment?.trim() || entry.remarks?.trim() || '',
            awardedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
  }
  res.json({ success: true, data: { saved: entries.length } });
});

const saveParentHomeworkResponse = asyncHandler(async (req, res) => {
  const { studentId, responseStatus, message } = req.body;
  if (!studentId || !['seen', 'completed', 'needsHelp'].includes(responseStatus)) {
    res.status(400);
    throw new Error('Student and a valid Homework response are required');
  }
  const homework = await Homework.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
    status: { $in: ['published', 'closed'] },
  });
  if (!homework) {
    res.status(404);
    throw new Error('Published Homework not found');
  }
  const parentLink = await ParentStudent.findOne({
    schoolId: req.user.schoolId,
    parentId: req.user._id,
    studentId,
    isActive: true,
    canViewAcademicData: true,
  });
  const enrollment = parentLink && await StudentEnrollment.findOne({
    schoolId: req.user.schoolId,
    studentId,
    academicSessionId: homework.academicSessionId,
    classId: homework.classId,
    sectionId: homework.sectionId,
    isCurrent: true,
    status: 'active',
  });
  if (!parentLink || !enrollment) {
    res.status(403);
    throw new Error('This child is not linked to the Parent for this Homework');
  }
  const data = await HomeworkResponse.findOneAndUpdate(
    { homeworkId: homework._id, studentId, parentId: req.user._id },
    {
      $set: {
        schoolId: req.user.schoolId,
        teacherId: homework.teacherId,
        responseStatus,
        message: message?.trim() || '',
        respondedAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ success: true, data });
});

const buildHomeworkResponseReport = async (homeworkQuery) => {
  const homeworks = await populateHomework(homeworkQuery.sort({ assignedDate: -1 }).limit(100));
  const reports = [];
  let expectedResponses = 0;
  let receivedResponses = 0;
  for (const homework of homeworks) {
    const homeworkSchoolId = homework.schoolId?._id || homework.schoolId;
    const enrollments = await StudentEnrollment.find({
      schoolId: homeworkSchoolId,
      academicSessionId: homework.academicSessionId._id,
      classId: homework.classId._id,
      sectionId: homework.sectionId._id,
      isCurrent: true,
      status: 'active',
    }).select('studentId');
    const eligibleLinks = await ParentStudent.find({
      schoolId: homeworkSchoolId,
      studentId: { $in: enrollments.map((item) => item.studentId) },
      isActive: true,
      canViewAcademicData: true,
    })
      .populate('studentId', 'fullName admissionNumber')
      .populate('parentId', 'name email');
    const expected = eligibleLinks.length;
    const responses = await HomeworkResponse.find({ homeworkId: homework._id })
      .populate('studentId', 'fullName admissionNumber')
      .populate('parentId', 'name email')
      .sort({ respondedAt: -1 });
    const responseKeys = new Set(responses.map(
      (item) => `${item.studentId?._id || item.studentId}:${item.parentId?._id || item.parentId}`
    ));
    const pendingParents = eligibleLinks
      .filter((item) => !responseKeys.has(`${item.studentId?._id || item.studentId}:${item.parentId?._id || item.parentId}`))
      .map((item) => ({ student: item.studentId, parent: item.parentId }));
    expectedResponses += expected;
    receivedResponses += responses.length;
    reports.push({
      homework,
      expectedResponses: expected,
      receivedResponses: responses.length,
      pendingResponses: Math.max(expected - responses.length, 0),
      responseRate: expected === 0 ? 0 : Number(((responses.length / expected) * 100).toFixed(1)),
      responses,
      pendingParents,
    });
  }
  return {
    summary: {
      homeworkCount: homeworks.length,
      expectedResponses,
      receivedResponses,
      pendingResponses: Math.max(expectedResponses - receivedResponses, 0),
      responseRate: expectedResponses === 0
        ? 0
        : Number(((receivedResponses / expectedResponses) * 100).toFixed(1)),
    },
    homeworkReports: reports,
  };
};

const getTeacherHomeworkResponses = asyncHandler(async (req, res) => {
  const data = await buildHomeworkResponseReport(Homework.find({
    schoolId: req.user.schoolId,
    teacherId: req.user._id,
  }));
  res.json({ success: true, data });
});

const getAdminHomeworkResponses = asyncHandler(async (req, res) => {
  const query = req.user.role === 'superAdmin'
    ? Homework.find({})
    : Homework.find({ schoolId: req.user.schoolId });
  const data = await buildHomeworkResponseReport(query);
  res.json({ success: true, data });
});

module.exports = {
  uploadHomeworkAttachment,
  downloadHomeworkAttachment,
  getTeacherHomework,
  createHomework,
  updateHomework,
  deleteHomework,
  getParentHomework,
  getHomeworkMarkSheet,
  saveHomeworkMarks,
  getAdminHomeworkMarks,
  saveParentHomeworkResponse,
  getTeacherHomeworkResponses,
  getAdminHomeworkResponses,
};

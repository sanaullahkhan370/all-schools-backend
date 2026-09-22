const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const FeeStructure = require('../models/feeStructure.model');
const FeeInvoice = require('../models/feeInvoice.model');
const FeePayment = require('../models/feePayment.model');
const Student = require('../models/student.model');
const ParentStudent = require('../models/parentStudent.model');
const StudentEnrollment = require('../models/studentEnrollment.model');
const UpcomingFee = require('../models/upcomingFee.model');

const createStructure = asyncHandler(async (req, res) => {
  const { academicSessionId, title, feeType, amount } = req.body;
  if (!academicSessionId || !title || !feeType || amount === undefined) { res.status(400); throw new Error('Session, title, fee type and amount are required'); }
  const data = await FeeStructure.create({ ...req.body, schoolId: req.user.schoolId, createdBy: req.user._id });
  res.status(201).json({ success: true, message: 'Fee structure created', data });
});

const listStructures = asyncHandler(async (req, res) => {
  const data = await FeeStructure.find({ schoolId: req.user.schoolId }).populate('academicSessionId', 'name').populate('classId', 'name').sort({ createdAt: -1 });
  res.json({ success: true, data });
});

const createInvoice = asyncHandler(async (req, res) => {
  const { studentId, academicSessionId, items, dueDate } = req.body;
  if (!studentId || !academicSessionId || !Array.isArray(items) || !items.length || !dueDate) { res.status(400); throw new Error('Student, Session, items and due date are required'); }
  const student = await Student.findOne({ _id: studentId, schoolId: req.user.schoolId });
  if (!student) { res.status(404); throw new Error('Student not found'); }
  const cleanItems = items.map((item) => ({ title: String(item.title || 'Fee'), feeType: String(item.feeType || 'other'), amount: Number(item.amount) })).filter((item) => item.amount >= 0);
  if (!cleanItems.length) { res.status(400); throw new Error('At least one valid fee item is required'); }
  const subtotal = cleanItems.reduce((sum, item) => sum + item.amount, 0);
  const discount = Math.max(Number(req.body.discount) || 0, 0);
  const fine = Math.max(Number(req.body.fine) || 0, 0);
  const totalAmount = Math.max(subtotal - discount + fine, 0);
  const invoiceNumber = `INV-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const data = await FeeInvoice.create({ schoolId: req.user.schoolId, academicSessionId, studentId, invoiceNumber, items: cleanItems, subtotal, discount, fine, totalAmount, remainingAmount: totalAmount, dueDate, createdBy: req.user._id });
  res.status(201).json({ success: true, message: 'Fee invoice generated', data });
});

const createBulkInvoices = asyncHandler(async (req, res) => {
  const {
    academicSessionId,
    classId,
    sectionId,
    title,
    feeType,
    amount,
    dueDate,
    billingMonth,
  } = req.body;

  if (!academicSessionId || !title?.trim() || !feeType || amount === undefined || !dueDate || !billingMonth) {
    res.status(400);
    throw new Error('Session, title, fee type, amount, due date and billing month are required');
  }

  const cleanAmount = Number(amount);
  if (!Number.isFinite(cleanAmount) || cleanAmount < 0) {
    res.status(400);
    throw new Error('A valid fee amount is required');
  }
  if (!/^\d{4}-\d{2}$/.test(String(billingMonth))) {
    res.status(400);
    throw new Error('Billing month must use YYYY-MM format');
  }

  const enrollmentQuery = {
    schoolId: req.user.schoolId,
    academicSessionId,
    isCurrent: true,
    status: 'active',
  };
  if (classId) enrollmentQuery.classId = classId;
  if (sectionId) enrollmentQuery.sectionId = sectionId;

  const enrollments = await StudentEnrollment.find(enrollmentQuery).select('studentId');
  const studentIds = [...new Set(enrollments.map((entry) => entry.studentId.toString()))];
  if (!studentIds.length) {
    res.status(400);
    throw new Error('No active students found for the selected class or section');
  }

  const billingKey = `${billingMonth}:${feeType}`;
  const existing = await FeeInvoice.find({
    schoolId: req.user.schoolId,
    academicSessionId,
    studentId: { $in: studentIds },
    billingKey,
    status: { $ne: 'cancelled' },
  }).select('studentId');
  const existingIds = new Set(existing.map((invoice) => invoice.studentId.toString()));

  const documents = studentIds
    .filter((studentId) => !existingIds.has(studentId))
    .map((studentId, index) => {
      const invoiceNumber = `INV-${Date.now()}-${index}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      return {
        schoolId: req.user.schoolId,
        academicSessionId,
        studentId,
        invoiceNumber,
        billingMonth,
        billingKey,
        items: [{ title: title.trim(), feeType, amount: cleanAmount }],
        subtotal: cleanAmount,
        discount: 0,
        fine: 0,
        totalAmount: cleanAmount,
        remainingAmount: cleanAmount,
        dueDate,
        createdBy: req.user._id,
      };
    });

  if (documents.length) await FeeInvoice.insertMany(documents);

  res.status(201).json({
    success: true,
    message: `${documents.length} invoices generated; ${existingIds.size} existing invoices skipped`,
    data: {
      eligibleCount: studentIds.length,
      createdCount: documents.length,
      skippedCount: existingIds.size,
    },
  });
});

const listInvoices = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId };
  if (req.query.studentId) query.studentId = req.query.studentId;
  if (req.query.status) query.status = req.query.status;
  const data = await FeeInvoice.find(query).populate('studentId', 'fullName admissionNumber').populate('academicSessionId', 'name').sort({ createdAt: -1 });
  res.json({ success: true, data });
});

const recalculateInvoice = async (invoiceId, schoolId) => {
  const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId });
  if (!invoice) return null;
  const payments = await FeePayment.find({ invoiceId: invoice._id, schoolId }).select('amount');
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  invoice.paidAmount = paidAmount;
  invoice.remainingAmount = Math.max(Number(invoice.totalAmount || 0) - paidAmount, 0);
  if (invoice.status !== 'cancelled') {
    invoice.status = invoice.remainingAmount === 0
      ? 'paid'
      : paidAmount > 0
        ? 'partiallyPaid'
        : 'unpaid';
  }
  await invoice.save();
  return invoice;
};

const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await FeeInvoice.findOne({ _id: req.params.invoiceId, schoolId: req.user.schoolId });
  if (!invoice) { res.status(404); throw new Error('Invoice not found'); }

  const currentItem = invoice.items?.[0] || {};
  const amount = req.body.amount === undefined ? Number(currentItem.amount || 0) : Number(req.body.amount);
  const discount = req.body.discount === undefined ? Number(invoice.discount || 0) : Number(req.body.discount);
  const fine = req.body.fine === undefined ? Number(invoice.fine || 0) : Number(req.body.fine);
  if (![amount, discount, fine].every(Number.isFinite) || amount < 0 || discount < 0 || fine < 0) {
    res.status(400); throw new Error('Amount, discount and fine must be valid non-negative numbers');
  }

  const totalAmount = Math.max(amount - discount + fine, 0);
  if (totalAmount < Number(invoice.paidAmount || 0)) {
    res.status(400); throw new Error('Invoice total cannot be less than the paid amount');
  }

  invoice.items = [{
    title: String(req.body.title ?? currentItem.title ?? 'Fee').trim() || 'Fee',
    feeType: String(req.body.feeType ?? currentItem.feeType ?? 'other'),
    amount,
  }];
  invoice.subtotal = amount;
  invoice.discount = discount;
  invoice.fine = fine;
  invoice.totalAmount = totalAmount;
  if (req.body.dueDate) invoice.dueDate = req.body.dueDate;
  await invoice.save();
  const data = await recalculateInvoice(invoice._id, req.user.schoolId);
  res.json({ success: true, message: 'Invoice updated', data });
});

const recordPayment = asyncHandler(async (req, res) => {
  const invoice = await FeeInvoice.findOne({ _id: req.params.invoiceId, schoolId: req.user.schoolId });
  if (!invoice || invoice.status === 'cancelled') { res.status(404); throw new Error('Payable invoice not found'); }
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > invoice.remainingAmount) { res.status(400); throw new Error('Payment amount is invalid'); }
  const method = req.body.method;
  if (!['cash', 'bankDeposit'].includes(method)) { res.status(400); throw new Error('Payment method must be cash or bankDeposit'); }
  const receiptNumber = `RCP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const payment = await FeePayment.create({ schoolId: req.user.schoolId, invoiceId: invoice._id, studentId: invoice.studentId, receiptNumber, amount, method, reference: req.body.reference || '', recordedBy: req.user._id });
  const updatedInvoice = await recalculateInvoice(invoice._id, req.user.schoolId);
  res.status(201).json({ success: true, message: 'Payment recorded', data: { payment, invoice: updatedInvoice } });
});

const updatePayment = asyncHandler(async (req, res) => {
  const payment = await FeePayment.findOne({ _id: req.params.paymentId, schoolId: req.user.schoolId });
  if (!payment) { res.status(404); throw new Error('Payment not found'); }
  const invoice = await FeeInvoice.findOne({ _id: payment.invoiceId, schoolId: req.user.schoolId });
  if (!invoice) { res.status(404); throw new Error('Invoice not found'); }

  const amount = req.body.amount === undefined ? Number(payment.amount) : Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) { res.status(400); throw new Error('Payment amount is invalid'); }
  const otherPayments = await FeePayment.find({
    schoolId: req.user.schoolId,
    invoiceId: invoice._id,
    _id: { $ne: payment._id },
  }).select('amount');
  const otherPaid = otherPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (otherPaid + amount > Number(invoice.totalAmount || 0)) {
    res.status(400); throw new Error('Payment exceeds the invoice balance');
  }

  const method = req.body.method ?? payment.method;
  if (!['cash', 'bankDeposit'].includes(method)) { res.status(400); throw new Error('Payment method must be cash or bankDeposit'); }
  payment.amount = amount;
  payment.method = method;
  if (req.body.reference !== undefined) payment.reference = String(req.body.reference || '');
  await payment.save();
  const updatedInvoice = await recalculateInvoice(invoice._id, req.user.schoolId);
  res.json({ success: true, message: 'Payment updated', data: { payment, invoice: updatedInvoice } });
});

const deletePayment = asyncHandler(async (req, res) => {
  const payment = await FeePayment.findOne({ _id: req.params.paymentId, schoolId: req.user.schoolId });
  if (!payment) { res.status(404); throw new Error('Payment not found'); }
  const invoiceId = payment.invoiceId;
  await payment.deleteOne();
  const invoice = await recalculateInvoice(invoiceId, req.user.schoolId);
  res.json({ success: true, message: 'Payment deleted', data: invoice });
});

const listPayments = asyncHandler(async (req, res) => {
  const query = { schoolId: req.user.schoolId };
  if (req.query.studentId) query.studentId = req.query.studentId;
  const data = await FeePayment.find(query).populate('studentId', 'fullName admissionNumber').populate('invoiceId', 'invoiceNumber totalAmount').sort({ paidAt: -1 });
  res.json({ success: true, data });
});

const createUpcomingFee = asyncHandler(async (req, res) => {
  const { academicSessionId, title, feeType, amount, expectedDate, dueDate } = req.body;
  if (!academicSessionId || !title?.trim() || !feeType || amount === undefined || !expectedDate || !dueDate) {
    res.status(400);
    throw new Error('Session, title, fee type, amount, expected date and due date are required');
  }
  if (new Date(dueDate) < new Date(expectedDate)) {
    res.status(400);
    throw new Error('Due date must be on or after expected date');
  }
  const data = await UpcomingFee.create({
    schoolId: req.user.schoolId,
    academicSessionId,
    classId: req.body.classId || null,
    studentId: req.body.studentId || null,
    title: title.trim(),
    feeType,
    amount: Number(amount),
    expectedDate,
    dueDate,
    description: req.body.description?.trim() || '',
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data });
});

const listUpcomingFees = asyncHandler(async (req, res) => {
  const data = await UpcomingFee.find({ schoolId: req.user.schoolId, isActive: true })
    .populate('academicSessionId', 'name')
    .populate('classId', 'name')
    .populate('studentId', 'fullName admissionNumber')
    .sort({ expectedDate: 1 });
  res.json({ success: true, data });
});

const getParentFeeStatus = asyncHandler(async (req, res) => {
  const links = await ParentStudent.find({
    schoolId: req.user.schoolId,
    parentId: req.user._id,
    isActive: true,
    canPayFees: true,
  }).populate('studentId', 'fullName admissionNumber profileImage status');

  const children = [];
  for (const link of links) {
    if (!link.studentId) continue;
    const invoices = await FeeInvoice.find({
      schoolId: req.user.schoolId,
      studentId: link.studentId._id,
      status: { $ne: 'cancelled' },
    })
      .populate('academicSessionId', 'name')
      .sort({ issueDate: -1, createdAt: -1 });
    const enrollment = await StudentEnrollment.findOne({
      schoolId: req.user.schoolId,
      studentId: link.studentId._id,
      isCurrent: true,
      status: 'active',
    });
    const upcomingMatch = [
      { studentId: link.studentId._id },
      { studentId: null, classId: enrollment?.classId || null },
      { studentId: null, classId: null },
    ];
    const upcomingFees = await UpcomingFee.find({
      schoolId: req.user.schoolId,
      status: 'planned',
      isActive: true,
      $or: upcomingMatch,
    })
      .populate('academicSessionId', 'name')
      .populate('classId', 'name')
      .sort({ expectedDate: 1 });

    const invoiceData = [];
    for (const invoice of invoices) {
      const payments = await FeePayment.find({
        schoolId: req.user.schoolId,
        invoiceId: invoice._id,
        studentId: link.studentId._id,
      }).sort({ paidAt: -1 });
      const isOverdue = invoice.remainingAmount > 0 &&
        new Date(invoice.dueDate) < new Date();
      invoiceData.push({
        invoice,
        displayStatus: isOverdue ? 'overdue' : invoice.status,
        payments,
      });
    }

    const summary = invoiceData.reduce(
      (total, entry) => {
        total.totalAmount += Number(entry.invoice.totalAmount || 0);
        total.paidAmount += Number(entry.invoice.paidAmount || 0);
        total.remainingAmount += Number(entry.invoice.remainingAmount || 0);
        if (entry.displayStatus === 'overdue') total.overdueInvoices += 1;
        return total;
      },
      { totalAmount: 0, paidAmount: 0, remainingAmount: 0, overdueInvoices: 0 }
    );

    summary.upcomingAmount = upcomingFees.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    summary.upcomingCount = upcomingFees.length;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const followingMonthStart = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const currentMonthInvoices = invoiceData.filter((entry) => {
      const issueDate = new Date(entry.invoice.issueDate);
      return issueDate >= currentMonthStart && issueDate < nextMonthStart;
    });
    summary.currentMonth = currentMonthInvoices.reduce(
      (total, entry) => {
        total.billed += Number(entry.invoice.totalAmount || 0);
        total.paid += Number(entry.invoice.paidAmount || 0);
        total.remaining += Number(entry.invoice.remainingAmount || 0);
        return total;
      },
      { billed: 0, paid: 0, remaining: 0 }
    );
    const nextMonthFees = upcomingFees.filter((item) => {
      const expectedDate = new Date(item.expectedDate);
      return expectedDate >= nextMonthStart && expectedDate < followingMonthStart;
    });
    summary.nextMonth = {
      amount: nextMonthFees.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      count: nextMonthFees.length,
      month: nextMonthStart.toLocaleString('en', { month: 'long', year: 'numeric' }),
    };
    const duesMap = new Map();
    for (const entry of invoiceData) {
      const invoice = entry.invoice;
      if (Number(invoice.remainingAmount || 0) <= 0) continue;
      const ratio = Number(invoice.totalAmount || 0) > 0
        ? Number(invoice.remainingAmount || 0) / Number(invoice.totalAmount)
        : 0;
      for (const item of invoice.items || []) {
        const type = item.feeType || 'other';
        duesMap.set(type, Number((Number(duesMap.get(type) || 0) + Number(item.amount || 0) * ratio).toFixed(2)));
      }
    }
    summary.duesByType = Array.from(duesMap.entries())
      .map(([feeType, amount]) => ({ feeType, amount }))
      .sort((a, b) => b.amount - a.amount);
    children.push({ student: link.studentId, summary, upcomingFees, invoices: invoiceData });
  }
  res.json({ success: true, data: children });
});

const getAdminFamilyFeeStatus = asyncHandler(async (req, res) => {
  const schoolId = req.user.schoolId;
  const student = await Student.findOne({
    _id: req.params.studentId,
    schoolId,
    deletedAt: null,
  }).select('fullName admissionNumber');
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const selectedLink = await ParentStudent.findOne({
    schoolId,
    studentId: student._id,
    isActive: true,
    canPayFees: true,
  }).populate('parentId', 'name email phone');

  let students = [student];
  let parent = null;
  if (selectedLink?.parentId) {
    parent = selectedLink.parentId;
    const familyLinks = await ParentStudent.find({
      schoolId,
      parentId: selectedLink.parentId._id,
      isActive: true,
      canPayFees: true,
    }).populate('studentId', 'fullName admissionNumber');
    students = familyLinks.filter((link) => link.studentId).map((link) => link.studentId);
  }

  const children = [];
  for (const child of students) {
    const invoices = await FeeInvoice.find({
      schoolId,
      studentId: child._id,
      status: { $ne: 'cancelled' },
    }).sort({ issueDate: -1, createdAt: -1 });
    const summary = invoices.reduce((total, invoice) => {
      total.totalAmount += Number(invoice.totalAmount || 0);
      total.paidAmount += Number(invoice.paidAmount || 0);
      total.remainingAmount += Number(invoice.remainingAmount || 0);
      return total;
    }, { totalAmount: 0, paidAmount: 0, remainingAmount: 0 });
    children.push({ student: child, summary });
  }

  const summary = children.reduce((total, child) => {
    total.totalAmount += child.summary.totalAmount;
    total.paidAmount += child.summary.paidAmount;
    total.remainingAmount += child.summary.remainingAmount;
    return total;
  }, { totalAmount: 0, paidAmount: 0, remainingAmount: 0 });

  res.json({
    success: true,
    data: {
      isFamily: children.length > 1,
      parent,
      children,
      summary,
    },
  });
});

module.exports = {
  createStructure,
  listStructures,
  createInvoice,
  createBulkInvoices,
  listInvoices,
  updateInvoice,
  recordPayment,
  updatePayment,
  deletePayment,
  listPayments,
  getParentFeeStatus,
  getAdminFamilyFeeStatus,
  createUpcomingFee,
  listUpcomingFees,
};

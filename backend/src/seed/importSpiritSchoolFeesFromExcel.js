const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');
const Student = require('../models/student.model');
const StudentEnrollment = require('../models/studentEnrollment.model');
const AcademicSession = require('../models/academicSession.model');
const SchoolClass = require('../models/class.model');
const Section = require('../models/section.model');
const FeeInvoice = require('../models/feeInvoice.model');
const FeePayment = require('../models/feePayment.model');

const SCHOOL_CODE = 'spirit_school_qaidabad';
const DATABASE_NAME =
  process.env.SPIRIT_SCHOOL_QAIDABAD_DB || 'spirit_school_qaidabad';

const CLASS_ALIASES = {
  'p.g': 'Play Group', pg: 'Play Group', 'play group': 'Play Group',
  nurs: 'Nursery', nursery: 'Nursery',
  'k.g': 'KG', kg: 'KG', one: '1', two: '2', three: '3',
  four: '4', five: '5', six: '6', '7th': '7', '8th': '8',
  '9th': '9', '10th': '10', '10th pro': '10th Pro',
};

const CLASS_ORDER = [
  'Play Group', 'Nursery', 'KG', '1', '2', '3', '4', '5', '6',
  '7', '8', '9', '10', '10th Pro',
];

const MONTHS = {
  JAN: 1, FEB: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

function clean(v) {
  return v === undefined || v === null
    ? ''
    : String(v).trim().replace(/\s+/g, ' ');
}

function amount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeClass(v) {
  const raw = clean(v).toLowerCase();
  return CLASS_ALIASES[raw] || clean(v);
}

function asDate(v, fallbackMonth) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d;
  return fallbackMonth
    ? new Date(2026, fallbackMonth - 1, 28)
    : new Date('2026-12-31');
}

function parseExcel(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const students = new Map();
  const payments = new Map();

  const studentSheet = wb.Sheets['Students'];
  if (!studentSheet) throw new Error('Students sheet not found in Excel file');

  const studentRows = XLSX.utils.sheet_to_json(studentSheet, {
    defval: '', raw: true,
  });

  for (const row of studentRows) {
    const admissionNumber = clean(row['Admission No']);
    const fullName = clean(row['Student Name']);
    if (!admissionNumber || !fullName) continue;

    students.set(admissionNumber, {
      admissionNumber,
      fullName,
      fatherName: clean(row['Father Name']) || 'Unknown',
      phone: clean(row['Phone']),
      monthlyFee: amount(row['Monthly Fee']),
      previousDues: amount(row['Previous Dues']),
      className: normalizeClass(row['Class']),
      rollNumber: clean(row['Roll No']),
    });
  }

  const paymentSheet = wb.Sheets['Fee Payments'];
  if (!paymentSheet) throw new Error('Fee Payments sheet not found in Excel file');

  const paymentRows = XLSX.utils.sheet_to_json(paymentSheet, {
    defval: '', raw: true,
  });

  for (const row of paymentRows) {
    const admissionNumber = clean(row['Admission No']);
    const feeType = clean(row['Fee Type']).toLowerCase() || 'monthly';
    const month = clean(row['Month']).toUpperCase();
    const paidAmount = amount(row['Amount']);

    if (!admissionNumber || !paidAmount) continue;

    const key = `${admissionNumber}:${feeType}:${month}`;
    const old = payments.get(key);

    payments.set(key, {
      admissionNumber,
      feeType,
      month: month || 'OTHER',
      amount: (old?.amount || 0) + paidAmount,
      paidAt: old?.paidAt || (
        row['Payment Date']
          ? asDate(row['Payment Date'])
          : new Date('2026-01-01')
      ),
    });
  }

  for (const student of students.values()) {
    if (student.previousDues > 0) {
      const key = `${student.admissionNumber}:previousDues:PREVIOUS`;
      payments.set(key, {
        admissionNumber: student.admissionNumber,
        feeType: 'previousDues',
        month: 'PREVIOUS',
        amount: student.previousDues,
        paidAt: null,
      });
    }
  }

  console.log('');
  console.log('Excel parsing result:');
  console.log(`Students found: ${students.size}`);
  console.log(`Fee records found: ${payments.size}`);
  console.log('');

  return {
    students: [...students.values()],
    payments: [...payments.values()],
  };
}

async function setup(school, admin) {
  let session = await AcademicSession.findOne({
    schoolId: school._id,
    isCurrent: true,
  });

  if (!session) {
    session = await AcademicSession.findOne({
      schoolId: school._id,
      name: '2026',
    });
  }

  if (!session) {
    session = await AcademicSession.create({
      schoolId: school._id,
      name: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isCurrent: true,
      status: 'active',
      createdBy: admin._id,
    });
  }

  const classMap = new Map();

  for (let i = 0; i < CLASS_ORDER.length; i++) {
    const name = CLASS_ORDER[i];

    let schoolClass = await SchoolClass.findOne({
      schoolId: school._id,
      academicSessionId: session._id,
      name,
    });

    if (!schoolClass) {
      schoolClass = await SchoolClass.create({
        schoolId: school._id,
        academicSessionId: session._id,
        name,
        displayOrder: i + 1,
        isActive: true,
        createdBy: admin._id,
      });
    }

    classMap.set(name, schoolClass);
  }

  return { session, classMap };
}

async function upsertStudent(item, school, session, classMap, admin) {
  const schoolClass = classMap.get(item.className);

  if (!schoolClass) {
    throw new Error(`Class not found: ${item.className}`);
  }

  let section = await Section.findOne({
    schoolId: school._id,
    academicSessionId: session._id,
    classId: schoolClass._id,
    isActive: true,
  }).sort({ name: 1 });

  if (!section) {
    section = await Section.create({
      schoolId: school._id,
      academicSessionId: session._id,
      classId: schoolClass._id,
      name: 'A',
      isActive: true,
      createdBy: admin._id,
    });
  }

  let student = await Student.findOne({
    schoolId: school._id,
    admissionNumber: item.admissionNumber,
  });

  if (!student) {
    student = await Student.create({
      schoolId: school._id,
      admissionNumber: item.admissionNumber,
      fullName: item.fullName,
      fatherName: item.fatherName,
      phone: item.phone,
      admissionDate: new Date('2026-01-01'),
      status: 'active',
      createdBy: admin._id,
    });
  } else {
    student.fullName = item.fullName;
    student.fatherName = item.fatherName;
    student.phone = item.phone;
    student.status = 'active';
    student.updatedBy = admin._id;
    await student.save();
  }

  let enrollment = await StudentEnrollment.findOne({
    schoolId: school._id,
    studentId: student._id,
    isCurrent: true,
  });

  if (!enrollment) {
    enrollment = await StudentEnrollment.create({
      schoolId: school._id,
      studentId: student._id,
      academicSessionId: session._id,
      classId: schoolClass._id,
      sectionId: section._id,
      rollNumber: clean(item.rollNumber) || String(item.admissionNumber).replace(/\D/g, '') || '1',
      enrollmentDate: new Date('2026-01-01'),
      isCurrent: true,
      status: 'active',
      createdBy: admin._id,
    });
  } else {
    enrollment.academicSessionId = session._id;
    enrollment.classId = schoolClass._id;
    enrollment.sectionId = section._id;
    enrollment.rollNumber = clean(item.rollNumber) || enrollment.rollNumber || String(item.admissionNumber).replace(/\D/g, '') || '1';
    enrollment.status = 'active';
    await enrollment.save();
  }

  student.currentEnrollmentId = enrollment._id;
  await student.save();

  return student;
}

async function importFee({ school, session, student, payment, admin }) {
  const billingKey = `excel-2026:${payment.feeType}:${payment.month}`;

  let invoice = await FeeInvoice.findOne({
    schoolId: school._id,
    academicSessionId: session._id,
    studentId: student._id,
    billingKey,
  });

  if (!invoice) {
    const total = payment.amount;

    invoice = await FeeInvoice.create({
      schoolId: school._id,
      academicSessionId: session._id,
      studentId: student._id,
      invoiceNumber: `EXCEL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      billingMonth: payment.month === 'PREVIOUS'
        ? ''
        : `2026-${String(MONTHS[payment.month] || 1).padStart(2, '0')}`,
      billingKey,
      items: [{
        title: payment.feeType === 'admission'
          ? 'Admission Fee'
          : payment.feeType === 'previousDues'
            ? 'Previous Dues'
            : 'Monthly Fee',
        feeType: payment.feeType,
        amount: total,
      }],
      subtotal: total,
      discount: 0,
      fine: 0,
      totalAmount: total,
      paidAmount: payment.feeType === 'previousDues' ? 0 : total,
      remainingAmount: payment.feeType === 'previousDues' ? total : 0,
      issueDate: payment.paidAt || new Date('2026-01-01'),
      dueDate: payment.paidAt || new Date('2026-12-31'),
      status: payment.feeType === 'previousDues' ? 'unpaid' : 'paid',
      createdBy: admin._id,
    });
  }

  if (payment.feeType !== 'previousDues') {
    const receiptNumber =
      `EXCEL-${student.admissionNumber}-${payment.feeType}-${payment.month}`;

    const exists = await FeePayment.findOne({
      schoolId: school._id,
      receiptNumber,
    });

    if (!exists) {
      await FeePayment.create({
        schoolId: school._id,
        invoiceId: invoice._id,
        studentId: student._id,
        receiptNumber,
        amount: payment.amount,
        method: 'cash',
        reference: 'Imported from FEES RECORD 2026.xlsx',
        paidAt: payment.paidAt || new Date('2026-01-01'),
        recordedBy: admin._id,
      });
    }
  }
}

async function run() {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error(
      'Excel path required. Example: node src/seed/importSpiritSchoolFeesFromExcel.js "C:\\Users\\UET\\Desktop\\FEES_RECORD_2026_CLEANED.xlsx"'
    );
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from backend/.env');
  }

  const parsed = parseExcel(filePath);

  await mongoose.connect(process.env.MONGO_URI);

  const connection = mongoose.connection.useDb(DATABASE_NAME, {
    useCache: true,
  });

  registerAllModels(connection);

  await runWithTenant(
    {
      schoolCode: SCHOOL_CODE,
      databaseName: DATABASE_NAME,
      connection,
    },
    async () => {
      const school =
        await School.findOne({ schoolCode: SCHOOL_CODE }) ||
        await School.findOne({ name: /Spirit School.*Qaidabad/i });

      if (!school) throw new Error('Spirit School Qaidabad record not found');

      const admin = await User.findOne({
        schoolId: school._id,
        role: { $in: ['Admin', 'admin'] },
        isActive: true,
      }).sort({ createdAt: 1 });

      if (!admin) throw new Error('Active Spirit School admin not found');

      const { session, classMap } = await setup(school, admin);
      const studentMap = new Map();

      let createdStudents = 0;
      let updatedStudents = 0;

      for (const item of parsed.students) {
        const existed = await Student.findOne({
          schoolId: school._id,
          admissionNumber: item.admissionNumber,
        });

        const student = await upsertStudent(
          item, school, session, classMap, admin
        );

        studentMap.set(item.admissionNumber, student);

        if (existed) updatedStudents++;
        else createdStudents++;
      }

      let invoicesCreated = 0;
      let paymentsPresent = 0;

      for (const payment of parsed.payments) {
        const student = studentMap.get(payment.admissionNumber);
        if (!student) continue;

        const billingKey =
          `excel-2026:${payment.feeType}:${payment.month}`;

        const before = await FeeInvoice.findOne({
          schoolId: school._id,
          academicSessionId: session._id,
          studentId: student._id,
          billingKey,
        });

        await importFee({ school, session, student, payment, admin });

        if (!before) invoicesCreated++;

        if (payment.feeType !== 'previousDues') {
          const receiptNumber =
            `EXCEL-${student.admissionNumber}-${payment.feeType}-${payment.month}`;

          const receipt = await FeePayment.findOne({
            schoolId: school._id,
            receiptNumber,
          });

          if (receipt) paymentsPresent++;
        }
      }

      console.log('========================================');
      console.log('Spirit School Qaidabad Excel import complete');
      console.log(`Students read: ${parsed.students.length}`);
      console.log(`Students created: ${createdStudents}`);
      console.log(`Students updated: ${updatedStudents}`);
      console.log(`Fee invoices created: ${invoicesCreated}`);
      console.log(`Fee payments present: ${paymentsPresent}`);
      console.log(`Academic session: ${session.name}`);
      console.log('========================================');
    }
  );

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(`Import failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

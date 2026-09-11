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

const SCHOOL_CODE = 'city_school';
const DATABASE_NAME = process.env.CITY_SCHOOL_DB || 'city_school';

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

function classKey(value) {
  const raw = clean(value)
    .toLowerCase()
    .replace(/class/g, '')
    .replace(/grade/g, '')
    .replace(/[.\-_\s]/g, '');

  const aliases = {
    pg: 'pg',
    playgroup: 'pg',
    play: 'pg',
    nursery: 'nursery',
    nur: 'nursery',
    prep: 'prep',
    one: '1',
    '1': '1',
    '1st': '1',
    two: '2',
    '2': '2',
    '2nd': '2',
    three: '3',
    '3': '3',
    '3rd': '3',
    four: '4',
    '4': '4',
    '4th': '4',
    five: '5',
    '5': '5',
    '5th': '5',
    six: '6',
    '6': '6',
    '6th': '6',
    seven: '7',
    '7': '7',
    '7th': '7',
    eight: '8',
    '8': '8',
    '8th': '8',
  };

  return aliases[raw] || raw;
}

function readStudents(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) throw new Error('Excel sheet is empty');

  const headers = rows[0].map((v) => clean(v).toLowerCase());
  const findCol = (...names) => headers.findIndex((h) => names.includes(h));

  const rollCol = findCol('roll no.', 'roll no', 'roll number', 'roll');
  const classCol = findCol('class', 'grade');
  const nameCol = findCol('student name', 'name', 'student');
  const fatherCol = findCol('father name', 'father');
  const phoneCol = findCol('father contact', 'contact', 'phone', 'father phone');

  if ([rollCol, classCol, nameCol, fatherCol].some((i) => i < 0)) {
    throw new Error('Excel headers not recognized. Required: Roll no., Class, Student Name, Father name');
  }

  return rows.slice(1)
    .map((row) => ({
      admissionNumber: clean(row[rollCol]),
      rollNumber: clean(row[rollCol]),
      className: clean(row[classCol]),
      fullName: clean(row[nameCol]),
      fatherName: clean(row[fatherCol]),
      phone: phoneCol >= 0 ? clean(row[phoneCol]) : '',
    }))
    .filter((s) => s.admissionNumber && s.fullName);
}

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('Excel path missing. Example: node src/seed/importCitySchoolStudentsFromExcel.js "C:\\Users\\UET\\Desktop\\ID Card Data input.xlsx"');
  }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');

  const students = readStudents(filePath);
  await mongoose.connect(process.env.MONGO_URI);
  const connection = mongoose.connection.useDb(DATABASE_NAME, { useCache: true });
  registerAllModels(connection);

  await runWithTenant(
    { schoolCode: SCHOOL_CODE, databaseName: DATABASE_NAME, connection },
    async () => {
      const school =
        (await School.findOne({ email: 'info@cityschool.com' })) ||
        (await School.findOne({ name: /city school/i }));
      if (!school) throw new Error('City School record not found');

      const admin = await User.findOne({ schoolId: school._id, role: 'admin', isActive: true }).sort({ createdAt: 1 });
      if (!admin) throw new Error('Active City School admin not found');

      const currentSession = await AcademicSession.findOne({ schoolId: school._id, isCurrent: true });
      const classes = currentSession
        ? await SchoolClass.find({ schoolId: school._id, academicSessionId: currentSession._id, isActive: true })
        : [];
      const classMap = new Map(classes.map((c) => [classKey(c.name), c]));

      let created = 0;
      let updated = 0;
      let enrolled = 0;
      let skipped = 0;
      const missing = new Set();

      for (const item of students) {
        let student = await Student.findOne({ schoolId: school._id, admissionNumber: item.admissionNumber });
        const existed = !!student;
        if (!student) {
          student = new Student({
            schoolId: school._id,
            admissionNumber: item.admissionNumber,
            fullName: item.fullName,
            fatherName: item.fatherName,
            phone: item.phone,
            status: 'active',
            createdBy: admin._id,
          });
        } else {
          student.fullName = item.fullName;
          student.fatherName = item.fatherName;
          student.phone = item.phone;
          student.status = 'active';
          student.updatedBy = admin._id;
        }
        await student.save();
        existed ? updated++ : created++;

        if (!currentSession) {
          skipped++;
          missing.add('Current Academic Session missing');
          continue;
        }

        const schoolClass = classMap.get(classKey(item.className));
        if (!schoolClass) {
          skipped++;
          missing.add(`Class missing: ${item.className}`);
          continue;
        }

        const section = await Section.findOne({
          schoolId: school._id,
          academicSessionId: currentSession._id,
          classId: schoolClass._id,
          isActive: true,
        }).sort({ name: 1 });

        if (!section) {
          skipped++;
          missing.add(`Section missing for: ${schoolClass.name}`);
          continue;
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
            academicSessionId: currentSession._id,
            classId: schoolClass._id,
            sectionId: section._id,
            rollNumber: item.rollNumber,
            createdBy: admin._id,
          });
        } else {
          enrollment.academicSessionId = currentSession._id;
          enrollment.classId = schoolClass._id;
          enrollment.sectionId = section._id;
          enrollment.rollNumber = item.rollNumber;
          enrollment.isCurrent = true;
          enrollment.status = 'active';
          await enrollment.save();
        }

        student.currentEnrollmentId = enrollment._id;
        await student.save();
        enrolled++;
      }

      console.log(`✅ Excel students read: ${students.length}`);
      console.log(`✅ New students: ${created}`);
      console.log(`✅ Existing students updated: ${updated}`);
      console.log(`✅ Enrollments linked: ${enrolled}`);
      console.log(`⚠️ Enrollment skipped: ${skipped}`);
      if (missing.size) {
        console.log('\nAcademic Setup needed:');
        for (const item of missing) console.log(`- ${item}`);
      }
    }
  );

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(`❌ Import failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');
const Student = require('../models/student.model');
const ParentStudent = require('../models/parentStudent.model');

const SCHOOL_CODE = process.argv[3] || process.env.SCHOOL_CODE || 'spirit_school_qaidabad';
const DATABASE_NAME =
  process.argv[4] ||
  process.env.SPIRIT_SCHOOL_DB ||
  process.env.SCHOOL_DB ||
  'Spirt_School_Qaidabad';

const DEFAULT_PASSWORD = '123456';
const EMAIL_DOMAIN = process.env.PARENT_EMAIL_DOMAIN || 'parent.local';

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[.\-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phoneDigits(value) {
  return clean(value).replace(/\D/g, '');
}

function emailForPhone(phone) {
  const digits = phoneDigits(phone);
  return digits ? digits + '@' + EMAIL_DOMAIN : '';
}

function readFamilies(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rows.length) throw new Error('Excel sheet is empty');

  const headers = rows[0].map((v) => normalize(v));
  const findCol = (...names) => {
    const wanted = names.map(normalize);
    return headers.findIndex((h) => wanted.includes(h));
  };

  const fatherCol = findCol('father name', 'father');
  const studentCol = findCol('student name', 'student', 'name');
  const classCol = findCol('class', 'grade');
  const phoneCol = findCol('phone number', 'phone', 'father phone', 'father contact', 'contact');

  if (fatherCol < 0 || studentCol < 0 || classCol < 0 || phoneCol < 0) {
    throw new Error('Excel headers not recognized. Required: Father Name, Student Name, Class, Phone Number');
  }

  const families = [];
  let current = null;

  for (const row of rows.slice(1)) {
    const fatherRaw = clean(row[fatherCol]);
    const phoneRaw = clean(row[phoneCol]);
    const studentName = clean(row[studentCol]);
    const className = clean(row[classCol]);

    if (!studentName) continue;

    if (fatherRaw || phoneRaw || !current) {
      if (current) families.push(current);
      current = { fatherName: fatherRaw, phone: phoneRaw, students: [] };
    }

    current.students.push({ fullName: studentName, className });
  }

  if (current) families.push(current);
  return families;
}

function makeStudentMap(students) {
  const map = new Map();

  for (const student of students) {
    const key = normalize(student.fullName);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(student);
  }

  return map;
}

function matchStudent(studentMap, studentName, fatherName) {
  const candidates = studentMap.get(normalize(studentName)) || [];

  if (!candidates.length) {
    return { student: null, reason: 'Student not found: ' + studentName };
  }

  const fatherKey = normalize(fatherName);
  const byFather = candidates.filter(
    (student) => normalize(student.fatherName) === fatherKey
  );

  if (byFather.length === 1) return { student: byFather[0] };
  if (candidates.length === 1) return { student: candidates[0] };

  return {
    student: null,
    reason: 'Ambiguous student "' + studentName + '". Found ' + candidates.length + ' records with the same name.',
  };
}

async function run() {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error(
      'Excel path missing. Example: node src/seed/importParentsFromFamilyExcel.js "C:\\Users\\UET\\Desktop\\FAMILY_COMPLETE_CLEANED.xlsx"'
    );
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from backend/.env');
  }

  const families = readFamilies(filePath);

  await mongoose.connect(process.env.MONGO_URI);

  const connection = mongoose.connection.useDb(DATABASE_NAME, { useCache: true });
  registerAllModels(connection);

  await runWithTenant(
    { schoolCode: SCHOOL_CODE, databaseName: DATABASE_NAME, connection },
    async () => {
      const school =
        (await School.findOne({ code: SCHOOL_CODE })) ||
        (await School.findOne({ schoolCode: SCHOOL_CODE })) ||
        (await School.findOne({ name: new RegExp(SCHOOL_CODE.replace(/[_-]/g, '.*'), 'i') }));

      if (!school) {
        throw new Error(
          'School record not found for SCHOOL_CODE="' + SCHOOL_CODE +
          '". Pass the correct school code as the 3rd argument.'
        );
      }

      const admin = await User.findOne({
        schoolId: school._id,
        role: 'admin',
        isActive: true,
      }).sort({ createdAt: 1 });

      if (!admin) throw new Error('Active admin not found for this school');

      const students = await Student.find({
        schoolId: school._id,
        deletedAt: null,
      }).select('_id fullName fatherName admissionNumber');

      const studentMap = makeStudentMap(students);

      let parentsCreated = 0;
      let parentsUpdated = 0;
      let linksCreated = 0;
      let linksUpdated = 0;
      let familiesSkipped = 0;
      let studentsLinked = 0;

      const errors = [];
      const usedPhones = new Map();

      for (let familyIndex = 0; familyIndex < families.length; familyIndex++) {
        const family = families[familyIndex];
        const familyNo = familyIndex + 1;
        const fatherName = clean(family.fatherName);
        const phone = clean(family.phone);
        const digits = phoneDigits(phone);

        if (!phone || !digits) {
          familiesSkipped++;
          errors.push('Family #' + familyNo + ' (' + (fatherName || 'Unknown father') + '): phone number missing');
          continue;
        }

        const previousFamily = usedPhones.get(digits);

        if (previousFamily && normalize(previousFamily.fatherName) !== normalize(fatherName)) {
          familiesSkipped++;
          errors.push(
            'Family #' + familyNo + ' (' + fatherName + ') skipped: phone ' + phone +
            ' is already used by family #' + previousFamily.familyNo +
            ' (' + previousFamily.fatherName + ').'
          );
          continue;
        }

        usedPhones.set(digits, { familyNo, fatherName });

        const matchedStudents = [];

        for (const item of family.students) {
          const match = matchStudent(studentMap, item.fullName, fatherName);

          if (!match.student) {
            errors.push('Family #' + familyNo + ': ' + match.reason);
            continue;
          }

          matchedStudents.push({ ...item, student: match.student });
        }

        if (!matchedStudents.length) {
          familiesSkipped++;
          continue;
        }

        const email = emailForPhone(phone);

        let parent = await User.findOne({
          schoolId: school._id,
          role: 'parent',
          phone,
        });

        if (!parent) {
          const emailUser = await User.findOne({ email: email.toLowerCase() });

          if (emailUser) {
            if (
              String(emailUser.schoolId) !== String(school._id) ||
              emailUser.role !== 'parent' ||
              emailUser.phone !== phone
            ) {
              familiesSkipped++;
              errors.push(
                'Family #' + familyNo + ' (' + fatherName + ') skipped: generated email ' +
                email + ' already belongs to another user.'
              );
              continue;
            }

            parent = emailUser;
          }
        }

        if (!parent) {
          parent = await User.create({
            name: phone,
            email: email.toLowerCase(),
            phone,
            password: DEFAULT_PASSWORD,
            role: 'parent',
            schoolId: school._id,
            createdBy: admin._id,
            isActive: true,
          });

          parentsCreated++;
        } else {
          parent.name = phone;
          parent.phone = phone;
          parent.email = email.toLowerCase();
          parent.role = 'parent';
          parent.schoolId = school._id;
          parent.isActive = true;
          parent.updatedBy = admin._id;
          await parent.save();

          parentsUpdated++;
        }

        for (let index = 0; index < matchedStudents.length; index++) {
          const item = matchedStudents[index];

          const existingLink = await ParentStudent.findOne({
            schoolId: school._id,
            parentId: parent._id,
            studentId: item.student._id,
          });

          if (existingLink) {
            existingLink.relationship = 'father';
            existingLink.isPrimaryGuardian = index === 0;
            existingLink.canViewAcademicData = true;
            existingLink.canPayFees = true;
            existingLink.isActive = true;
            existingLink.updatedBy = admin._id;
            await existingLink.save();
            linksUpdated++;
          } else {
            await ParentStudent.create({
              schoolId: school._id,
              parentId: parent._id,
              studentId: item.student._id,
              relationship: 'father',
              isPrimaryGuardian: index === 0,
              canViewAcademicData: true,
              canPayFees: true,
              isActive: true,
              createdBy: admin._id,
            });
            linksCreated++;
          }

          studentsLinked++;
        }
      }

      console.log('\n==========================================');
      console.log('      PARENT EXCEL IMPORT COMPLETED');
      console.log('==========================================');
      console.log('Excel families read: ' + families.length);
      console.log('Parents created: ' + parentsCreated);
      console.log('Parents updated: ' + parentsUpdated);
      console.log('Parent links created: ' + linksCreated);
      console.log('Parent links updated: ' + linksUpdated);
      console.log('Students linked: ' + studentsLinked);
      console.log('Families skipped: ' + familiesSkipped);

      if (errors.length) {
        console.log('\n⚠️ REVIEW THESE ITEMS:');
        for (const error of errors) console.log('- ' + error);
      }

      console.log('\nLogin setup:');
      console.log('- Username/Name: Phone Number');
      console.log('- Phone: Phone Number');
      console.log('- Password for NEW parents: 123456');
      console.log('- Generated email: <phone-digits>@' + EMAIL_DOMAIN);
      console.log('- Existing parent passwords are NOT reset.');
    }
  );

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('❌ Parent import failed: ' + error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');
const TeacherProfile = require('../models/teacherProfile.model');

const SCHOOL_CODE = 'al_zohran_school_musa_wali';
const DATABASE_NAME = process.env.AL_ZOHRAN_SCHOOL_DB || SCHOOL_CODE;
const TEACHER_PASSWORD = process.env.AL_ZOHRAN_TEACHER_PASSWORD;
const dataFile = process.argv[2];

const loginEmail = (teacher) => {
  if (teacher.email) return teacher.email.toLowerCase().trim();
  const slug = teacher.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${slug}@alzohran.com`;
};

async function importTeachers() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');
  if (!TEACHER_PASSWORD || TEACHER_PASSWORD.length < 6) {
    throw new Error('AL_ZOHRAN_TEACHER_PASSWORD (minimum 6 characters) is missing from backend/.env');
  }
  if (!dataFile) {
    throw new Error('Provide the private teacher JSON file path as the first argument');
  }

  const teachers = JSON.parse(fs.readFileSync(path.resolve(dataFile), 'utf8'));
  if (!Array.isArray(teachers) || teachers.length === 0) {
    throw new Error('Teacher JSON must contain a non-empty array');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const connection = mongoose.connection.useDb(DATABASE_NAME, { useCache: true });
  registerAllModels(connection);

  await runWithTenant(
    { schoolCode: SCHOOL_CODE, databaseName: DATABASE_NAME, connection },
    async () => {
      const school = await School.findOne({ email: 'info@alzohranschool.com' });
      if (!school) throw new Error('Al Zohran school record was not found; run seed:al-zohran first');

      const admin = await User.findOne({ schoolId: school._id, role: 'admin' });
      if (!admin) throw new Error('Al Zohran admin account was not found; run seed:al-zohran first');

      for (const teacher of teachers) {
        const email = loginEmail(teacher);
        let user = await User.findOne({ $or: [{ email }, { phone: teacher.phone }] });

        if (!user) {
          user = await User.create({
            name: teacher.name,
            email,
            phone: teacher.phone,
            password: TEACHER_PASSWORD,
            role: 'teacher',
            schoolId: school._id,
            isActive: true,
            createdBy: admin._id,
          });
        } else {
          user.name = teacher.name;
          user.email = email;
          user.phone = teacher.phone;
          user.role = 'teacher';
          user.schoolId = school._id;
          user.isActive = true;
          user.createdBy = user.createdBy || admin._id;
          await user.save();
        }

        await TeacherProfile.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              schoolId: school._id,
              employeeId: teacher.employeeId,
              gender: teacher.gender || 'female',
              cnic: teacher.cnic || '',
              qualification: teacher.qualification || '',
              specialization: teacher.specialization || '',
              employmentType: teacher.employmentType || 'permanent',
              updatedBy: admin._id,
            },
            $setOnInsert: { createdBy: admin._id },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );

        console.log(`✅ ${teacher.name} | ${email}`);
      }
    }
  );

  await mongoose.disconnect();
  console.log(`✅ ${teachers.length} teacher accounts and profiles imported into ${DATABASE_NAME}`);
}

importTeachers().catch(async (error) => {
  console.error(`❌ Teacher import failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

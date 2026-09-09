const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');
const Notice = require('../models/notice.model');
const AcademicSession = require('../models/academicSession.model');
const SchoolClass = require('../models/class.model');
const Section = require('../models/section.model');

const SCHOOL_CODE = 'al_zohran_school_musa_wali';
const DATABASE_NAME = process.env.AL_ZOHRAN_SCHOOL_DB || 'al_zohran_school_musa_wali';
const ADMIN_PASSWORD = process.env.AL_ZOHRAN_ADMIN_PASSWORD;

async function ensureUser({ name, email, phone, role, schoolId }) {
  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    user = await User.create({
      name,
      email,
      phone,
      password: ADMIN_PASSWORD,
      role,
      schoolId,
      isActive: true,
    });
  } else {
    user.name = name;
    user.phone = phone;
    user.role = role;
    user.schoolId = schoolId;
    user.isActive = true;
    user.password = ADMIN_PASSWORD;
    await user.save();
  }
  return user;
}

async function seed() {
  if (!ADMIN_PASSWORD) {
    throw new Error('AL_ZOHRAN_ADMIN_PASSWORD is missing from backend/.env');
  }
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const connection = mongoose.connection.useDb(DATABASE_NAME, { useCache: true });
  registerAllModels(connection);

  await runWithTenant(
    { schoolCode: SCHOOL_CODE, databaseName: DATABASE_NAME, connection },
    async () => {
      const school = await School.findOneAndUpdate(
        { email: 'info@alzohranschool.com' },
        {
          $set: {
            name: 'Al Zohran School Musa Wali',
            address: 'Musa Wali, Mianwali',
            phone: '0300-0000000',
            status: 'active',
          },
          $setOnInsert: { email: 'info@alzohranschool.com' },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const admin = await ensureUser({
        name: 'Al Zohran Admin',
        email: 'admin@alzohran.com',
        phone: '03000000001',
        role: 'admin',
        schoolId: school._id,
      });

      await ensureUser({
        name: 'Al Zohran Teacher',
        email: 'teacher@alzohran.com',
        phone: '03000000002',
        role: 'teacher',
        schoolId: school._id,
      });

      await ensureUser({
        name: 'Al Zohran Student',
        email: 'student@alzohran.com',
        phone: '03000000003',
        role: 'student',
        schoolId: school._id,
      });

      await Notice.findOneAndUpdate(
        { schoolId: school._id, title: 'Welcome to Al Zohran School Musa Wali' },
        {
          $set: {
            message: 'Al Zohran School application is connected successfully.',
            audience: 'all',
            priority: 'normal',
            status: 'published',
            publishedAt: new Date(),
            createdBy: admin._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(`✅ Database: ${DATABASE_NAME}`);
      console.log('✅ Admin: admin@alzohran.com');
      console.log('✅ Teacher: teacher@alzohran.com');
      console.log('✅ Student: student@alzohran.com');
      console.log('✅ 13 classes and 26 sections are ready');
    }
  );

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(`❌ Simple sample seed failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

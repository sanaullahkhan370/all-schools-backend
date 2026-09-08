const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');
const Notice = require('../models/notice.model');

const SCHOOL_CODE = 'school_simple_sample';
const DATABASE_NAME = process.env.SCHOOL_SIMPLE_SAMPLE_DB || 'school_simple_sample';
const DEMO_PASSWORD = process.env.SIMPLE_SAMPLE_PASSWORD || 'password123';

async function ensureUser({ name, email, phone, role, schoolId }) {
  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    user = await User.create({
      name,
      email,
      phone,
      password: DEMO_PASSWORD,
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
    user.password = DEMO_PASSWORD;
    await user.save();
  }
  return user;
}

async function seed() {
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
        { email: 'info@simplesampleschool.com' },
        {
          $set: {
            name: 'Simple Sample School',
            address: 'Piplan, Mianwali',
            phone: '0300-0000000',
            status: 'active',
          },
          $setOnInsert: { email: 'info@simplesampleschool.com' },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const admin = await ensureUser({
        name: 'Sample Admin',
        email: 'admin@sample.com',
        phone: '03000000001',
        role: 'admin',
        schoolId: school._id,
      });

      await ensureUser({
        name: 'Sample Teacher',
        email: 'teacher@sample.com',
        phone: '03000000002',
        role: 'teacher',
        schoolId: school._id,
      });

      await ensureUser({
        name: 'Sample Student',
        email: 'student@sample.com',
        phone: '03000000003',
        role: 'student',
        schoolId: school._id,
      });

      await Notice.findOneAndUpdate(
        { schoolId: school._id, title: 'Welcome to Simple Sample School' },
        {
          $set: {
            message: 'Your simple school application is connected successfully.',
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
      console.log('✅ Admin: admin@sample.com');
      console.log('✅ Teacher: teacher@sample.com');
      console.log('✅ Student: student@sample.com');
      console.log(`🔐 Demo password: ${DEMO_PASSWORD}`);
    }
  );

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(`❌ Simple sample seed failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

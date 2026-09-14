const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');
const TeacherProfile = require('../models/teacherProfile.model');

const SCHOOL_CODE = 'city_school';
const DATABASE_NAME = process.env.CITY_SCHOOL_DB || 'city_school';

const ADMIN_PASSWORD =
  process.env.CITY_SCHOOL_ADMIN_PASSWORD || 'CityAdmin@2026';

const TEACHER_PASSWORD =
  process.env.CITY_SCHOOL_TEACHER_PASSWORD || 'CityTeacher@2026';

const teachers = [
  {
    name: 'Dua Nadeem',
    email: 'dua.nadeem@cityschool.com',
    phone: '03468777658',
    employeeId: 'TCH-001',
    cnic: '38303-0134673-0',
    qualification: 'BS Chemistry',
    specialization: 'Chemistry',
  },
  {
    name: 'Rabbia Zafar',
    email: 'rabbia.zafar@cityschool.com',
    phone: '03012606007',
    employeeId: 'TCH-002',
    cnic: '38303-1257691-6',
    qualification: 'MSc Chemistry, B.Ed',
    specialization: 'Mathematics, English, History',
  },
  {
    name: 'Saman Siraj',
    email: 'saman.siraj@cityschool.com',
    phone: '03114533931',
    employeeId: 'TCH-003',
    cnic: '38303-4890243-6',
    qualification: 'BS English Language and Literature (Continuing)',
    specialization: 'English, Islamic Studies, Urdu',
  },
  {
    name: 'Munazza Kalsoom',
    email: 'munazza.kalsoom@cityschool.com',
    phone: '03159495956',
    employeeId: 'TCH-004',
    cnic: '42401-8626420-0',
    qualification: 'MPhil Chemistry',
    specialization: 'Science, History, SST, Islamic Studies',
  },
  {
    name: 'Rimsha',
    email: 'rimsha@cityschool.com',
    phone: '03034575288',
    employeeId: 'TCH-005',
    cnic: '38303-4170079-4',
    qualification: 'BSc',
    specialization: 'Computer, Economics',
  },
  {
    name: 'Ishmal',
    email: 'ishmal@cityschool.com',
    phone: '03299612603',
    employeeId: 'TCH-006',
    cnic: '38303-0782941-2',
    qualification: 'FSc Pre-Medical',
    specialization: '',
  },
  {
    name: 'Ghazala Ishaq',
    email: 'ghazala.ishaq@cityschool.com',
    phone: '03331661773',
    employeeId: 'TCH-007',
    cnic: '38303-8648598-6',
    qualification: 'BS English',
    specialization: 'English',
  },
  {
    name: 'Amna Siraj',
    email: 'amna.siraj@cityschool.com',
    phone: '03121484505',
    employeeId: 'TCH-008',
    cnic: '38303-9700456-2',
    qualification: 'FA',
    specialization: '',
  },
  {
    name: 'Alisbha',
    email: 'alisbha@cityschool.com',
    phone: '03221439565',
    employeeId: 'TCH-009',
    cnic: '38303-5472366-4',
    qualification: 'FA',
    specialization: '',
  },
];

async function ensureAdmin(schoolId) {
  let admin = await User.findOne({ email: 'admin@cityschool.com' });

  if (!admin) {
    admin = await User.create({
      name: 'City School Admin',
      email: 'admin@cityschool.com',
      phone: '03000000001',
      password: ADMIN_PASSWORD,
      role: 'admin',
      schoolId,
      isActive: true,
    });
  }

  return admin;
}

async function ensureTeacher(teacher, schoolId, adminId) {
  let user = await User.findOne({
    $or: [{ email: teacher.email }, { phone: teacher.phone }],
  });

  if (!user) {
    user = await User.create({
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      password: TEACHER_PASSWORD,
      role: 'teacher',
      schoolId,
      isActive: true,
      createdBy: adminId,
    });
  } else {
    user.name = teacher.name;
    user.email = teacher.email;
    user.phone = teacher.phone;
    user.role = 'teacher';
    user.schoolId = schoolId;
    user.isActive = true;
    user.createdBy = user.createdBy || adminId;
    await user.save();
  }

  await TeacherProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        schoolId,
        employeeId: teacher.employeeId,
        gender: 'female',
        cnic: teacher.cnic,
        qualification: teacher.qualification,
        specialization: teacher.specialization,
        employmentType: 'permanent',
        updatedBy: adminId,
      },
      $setOnInsert: { createdBy: adminId },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );

  console.log(`✅ ${teacher.name} | ${teacher.email}`);
}

async function seed() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from backend/.env');
  }

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
      const school = await School.findOneAndUpdate(
        { email: 'info@cityschool.com' },
        {
          $set: {
            name: 'City School Piplan',
            address: 'Piplan, Mianwali',
            phone: '03000000000',
            status: 'active',
          },
          $setOnInsert: {
            email: 'info@cityschool.com',
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      const admin = await ensureAdmin(school._id);

      for (const teacher of teachers) {
        await ensureTeacher(teacher, school._id, admin._id);
      }

      console.log(`✅ Database: ${DATABASE_NAME}`);
      console.log(`✅ ${teachers.length} City School teachers imported`);
      console.log('✅ Admin login: admin@cityschool.com');
      console.log(`🔐 Admin password: ${ADMIN_PASSWORD}`);
      console.log(`🔐 Teacher password: ${TEACHER_PASSWORD}`);
    }
  );

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(`❌ City School teacher seed failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
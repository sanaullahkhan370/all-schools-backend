const TeacherProfile = require('../models/teacherProfile.model');
const { User, School, runSeed, temporaryPassword } = require('./seedUtils');

const teachers = [
  ['Arsalan Ahmed', 'teacher@school.com', '03010000001', 'TCH-001', 'Mathematics'],
  ['Sadia Noor', 'teacher2@school.com', '03010000002', 'TCH-002', 'English'],
  ['Bilal Hassan', 'teacher3@school.com', '03010000003', 'TCH-003', 'Science'],
  ['Ayesha Raza', 'teacher4@school.com', '03010000004', 'TCH-004', 'Urdu'],
  ['Usman Ali', 'teacher5@school.com', '03010000005', 'TCH-005', 'Computer'],
];

const parents = [
  ['Malik Parent', 'parent@school.com', '03210000001'],
  ['Hassan Parent', 'parent2@school.com', '03210000002'],
  ['Aslam Parent', 'parent3@school.com', '03210000003'],
  ['Raza Parent', 'parent4@school.com', '03210000004'],
  ['Khan Parent', 'parent5@school.com', '03210000005'],
];

async function ensureUser({ name, email, phone, role, schoolId }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      phone,
      password: temporaryPassword(),
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
    await user.save();
  }
  return user;
}

runSeed('Accounts seed (passwords remain separate)', async () => {
  let school = await School.findOne({ email: 'demo@school.com' });
  if (!school) {
    school = await School.create({
      name: process.env.SEED_SCHOOL_NAME || 'City Model School Piplan',
      address: process.env.SEED_SCHOOL_ADDRESS || 'Main Bazaar, Piplan, Mianwali',
      phone: '0459-123456',
      email: 'demo@school.com',
      status: 'active',
    });
  }

  await ensureUser({
    name: 'Super Admin', email: 'superadmin@school.com', phone: '03000000000',
    role: 'superAdmin', schoolId: undefined,
  });
  const admin = await ensureUser({
    name: 'School Admin', email: 'admin@school.com', phone: '03007654321',
    role: 'admin', schoolId: school._id,
  });

  for (const [name, email, phone, employeeId, specialization] of teachers) {
    const teacher = await ensureUser({ name, email, phone, role: 'teacher', schoolId: school._id });
    await TeacherProfile.updateOne(
      { schoolId: school._id, userId: teacher._id },
      {
        $set: { employeeId, qualification: 'M.A / B.Ed', specialization, employmentType: 'permanent' },
        $setOnInsert: { joiningDate: new Date('2026-04-01'), createdBy: admin._id },
      },
      { upsert: true }
    );
  }

  for (const [name, email, phone] of parents) {
    await ensureUser({ name, email, phone, role: 'parent', schoolId: school._id });
  }
  console.log('ℹ️ Run npm run seed:passwords at the end to enable demo logins');
});

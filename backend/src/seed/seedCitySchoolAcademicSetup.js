const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');
const AcademicSession = require('../models/academicSession.model');
const SchoolClass = require('../models/class.model');
const Section = require('../models/section.model');

const SCHOOL_CODE = 'city_school';
const DATABASE_NAME = process.env.CITY_SCHOOL_DB || 'city_school';
const SESSION_NAME = '2026-2027';

const CLASS_NAMES = [
  'P.G',
  'Nursery',
  'Prep',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
];

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from backend/.env');
  }

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

      const admin = await User.findOne({
        schoolId: school._id,
        role: 'admin',
        isActive: true,
      }).sort({ createdAt: 1 });

      if (!admin) throw new Error('Active City School admin not found');

      let session = await AcademicSession.findOne({
        schoolId: school._id,
        isCurrent: true,
      });

      if (!session) {
        session = await AcademicSession.findOne({
          schoolId: school._id,
          name: SESSION_NAME,
        });

        await AcademicSession.updateMany(
          { schoolId: school._id, isCurrent: true },
          { $set: { isCurrent: false, updatedBy: admin._id } }
        );

        if (session) {
          session.isCurrent = true;
          session.status = 'active';
          session.updatedBy = admin._id;
          await session.save();
          console.log(`✅ Existing session set as current: ${session.name}`);
        } else {
          session = await AcademicSession.create({
            schoolId: school._id,
            name: SESSION_NAME,
            startDate: new Date('2026-04-01T00:00:00.000Z'),
            endDate: new Date('2027-03-31T23:59:59.999Z'),
            isCurrent: true,
            status: 'active',
            createdBy: admin._id,
            updatedBy: admin._id,
          });
          console.log(`✅ Current session created: ${session.name}`);
        }
      } else {
        if (session.status !== 'active') {
          session.status = 'active';
          session.updatedBy = admin._id;
          await session.save();
        }
        console.log(`✅ Current session already exists: ${session.name}`);
      }

      let classesCreated = 0;
      let classesExisting = 0;
      let sectionsCreated = 0;
      let sectionsExisting = 0;

      for (let i = 0; i < CLASS_NAMES.length; i += 1) {
        const className = CLASS_NAMES[i];

        let schoolClass = await SchoolClass.findOne({
          schoolId: school._id,
          academicSessionId: session._id,
          name: className,
        });

        if (!schoolClass) {
          schoolClass = await SchoolClass.create({
            schoolId: school._id,
            academicSessionId: session._id,
            name: className,
            displayOrder: i + 1,
            isActive: true,
            createdBy: admin._id,
            updatedBy: admin._id,
          });
          classesCreated += 1;
          console.log(`✅ Class created: ${className}`);
        } else {
          classesExisting += 1;
          if (!schoolClass.isActive) {
            schoolClass.isActive = true;
            schoolClass.updatedBy = admin._id;
            await schoolClass.save();
          }
          console.log(`↪️ Class already exists: ${className}`);
        }

        let section = await Section.findOne({
          schoolId: school._id,
          academicSessionId: session._id,
          classId: schoolClass._id,
          name: 'A',
        });

        if (!section) {
          section = await Section.create({
            schoolId: school._id,
            academicSessionId: session._id,
            classId: schoolClass._id,
            name: 'A',
            isActive: true,
            createdBy: admin._id,
            updatedBy: admin._id,
          });
          sectionsCreated += 1;
          console.log(`   ✅ Section A created for ${className}`);
        } else {
          sectionsExisting += 1;
          if (!section.isActive) {
            section.isActive = true;
            section.updatedBy = admin._id;
            await section.save();
          }
          console.log(`   ↪️ Section A already exists for ${className}`);
        }
      }

      console.log('\nAcademic Setup complete');
      console.log(`Session: ${session.name} (current)`);
      console.log(`Classes created: ${classesCreated}`);
      console.log(`Classes already existing: ${classesExisting}`);
      console.log(`Sections created: ${sectionsCreated}`);
      console.log(`Sections already existing: ${sectionsExisting}`);
    }
  );
}

run()
  .catch((error) => {
    console.error(`❌ Academic setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');

const SCHOOL_CODE = 'spirit_school_qaidabad';
const DATABASE_NAME =
  process.env.SPIRIT_SCHOOL_QAIDABAD_DB || 'spirit_school_qaidabad';

const ADMIN_EMAIL =
  process.env.SPIRIT_SCHOOL_ADMIN_EMAIL || 'admin@spiritschool.com';

const ADMIN_PASSWORD =
  process.env.SPIRIT_SCHOOL_ADMIN_PASSWORD || 'SpiritAdmin@2026';

const ADMIN_PHONE =
  process.env.SPIRIT_SCHOOL_ADMIN_PHONE || '03000000001';

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
        { email: 'info@spiritschool.com' },
        {
          $set: {
            name: 'The Spirit School Qaidabad',
            address: 'Qaidabad, Pakistan',
            phone: '03000000000',
            status: 'active',
          },
          $setOnInsert: {
            email: 'info@spiritschool.com',
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      let admin = await User.findOne({ email: ADMIN_EMAIL });

      if (!admin) {
        admin = await User.create({
          name: 'Spirit School Admin',
          email: ADMIN_EMAIL,
          phone: ADMIN_PHONE,
          password: ADMIN_PASSWORD,
          role: 'admin',
          schoolId: school._id,
          isActive: true,
        });
      } else {
        admin.name = 'Spirit School Admin';
        admin.phone = ADMIN_PHONE;
        admin.role = 'admin';
        admin.schoolId = school._id;
        admin.isActive = true;
        admin.password = ADMIN_PASSWORD;
        await admin.save();
      }

      console.log('✅ Spirit School Qaidabad admin seeded');
      console.log(`📧 Email: ${ADMIN_EMAIL}`);
      console.log(`🔐 Password: ${ADMIN_PASSWORD}`);
      console.log(`🏫 School code: ${SCHOOL_CODE}`);
      console.log(`🗄️ Database: ${DATABASE_NAME}`);
    }
  );

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(`❌ Spirit School admin seed failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

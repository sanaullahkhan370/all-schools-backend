const mongoose = require('mongoose');
const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const databaseNameFromUri = () => {
  try {
    const pathname = new URL(process.env.MONGO_URI).pathname.replace(/^\//, '');
    return pathname || 'schools';
  } catch (_error) { return 'schools'; }
};
const schoolDatabases = () => ({
  city_school: process.env.CITY_SCHOOL_DB || databaseNameFromUri(),
  smart_school_china_scheme:
    process.env.SMART_SCHOOL_CHINA_SCHEME_DB || 'smart_school_china_scheme',
  jinnah_school_harnoli: process.env.JINNAH_SCHOOL_DB || 'jinnah_school_harnoli',
  shining_star_school_piplan:
    process.env.SHINING_STAR_SCHOOL_DB || 'shining_star_school_piplan',
  school_simple_sample:
    process.env.SCHOOL_SIMPLE_SAMPLE_DB || 'school_simple_sample',
});
const selectSchoolDatabase = (req, res, next) => {
  const schoolCode = String(req.get('X-School-Code') || 'city_school').trim().toLowerCase();
  const databaseName = schoolDatabases()[schoolCode];
  if (!databaseName) return res.status(400).json({ success: false, message: 'Invalid or unsupported school code' });
  const connection = mongoose.connection.useDb(databaseName, { useCache: true });
  registerAllModels(connection);
  req.schoolCode = schoolCode;
  req.schoolDatabase = databaseName;
  return runWithTenant({ schoolCode, databaseName, connection }, () => next());
};
module.exports = { selectSchoolDatabase, schoolDatabases };

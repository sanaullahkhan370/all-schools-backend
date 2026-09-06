const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const { selectSchoolDatabase } = require('./middleware/schoolDatabase.middleware');

// Routes import karna
const authRoutes = require('./routes/auth.routes');
const superAdminRoutes = require('./routes/superAdmin.routes');
const adminRoutes = require('./routes/admin.routes');
const teacherRoutes = require('./routes/teacher.routes');
const parentRoutes = require('./routes/parent.routes');
const academicRoutes = require('./routes/academic.routes');
const studentRoutes = require('./routes/student.routes');
const teacherManagementRoutes = require('./routes/teacherManagement.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const feeRoutes = require('./routes/fee.routes');
const examRoutes = require('./routes/exam.routes');
const homeworkRoutes = require('./routes/homework.routes');
const noticeRoutes = require('./routes/notice.routes');
const starRoutes = require('./routes/star.routes');

const app = express();

// Security Middlewares
app.use(helmet()); // HTTP headers security ke liye
app.use(cors()); // Cross-Origin Resource Sharing allow karne ke liye
app.use(express.json()); // JSON body parse karne ke liye
app.use(selectSchoolDatabase); // Har request ko us school ke database se route kare

// Rate Limiting: Aik IP se 15 minutes mein sirf 100 requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
app.use('/api/', limiter);

// API Routes Mount karna
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin/teachers', teacherManagementRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/parent/fees', feeRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/admin/academic', academicRoutes);
app.use('/api/admin/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin/fees', feeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/stars', starRoutes);

// Base Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'School Management System API is running...',
    schoolCode: req.schoolCode
  });
});

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

module.exports = app;

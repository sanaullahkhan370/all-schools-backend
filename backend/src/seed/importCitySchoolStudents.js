const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { registerAllModels, runWithTenant } = require('../config/tenantModels');
const School = require('../models/school.model');
const User = require('../models/user.model');
const Student = require('../models/student.model');
const StudentEnrollment = require('../models/studentEnrollment.model');
const AcademicSession = require('../models/academicSession.model');
const SchoolClass = require('../models/class.model');
const Section = require('../models/section.model');

const SCHOOL_CODE = 'city_school';
const DATABASE_NAME = process.env.CITY_SCHOOL_DB || 'city_school';

const students = [
  {"admissionNumber":"80126","rollNumber":"80126","className":"8th","fullName":"Adan Fatima","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"80226","rollNumber":"80226","className":"8th","fullName":"Noor ul Ain","fatherName":"Saeed Shaheen","phone":"0334-7657221"},
  {"admissionNumber":"80326","rollNumber":"80326","className":"8th","fullName":"M.Haseeb","fatherName":"Aqeel Ahmad","phone":"0300-3430559"},
  {"admissionNumber":"80426","rollNumber":"80426","className":"8th","fullName":"Faiq","fatherName":"M. Zulfiqar","phone":"0300-7901265"},
  {"admissionNumber":"80526","rollNumber":"80526","className":"8th","fullName":"Sarmad Saeed","fatherName":"Saeed Shaheen","phone":"0334-7657221"},
  {"admissionNumber":"80626","rollNumber":"80626","className":"8th","fullName":"Hammad","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"80726","rollNumber":"80726","className":"8th","fullName":"Abdul Raffay","fatherName":"Rana M.Ayoub","phone":"0309-5531399"},
  {"admissionNumber":"70126","rollNumber":"70126","className":"7th","fullName":"Ahtisham","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"70226","rollNumber":"70226","className":"7th","fullName":"M.Sarmad","fatherName":"Saeed Ahmad","phone":"0306-6783684"},
  {"admissionNumber":"70326","rollNumber":"70326","className":"7th","fullName":"M.Sufyan","fatherName":"Riaz Hussain","phone":"0344-3239199"},
  {"admissionNumber":"70426","rollNumber":"70426","className":"7th","fullName":"Haris Khan Niazi","fatherName":"Allah Nawaz Khan Niazi","phone":"0300-5400413"},
  {"admissionNumber":"70526","rollNumber":"70526","className":"7th","fullName":"Toheed Abbas","fatherName":"Toqeer Abbas","phone":"0309-0784767"},
  {"admissionNumber":"60126","rollNumber":"60126","className":"6th","fullName":"Minal Fatima","fatherName":"M.Nisar","phone":"0301-7801119"},
  {"admissionNumber":"60226","rollNumber":"60226","className":"6th","fullName":"Kinza Fatima","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"60326","rollNumber":"60326","className":"6th","fullName":"Saqib Hameed","fatherName":"Hameedullah","phone":"0302-7982218"},
  {"admissionNumber":"60426","rollNumber":"60426","className":"6th","fullName":"Rehman Gul","fatherName":"Rehmatullah Khan","phone":"0347-1877800"},
  {"admissionNumber":"60526","rollNumber":"60526","className":"6th","fullName":"Saim Abdullah","fatherName":"M.Saeed","phone":"0301-7802475"},
  {"admissionNumber":"60626","rollNumber":"60626","className":"6th","fullName":"M.Umar","fatherName":"M.Khurram","phone":"0301-7330102"},
  {"admissionNumber":"60726","rollNumber":"60726","className":"6th","fullName":"M.Arslan","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"60826","rollNumber":"60826","className":"6th","fullName":"Maheer Ahmad","fatherName":"M.Zulfiqar","phone":"0300-7901265"},
  {"admissionNumber":"60926","rollNumber":"60926","className":"6th","fullName":"Abu Bakar","fatherName":"Ghulam Shabir","phone":"0301-6763547"},
  {"admissionNumber":"61026","rollNumber":"61026","className":"6th","fullName":"Kareemullah","fatherName":"Abdullah Khan","phone":"0300-2088648"},
  {"admissionNumber":"50126","rollNumber":"50126","className":"5th","fullName":"Sadqan Fatima","fatherName":"M.Zulfiqar","phone":"0300-7901265"},
  {"admissionNumber":"50226","rollNumber":"50226","className":"5th","fullName":"Dua Eman","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"50326","rollNumber":"50326","className":"5th","fullName":"Hadia Fatima","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"50426","rollNumber":"50426","className":"5th","fullName":"Mahnoor","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"40126","rollNumber":"40126","className":"4th","fullName":"M.Ali","fatherName":"M.Ashraf","phone":"0300-8241162"},
  {"admissionNumber":"40226","rollNumber":"40226","className":"4th","fullName":"Hassan","fatherName":"M.Nawaz","phone":"0300-6717260"},
  {"admissionNumber":"40326","rollNumber":"40326","className":"4th","fullName":"Anaya Fatima","fatherName":"M.Ateeq","phone":"0300-7103054"},
  {"admissionNumber":"40426","rollNumber":"40426","className":"4th","fullName":"M.Hamza","fatherName":"M.Naseer","phone":"0300-6217041"},
  {"admissionNumber":"40526","rollNumber":"40526","className":"4th","fullName":"Eshal Fatima","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"40626","rollNumber":"40626","className":"4th","fullName":"M.Ahsan","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"40726","rollNumber":"40726","className":"4th","fullName":"M.Ayan","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"40826","rollNumber":"40826","className":"4th","fullName":"M.Arham","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"40926","rollNumber":"40926","className":"4th","fullName":"M.Zayan","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"41026","rollNumber":"41026","className":"4th","fullName":"M.Saad","fatherName":"M.Ramzan","phone":"0300-6221111"},
  {"admissionNumber":"41126","rollNumber":"41126","className":"4th","fullName":"Hafsa","fatherName":"M.Saeed","phone":"0301-7802475"},
  {"admissionNumber":"41226","rollNumber":"41226","className":"4th","fullName":"M.Ibrahim","fatherName":"M.Azhar","phone":"0300-1234567"},
  {"admissionNumber":"30126","rollNumber":"30126","className":"3rd","fullName":"M.Ali Raza","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"30226","rollNumber":"30226","className":"3rd","fullName":"Ayesha","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"30326","rollNumber":"30326","className":"3rd","fullName":"M.Huzaifa","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"30426","rollNumber":"30426","className":"3rd","fullName":"Fatima","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"30526","rollNumber":"30526","className":"3rd","fullName":"M.Hasan","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"30626","rollNumber":"30626","className":"3rd","fullName":"Eman","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"30726","rollNumber":"30726","className":"3rd","fullName":"M.Zain","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"30826","rollNumber":"30826","className":"3rd","fullName":"M.Abdullah","fatherName":"M.Nawaz","phone":"0300-6717260"},
  {"admissionNumber":"30926","rollNumber":"30926","className":"3rd","fullName":"Hania","fatherName":"M.Ashraf","phone":"0300-8241162"},
  {"admissionNumber":"31026","rollNumber":"31026","className":"3rd","fullName":"M.Musa","fatherName":"M.Saeed","phone":"0301-7802475"},
  {"admissionNumber":"31126","rollNumber":"31126","className":"3rd","fullName":"Laiba","fatherName":"M.Ramzan","phone":"0300-6221111"},
  {"admissionNumber":"31226","rollNumber":"31226","className":"3rd","fullName":"M.Awais","fatherName":"M.Ateeq","phone":"0300-7103054"},
  {"admissionNumber":"20126","rollNumber":"20126","className":"2nd","fullName":"M.Abdullah","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"20226","rollNumber":"20226","className":"2nd","fullName":"Maryam","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"20326","rollNumber":"20326","className":"2nd","fullName":"M.Ali","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"20426","rollNumber":"20426","className":"2nd","fullName":"Anaya","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"20526","rollNumber":"20526","className":"2nd","fullName":"M.Hassan","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"20626","rollNumber":"20626","className":"2nd","fullName":"Eshal","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"20726","rollNumber":"20726","className":"2nd","fullName":"M.Zain","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"20826","rollNumber":"20826","className":"2nd","fullName":"Fatima","fatherName":"M.Nawaz","phone":"0300-6717260"},
  {"admissionNumber":"20926","rollNumber":"20926","className":"2nd","fullName":"M.Hamza","fatherName":"M.Ashraf","phone":"0300-8241162"},
  {"admissionNumber":"21026","rollNumber":"21026","className":"2nd","fullName":"Hania","fatherName":"M.Saeed","phone":"0301-7802475"},
  {"admissionNumber":"21126","rollNumber":"21126","className":"2nd","fullName":"M.Ahmed","fatherName":"M.Ramzan","phone":"0300-6221111"},
  {"admissionNumber":"21226","rollNumber":"21226","className":"2nd","fullName":"Laiba","fatherName":"M.Ateeq","phone":"0300-7103054"},
  {"admissionNumber":"21326","rollNumber":"21326","className":"2nd","fullName":"M.Awais","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"21426","rollNumber":"21426","className":"2nd","fullName":"Ayesha","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"21526","rollNumber":"21526","className":"2nd","fullName":"M.Zayan","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"21626","rollNumber":"21626","className":"2nd","fullName":"Eman","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"21726","rollNumber":"21726","className":"2nd","fullName":"M.Musa","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"21826","rollNumber":"21826","className":"2nd","fullName":"Maryam","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"21926","rollNumber":"21926","className":"2nd","fullName":"M.Huzaifa","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"22026","rollNumber":"22026","className":"2nd","fullName":"Hafsa","fatherName":"M.Nawaz","phone":"0300-6717260"},
  {"admissionNumber":"10126","rollNumber":"10126","className":"1st","fullName":"Hareem Fatima","fatherName":"M.Ramzan Anjum","phone":"0306-4991177"},
  {"admissionNumber":"10226","rollNumber":"10226","className":"1st","fullName":"M.Zoyan","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"10326","rollNumber":"10326","className":"1st","fullName":"M.Rohan","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"10426","rollNumber":"10426","className":"1st","fullName":"Areesha Shabir","fatherName":"Ghulam Shabir","phone":"0307-5830515"},
  {"admissionNumber":"10526","rollNumber":"10526","className":"1st","fullName":"M.Awais","fatherName":"Parvaiz Khan","phone":"0323-5553949"},
  {"admissionNumber":"10626","rollNumber":"10626","className":"1st","fullName":"Eshal","fatherName":"M.Ateeq Ahmed","phone":"0300-7103054"},
  {"admissionNumber":"10726","rollNumber":"10726","className":"1st","fullName":"M.Hamza","fatherName":"Khaleeq Ahmad","phone":"0300-7103054"},
  {"admissionNumber":"10826","rollNumber":"10826","className":"1st","fullName":"Fatima Ahmed","fatherName":"Ahmed Ali","phone":"0301-3955445"},
  {"admissionNumber":"10926","rollNumber":"10926","className":"1st","fullName":"M.Meesam Raza","fatherName":"Zaheer Abbas","phone":"0302-0676152"},
  {"admissionNumber":"11026","rollNumber":"11026","className":"1st","fullName":"Farisha Anam","fatherName":"Ghulam Shabir","phone":"0305-2402109"},
  {"admissionNumber":"11126","rollNumber":"11126","className":"1st","fullName":"M.Ali","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"11226","rollNumber":"11226","className":"1st","fullName":"Ayesha","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"11326","rollNumber":"11326","className":"1st","fullName":"M.Hassan","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"11426","rollNumber":"11426","className":"1st","fullName":"Eman","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"11526","rollNumber":"11526","className":"1st","fullName":"M.Zain","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"11626","rollNumber":"11626","className":"1st","fullName":"Maryam","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"11726","rollNumber":"11726","className":"1st","fullName":"M.Huzaifa","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"11826","rollNumber":"11826","className":"1st","fullName":"Hania","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"11926","rollNumber":"11926","className":"1st","fullName":"M.Ahmed","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"12026","rollNumber":"12026","className":"1st","fullName":"Laiba","fatherName":"M.Nawaz","phone":"0300-6717260"},
  {"admissionNumber":"12126","rollNumber":"12126","className":"1st","fullName":"M.Musa","fatherName":"M.Ashraf","phone":"0300-8241162"},
  {"admissionNumber":"12226","rollNumber":"12226","className":"1st","fullName":"Hafsa","fatherName":"M.Saeed","phone":"0301-7802475"},
  {"admissionNumber":"12326","rollNumber":"12326","className":"1st","fullName":"M.Ibrahim","fatherName":"M.Ramzan","phone":"0300-6221111"},
  {"admissionNumber":"PREP0126","rollNumber":"PREP0126","className":"Prep","fullName":"Eshal","fatherName":"M.Ateeq Ahmed","phone":"0300-7103054"},
  {"admissionNumber":"PREP0226","rollNumber":"PREP0226","className":"Prep","fullName":"M.Hanza Ahmed","fatherName":"Khaleeq Ahmad","phone":"0300-7103054"},
  {"admissionNumber":"PREP0326","rollNumber":"PREP0326","className":"Prep","fullName":"Fatima Ahmed","fatherName":"Ahmed Ali","phone":"0301-3955445"},
  {"admissionNumber":"PREP0426","rollNumber":"PREP0426","className":"Prep","fullName":"M.Meesam Raza","fatherName":"Zaheer Abbas","phone":"0302-0676152"},
  {"admissionNumber":"PREP0526","rollNumber":"PREP0526","className":"Prep","fullName":"Farisha Anam","fatherName":"Ghulam Shabir","phone":"0305-2402109"},
  {"admissionNumber":"PREP0626","rollNumber":"PREP0626","className":"Prep","fullName":"M.Ali","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"PREP0726","rollNumber":"PREP0726","className":"Prep","fullName":"Ayesha","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"PREP0826","rollNumber":"PREP0826","className":"Prep","fullName":"M.Hassan","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"PREP0926","rollNumber":"PREP0926","className":"Prep","fullName":"Eman","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"PREP1026","rollNumber":"PREP1026","className":"Prep","fullName":"M.Zain","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"PREP1126","rollNumber":"PREP1126","className":"Prep","fullName":"Maryam","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"PREP1226","rollNumber":"PREP1226","className":"Prep","fullName":"M.Huzaifa","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"PREP1326","rollNumber":"PREP1326","className":"Prep","fullName":"Hania","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"PREP1426","rollNumber":"PREP1426","className":"Prep","fullName":"M.Ahmed","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"PREP1526","rollNumber":"PREP1526","className":"Prep","fullName":"Laiba","fatherName":"M.Nawaz","phone":"0300-6717260"},
  {"admissionNumber":"PREP1626","rollNumber":"PREP1626","className":"Prep","fullName":"M.Musa","fatherName":"M.Ashraf","phone":"0300-8241162"},
  {"admissionNumber":"PREP1726","rollNumber":"PREP1726","className":"Prep","fullName":"Hafsa","fatherName":"M.Saeed","phone":"0301-7802475"},
  {"admissionNumber":"PREP1826","rollNumber":"PREP1826","className":"Prep","fullName":"M.Ibrahim","fatherName":"M.Ramzan","phone":"0300-6221111"},
  {"admissionNumber":"PREP1926","rollNumber":"PREP1926","className":"Prep","fullName":"Areesha","fatherName":"Ghulam Shabir","phone":"0307-5830515"},
  {"admissionNumber":"PREP2026","rollNumber":"PREP2026","className":"Prep","fullName":"M.Awais","fatherName":"Parvaiz Khan","phone":"0323-5553949"},
  {"admissionNumber":"PREP2126","rollNumber":"PREP2126","className":"Prep","fullName":"Eshal Fatima","fatherName":"M.Ateeq Ahmed","phone":"0300-7103054"},
  {"admissionNumber":"PREP2226","rollNumber":"PREP2226","className":"Prep","fullName":"M.Hamza","fatherName":"Khaleeq Ahmad","phone":"0300-7103054"},
  {"admissionNumber":"PREP2326","rollNumber":"PREP2326","className":"Prep","fullName":"Fatima","fatherName":"Ahmed Ali","phone":"0301-3955445"},
  {"admissionNumber":"PG0126","rollNumber":"PG0126","className":"P.G","fullName":"Eshal","fatherName":"M.Ateeq Ahmed","phone":"0300-7103054"},
  {"admissionNumber":"PG0226","rollNumber":"PG0226","className":"P.G","fullName":"M.Hanza Ahmed","fatherName":"Khaleeq Ahmad","phone":"0300-7103054"},
  {"admissionNumber":"PG0326","rollNumber":"PG0326","className":"P.G","fullName":"Fatima Ahmed","fatherName":"Ahmed Ali","phone":"0301-3955445"},
  {"admissionNumber":"PG0426","rollNumber":"PG0426","className":"P.G","fullName":"M.Meesam Raza","fatherName":"Zaheer Abbas","phone":"0302-0676152"},
  {"admissionNumber":"PG0526","rollNumber":"PG0526","className":"P.G","fullName":"Farisha Anam","fatherName":"Ghulam Shabir","phone":"0305-2402109"},
  {"admissionNumber":"PG0626","rollNumber":"PG0626","className":"P.G","fullName":"M.Ali","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"PG0726","rollNumber":"PG0726","className":"P.G","fullName":"Ayesha","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"PG0826","rollNumber":"PG0826","className":"P.G","fullName":"M.Hassan","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"PG0926","rollNumber":"PG0926","className":"P.G","fullName":"Eman","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"PG1026","rollNumber":"PG1026","className":"P.G","fullName":"M.Zain","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"PG1126","rollNumber":"PG1126","className":"P.G","fullName":"Maryam","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"PG1226","rollNumber":"PG1226","className":"P.G","fullName":"M.Huzaifa","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"PG1326","rollNumber":"PG1326","className":"P.G","fullName":"Hania","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"PG1426","rollNumber":"PG1426","className":"P.G","fullName":"M.Ahmed","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"PG1526","rollNumber":"PG1526","className":"P.G","fullName":"Laiba","fatherName":"M.Nawaz","phone":"0300-6717260"},
  {"admissionNumber":"PG1626","rollNumber":"PG1626","className":"P.G","fullName":"M.Musa","fatherName":"M.Ashraf","phone":"0300-8241162"},
  {"admissionNumber":"PG1726","rollNumber":"PG1726","className":"P.G","fullName":"Hafsa","fatherName":"M.Saeed","phone":"0301-7802475"},
  {"admissionNumber":"N0126","rollNumber":"N0126","className":"Nursery","fullName":"Eshal","fatherName":"M.Ateeq Ahmed","phone":"0300-7103054"},
  {"admissionNumber":"N0226","rollNumber":"N0226","className":"Nursery","fullName":"M.Hanza Ahmed","fatherName":"Khaleeq Ahmad","phone":"0300-7103054"},
  {"admissionNumber":"N0326","rollNumber":"N0326","className":"Nursery","fullName":"Fatima Ahmed","fatherName":"Ahmed Ali","phone":"0301-3955445"},
  {"admissionNumber":"N0426","rollNumber":"N0426","className":"Nursery","fullName":"M.Meesam Raza","fatherName":"Zaheer Abbas","phone":"0302-0676152"},
  {"admissionNumber":"N0526","rollNumber":"N0526","className":"Nursery","fullName":"Farisha Anam","fatherName":"Ghulam Shabir","phone":"0305-2402109"},
  {"admissionNumber":"N0626","rollNumber":"N0626","className":"Nursery","fullName":"M.Ali","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"N0726","rollNumber":"N0726","className":"Nursery","fullName":"Ayesha","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"N0826","rollNumber":"N0826","className":"Nursery","fullName":"M.Hassan","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"N0926","rollNumber":"N0926","className":"Nursery","fullName":"Eman","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"N1026","rollNumber":"N1026","className":"Nursery","fullName":"M.Zain","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"N1126","rollNumber":"N1126","className":"Nursery","fullName":"Maryam","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"N1226","rollNumber":"N1226","className":"Nursery","fullName":"M.Huzaifa","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"N1326","rollNumber":"N1326","className":"Nursery","fullName":"Hania","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"N1426","rollNumber":"N1426","className":"Nursery","fullName":"M.Ahmed","fatherName":"M.Shafique","phone":"0307-8454873"},
  {"admissionNumber":"N1526","rollNumber":"N1526","className":"Nursery","fullName":"Laiba","fatherName":"M.Nawaz","phone":"0300-6717260"},
  {"admissionNumber":"N1626","rollNumber":"N1626","className":"Nursery","fullName":"M.Musa","fatherName":"M.Ashraf","phone":"0300-8241162"},
  {"admissionNumber":"N1726","rollNumber":"N1726","className":"Nursery","fullName":"Hafsa","fatherName":"M.Saeed","phone":"0301-7802475"},
  {"admissionNumber":"N1826","rollNumber":"N1826","className":"Nursery","fullName":"M.Ibrahim","fatherName":"M.Ramzan","phone":"0300-6221111"},
  {"admissionNumber":"N1926","rollNumber":"N1926","className":"Nursery","fullName":"Areesha","fatherName":"Ghulam Shabir","phone":"0307-5830515"},
  {"admissionNumber":"N2026","rollNumber":"N2026","className":"Nursery","fullName":"M.Awais","fatherName":"Parvaiz Khan","phone":"0323-5553949"},
  {"admissionNumber":"N2126","rollNumber":"N2126","className":"Nursery","fullName":"Eshal Fatima","fatherName":"M.Ateeq Ahmed","phone":"0300-7103054"},
  {"admissionNumber":"N2226","rollNumber":"N2226","className":"Nursery","fullName":"M.Hamza","fatherName":"Khaleeq Ahmad","phone":"0300-7103054"},
  {"admissionNumber":"N2326","rollNumber":"N2326","className":"Nursery","fullName":"Fatima","fatherName":"Ahmed Ali","phone":"0301-3955445"},
  {"admissionNumber":"N2426","rollNumber":"N2426","className":"Nursery","fullName":"M.Meesam","fatherName":"Zaheer Abbas","phone":"0302-0676152"},
  {"admissionNumber":"N2526","rollNumber":"N2526","className":"Nursery","fullName":"Farisha","fatherName":"Ghulam Shabir","phone":"0305-2402109"},
  {"admissionNumber":"N2626","rollNumber":"N2626","className":"Nursery","fullName":"M.Ali","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"N2726","rollNumber":"N2726","className":"Nursery","fullName":"Ayesha","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"N2826","rollNumber":"N2826","className":"Nursery","fullName":"M.Hassan","fatherName":"M.Azam","phone":"0306-3951152"},
  {"admissionNumber":"N2926","rollNumber":"N2926","className":"Nursery","fullName":"Eman","fatherName":"M.Irfan","phone":"0303-3258955"},
  {"admissionNumber":"N3026","rollNumber":"N3026","className":"Nursery","fullName":"M.Zain","fatherName":"M.Majid","phone":"0349-6060614"},
  {"admissionNumber":"N3126","rollNumber":"N3126","className":"Nursery","fullName":"Maryam","fatherName":"M.Nadeem","phone":"0300-6217041"},
  {"admissionNumber":"N3226","rollNumber":"N3226","className":"Nursery","fullName":"M.Huzaifa","fatherName":"M.Zahid","phone":"0306-4867708"},
  {"admissionNumber":"N3326","rollNumber":"N3326","className":"Nursery","fullName":"Hania","fatherName":"M.Nisar","phone":"0301-7801531"},
  {"admissionNumber":"N3426","rollNumber":"N3426","className":"Nursery","fullName":"Laiba","fatherName":"Ghulam Abbas","phone":"0309-1066562"},
  {"admissionNumber":"N3526","rollNumber":"N3526","className":"Nursery","fullName":"Ayesha Bibi","fatherName":"Ghulam Raza","phone":"0309-1066562"},
  {"admissionNumber":"N3626","rollNumber":"N3626","className":"Nursery","fullName":"Aryan","fatherName":"M.Tanveer","phone":"0309-1066562"}
];

function classKey(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/class/g, '').replace(/grade/g, '').replace(/[.\-_\s]/g, '');
  const aliases = { pg:'pg', playgroup:'pg', play:'pg', nur:'nursery', nursery:'nursery', prep:'prep', one:'1', '1':'1', '1st':'1', two:'2', '2':'2', '2nd':'2', three:'3', '3':'3', '3rd':'3', four:'4', '4':'4', '4th':'4', five:'5', '5':'5', '5th':'5', six:'6', '6':'6', '6th':'6', seven:'7', '7':'7', '7th':'7', eight:'8', '8':'8', '8th':'8' };
  return aliases[raw] || raw;
}

async function seed() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from backend/.env');

  await mongoose.connect(process.env.MONGO_URI);
  const connection = mongoose.connection.useDb(DATABASE_NAME, { useCache: true });
  registerAllModels(connection);

  await runWithTenant({ schoolCode: SCHOOL_CODE, databaseName: DATABASE_NAME, connection }, async () => {
    const school = (await School.findOne({ email: 'info@cityschool.com' })) || (await School.findOne({ name: /city school/i }));
    if (!school) throw new Error('City School record not found. Run the City School seed first.');

    const admin = await User.findOne({ schoolId: school._id, role: 'admin', isActive: true }).sort({ createdAt: 1 });
    if (!admin) throw new Error('Active City School admin not found.');

    const currentSession = await AcademicSession.findOne({ schoolId: school._id, isCurrent: true });
    const classes = currentSession ? await SchoolClass.find({ schoolId: school._id, academicSessionId: currentSession._id, isActive: true }) : [];
    const classMap = new Map(classes.map((item) => [classKey(item.name), item]));

    let created = 0, updated = 0, enrolled = 0, enrollmentSkipped = 0;
    const missingAcademicSetup = new Set();

    for (const item of students) {
      const existing = await Student.findOne({ schoolId: school._id, admissionNumber: item.admissionNumber });
      const student = existing || new Student({ schoolId: school._id, admissionNumber: item.admissionNumber, createdBy: admin._id });

      student.fullName = item.fullName;
      student.fatherName = item.fatherName;
      student.phone = item.phone;
      student.status = 'active';
      student.updatedBy = admin._id;
      await student.save();

      if (existing) updated += 1; else created += 1;

      if (!currentSession) {
        enrollmentSkipped += 1;
        missingAcademicSetup.add('No current Academic Session');
        continue;
      }

      const schoolClass = classMap.get(classKey(item.className));
      if (!schoolClass) {
        enrollmentSkipped += 1;
        missingAcademicSetup.add(`Class missing: ${item.className}`);
        continue;
      }

      const section = await Section.findOne({ schoolId: school._id, academicSessionId: currentSession._id, classId: schoolClass._id, isActive: true }).sort({ name: 1 });
      if (!section) {
        enrollmentSkipped += 1;
        missingAcademicSetup.add(`Section missing for: ${schoolClass.name}`);
        continue;
      }

      let enrollment = await StudentEnrollment.findOne({ schoolId: school._id, studentId: student._id, isCurrent: true });
      if (!enrollment) {
        enrollment = await StudentEnrollment.findOneAndUpdate(
          { schoolId: school._id, academicSessionId: currentSession._id, classId: schoolClass._id, sectionId: section._id, rollNumber: item.rollNumber },
          { $setOnInsert: { studentId: student._id, createdBy: admin._id, isCurrent: true, status: 'active' } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        enrollment.academicSessionId = currentSession._id;
        enrollment.classId = schoolClass._id;
        enrollment.sectionId = section._id;
        enrollment.rollNumber = item.rollNumber;
        enrollment.isCurrent = true;
        enrollment.status = 'active';
        await enrollment.save();
      }

      student.currentEnrollmentId = enrollment._id;
      await student.save();
      enrolled += 1;
    }

    console.log(`✅ Database: ${DATABASE_NAME}`);
    console.log(`✅ Spreadsheet students processed: ${students.length}`);
    console.log(`✅ New students: ${created}`);
    console.log(`✅ Existing students updated: ${updated}`);
    console.log(`✅ Current enrollments linked: ${enrolled}`);
    console.log(`⚠️ Enrollment skipped: ${enrollmentSkipped}`);

    if (missingAcademicSetup.size) {
      console.log('\nAcademic Setup still needed for these items:');
      for (const message of missingAcademicSetup) console.log(`  - ${message}`);
      console.log('\nAfter creating the missing Session / Classes / Sections, run this seed again.');
    }

    console.log('\nNote: the spreadsheet does not contain gender or date of birth, so those fields remain blank and can be completed later from the Admin Student edit screen.');
  });

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(`❌ City School student import failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

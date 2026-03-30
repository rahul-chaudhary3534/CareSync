const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'caresync.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('patient','doctor')) DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patient_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    name TEXT,
    dob TEXT,
    gender TEXT,
    phone TEXT,
    address TEXT,
    blood_group TEXT,
    allergies TEXT,
    chronic_diseases TEXT,
    avatar TEXT,
    weight REAL,
    height REAL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS doctor_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    name TEXT,
    specialization TEXT,
    experience INTEGER,
    phone TEXT,
    hospital TEXT,
    bio TEXT,
    avatar TEXT,
    avg_rating REAL DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS health_metrics (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES users(id),
    date TEXT NOT NULL,
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    blood_sugar REAL,
    weight REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS medical_reports (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES users(id),
    doctor_id TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    category TEXT,
    report_date TEXT,
    description TEXT,
    file_path TEXT,
    file_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hospitals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    specialty TEXT,
    phone TEXT,
    email TEXT,
    image TEXT,
    avg_rating REAL DEFAULT 0,
    total_reviews INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS hospital_reviews (
    id TEXT PRIMARY KEY,
    hospital_id TEXT REFERENCES hospitals(id),
    user_id TEXT REFERENCES users(id),
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    review TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES users(id),
    type TEXT CHECK(type IN ('insurance','medical','vaccination')),
    title TEXT,
    issuer TEXT,
    issue_date TEXT,
    expiry_date TEXT,
    policy_number TEXT,
    file_path TEXT,
    file_name TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES users(id),
    doctor_id TEXT REFERENCES users(id),
    hospital_id TEXT REFERENCES hospitals(id),
    appointment_date TEXT,
    appointment_time TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
    doctor_rating INTEGER,
    doctor_review TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS doctor_schedules (
    id TEXT PRIMARY KEY,
    doctor_id TEXT REFERENCES users(id),
    day_of_week TEXT,
    start_time TEXT,
    end_time TEXT,
    slot_duration INTEGER DEFAULT 30,
    available INTEGER DEFAULT 1
  );
`);

// Seed hospitals if empty
const hospitalCount = db.prepare('SELECT COUNT(*) as cnt FROM hospitals').get();
if (hospitalCount.cnt === 0) {
  const { v4: uuidv4 } = require('uuid');
  const insertHospital = db.prepare(`INSERT INTO hospitals (id,name,address,city,specialty,phone,email,avg_rating,total_reviews) VALUES (?,?,?,?,?,?,?,?,?)`);
  const hospitals = [
    ['h1','Apollo Hospitals','21 Greams Lane, Thousand Lights','Chennai','Multi-Specialty','+91-44-28290200','apollo@hospital.com',4.5,120],
    ['h2','Fortis Healthcare','Sector 62, Phase VIII','Mohali','Cardiology','+91-172-5096001','fortis@hospital.com',4.3,98],
    ['h3','AIIMS Delhi','Sri Aurobindo Marg, Ansari Nagar','New Delhi','Government Multi-Specialty','+91-11-26588500','aiims@hospital.com',4.7,350],
    ['h4','Max Super Speciality','2 Press Enclave Road, Saket','New Delhi','Orthopedics','+91-11-26515050','max@hospital.com',4.2,87],
    ['h5','Manipal Hospitals','98 HAL Old Airport Road','Bengaluru','Neurology','+91-80-25024444','manipal@hospital.com',4.4,145],
    ['h6','Kokilaben Hospital','Rao Saheb Achutrao Patwardhan Marg','Mumbai','Cancer Care','+91-22-30999999','kokilaben@hospital.com',4.6,200],
  ];
  hospitals.forEach(h => insertHospital.run(...h));
}

module.exports = db;

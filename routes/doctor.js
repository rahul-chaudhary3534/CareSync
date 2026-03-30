const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'caresync_secret_2024';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// ---- PROFILE ----
router.get('/profile', auth, (req, res) => {
  const profile = db.prepare(`SELECT d.*, u.email FROM doctor_profiles d JOIN users u ON u.id=d.user_id WHERE d.user_id=?`).get(req.user.id);
  res.json(profile || {});
});

router.put('/profile', auth, upload.single('avatar'), (req, res) => {
  const { name, specialization, experience, phone, hospital, bio } = req.body;
  const avatar = req.file ? '/uploads/' + req.file.filename : req.body.avatar;
  db.prepare(`INSERT INTO doctor_profiles (user_id,name,specialization,experience,phone,hospital,bio,avatar,updated_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,specialization=excluded.specialization,
    experience=excluded.experience,phone=excluded.phone,hospital=excluded.hospital,bio=excluded.bio,
    avatar=excluded.avatar,updated_at=excluded.updated_at`)
    .run(req.user.id, name, specialization, experience, phone, hospital, bio, avatar);
  res.json({ success: true });
});

// ---- PATIENTS ----
router.get('/patients', auth, (req, res) => {
  const patients = db.prepare(`
    SELECT DISTINCT p.*, u.email,
      (SELECT COUNT(*) FROM medical_reports WHERE patient_id=p.user_id AND doctor_id=?) as report_count
    FROM patient_profiles p
    JOIN users u ON u.id=p.user_id
    JOIN appointments a ON a.patient_id=p.user_id AND a.doctor_id=?
    WHERE p.name IS NOT NULL
  `).all(req.user.id, req.user.id);
  res.json(patients);
});

router.get('/patients/:id', auth, (req, res) => {
  const profile = db.prepare('SELECT p.*,u.email FROM patient_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=?').get(req.params.id);
  const reports = db.prepare('SELECT * FROM medical_reports WHERE patient_id=? ORDER BY report_date DESC').all(req.params.id);
  const metrics = db.prepare('SELECT * FROM health_metrics WHERE patient_id=? ORDER BY date DESC').all(req.params.id);
  res.json({ profile, reports, metrics });
});

// ---- UPLOAD REPORT FOR PATIENT ----
router.post('/upload-report', auth, upload.single('file'), (req, res) => {
  const { patient_id, title, category, report_date, description } = req.body;
  const id = uuidv4();
  const file_path = req.file ? '/uploads/' + req.file.filename : null;
  const file_name = req.file ? req.file.originalname : null;
  db.prepare('INSERT INTO medical_reports (id,patient_id,doctor_id,title,category,report_date,description,file_path,file_name) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, patient_id, req.user.id, title, category, report_date, description, file_path, file_name);
  res.json({ success: true, id });
});

// ---- APPOINTMENTS / SCHEDULE ----
router.get('/appointments', auth, (req, res) => {
  const apts = db.prepare(`
    SELECT a.*, COALESCE(p.name,'Unknown') as patient_name, p.phone as patient_phone,
      COALESCE(h.name,'Unknown') as hospital_name
    FROM appointments a
    LEFT JOIN patient_profiles p ON p.user_id=a.patient_id
    LEFT JOIN hospitals h ON h.id=a.hospital_id
    WHERE a.doctor_id=? ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all(req.user.id);
  res.json(apts);
});

router.put('/appointments/:id/status', auth, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE appointments SET status=? WHERE id=? AND doctor_id=?').run(status, req.params.id, req.user.id);
  res.json({ success: true });
});

// ---- SCHEDULE ----
router.get('/schedule', auth, (req, res) => {
  const schedule = db.prepare('SELECT * FROM doctor_schedules WHERE doctor_id=? ORDER BY id').all(req.user.id);
  res.json(schedule);
});

router.post('/schedule', auth, (req, res) => {
  const { day_of_week, start_time, end_time, slot_duration } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO doctor_schedules (id,doctor_id,day_of_week,start_time,end_time,slot_duration) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, day_of_week, start_time, end_time, slot_duration || 30);
  res.json({ success: true, id });
});

router.delete('/schedule/:id', auth, (req, res) => {
  db.prepare('DELETE FROM doctor_schedules WHERE id=? AND doctor_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

module.exports = router;

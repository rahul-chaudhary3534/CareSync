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
  const profile = db.prepare(`SELECT p.*, u.email FROM patient_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?`).get(req.user.id);
  res.json(profile || {});
});

router.put('/profile', auth, upload.single('avatar'), (req, res) => {
  const { name, dob, gender, phone, address, blood_group, allergies, chronic_diseases, weight, height } = req.body;
  const avatar = req.file ? '/uploads/' + req.file.filename : req.body.avatar;
  db.prepare(`INSERT INTO patient_profiles (user_id,name,dob,gender,phone,address,blood_group,allergies,chronic_diseases,avatar,weight,height,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,dob=excluded.dob,gender=excluded.gender,phone=excluded.phone,
    address=excluded.address,blood_group=excluded.blood_group,allergies=excluded.allergies,chronic_diseases=excluded.chronic_diseases,
    avatar=excluded.avatar,weight=excluded.weight,height=excluded.height,updated_at=excluded.updated_at`
  ).run(req.user.id, name, dob, gender, phone, address, blood_group, allergies, chronic_diseases, avatar, weight, height);
  res.json({ success: true });
});

// ---- HEALTH METRICS ----
router.get('/health-metrics', auth, (req, res) => {
  const metrics = db.prepare('SELECT * FROM health_metrics WHERE patient_id = ? ORDER BY date DESC').all(req.user.id);
  res.json(metrics);
});

router.post('/health-metrics', auth, (req, res) => {
  const { date, bp_systolic, bp_diastolic, blood_sugar, weight, notes } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO health_metrics (id,patient_id,date,bp_systolic,bp_diastolic,blood_sugar,weight,notes) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, date, bp_systolic, bp_diastolic, blood_sugar, weight, notes);
  res.json({ success: true, id });
});

router.delete('/health-metrics/:id', auth, (req, res) => {
  db.prepare('DELETE FROM health_metrics WHERE id = ? AND patient_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ---- MEDICAL REPORTS ----
router.get('/reports', auth, (req, res) => {
  const { month, year, category } = req.query;
  let q = `SELECT r.*, COALESCE(d.name,'Unknown Doctor') as doctor_name FROM medical_reports r 
           LEFT JOIN doctor_profiles d ON d.user_id = r.doctor_id
           WHERE r.patient_id = ?`;
  const params = [req.user.id];
  if (month) { q += ` AND strftime('%m', r.report_date) = ?`; params.push(month.padStart(2,'0')); }
  if (year) { q += ` AND strftime('%Y', r.report_date) = ?`; params.push(year); }
  if (category) { q += ` AND r.category = ?`; params.push(category); }
  q += ' ORDER BY r.report_date DESC';
  res.json(db.prepare(q).all(...params));
});

router.post('/reports', auth, upload.single('file'), (req, res) => {
  const { title, category, report_date, description, doctor_id } = req.body;
  const id = uuidv4();
  const file_path = req.file ? '/uploads/' + req.file.filename : null;
  const file_name = req.file ? req.file.originalname : null;
  db.prepare('INSERT INTO medical_reports (id,patient_id,doctor_id,title,category,report_date,description,file_path,file_name) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, doctor_id || null, title, category, report_date, description, file_path, file_name);
  res.json({ success: true, id });
});

router.delete('/reports/:id', auth, (req, res) => {
  db.prepare('DELETE FROM medical_reports WHERE id = ? AND patient_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ---- APPOINTMENTS ----
router.get('/appointments', auth, (req, res) => {
  const apt = db.prepare(`
    SELECT a.*, COALESCE(d.name,'Unknown') as doctor_name, COALESCE(h.name,'Unknown') as hospital_name
    FROM appointments a
    LEFT JOIN doctor_profiles d ON d.user_id = a.doctor_id
    LEFT JOIN hospitals h ON h.id = a.hospital_id
    WHERE a.patient_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all(req.user.id);
  res.json(apt);
});

router.post('/appointments', auth, (req, res) => {
  const { doctor_id, hospital_id, appointment_date, appointment_time, reason } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO appointments (id,patient_id,doctor_id,hospital_id,appointment_date,appointment_time,reason) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.user.id, doctor_id, hospital_id, appointment_date, appointment_time, reason);
  res.json({ success: true, id });
});

router.put('/appointments/:id/review', auth, (req, res) => {
  const { rating, review } = req.body;
  db.prepare('UPDATE appointments SET doctor_rating=?, doctor_review=? WHERE id=? AND patient_id=?')
    .run(rating, review, req.params.id, req.user.id);
  // Update doctor avg rating
  const apt = db.prepare('SELECT doctor_id FROM appointments WHERE id=?').get(req.params.id);
  if (apt?.doctor_id) {
    const stats = db.prepare('SELECT AVG(doctor_rating) as avg, COUNT(*) as cnt FROM appointments WHERE doctor_id=? AND doctor_rating IS NOT NULL').get(apt.doctor_id);
    db.prepare('UPDATE doctor_profiles SET avg_rating=?, total_reviews=? WHERE user_id=?').run(Math.round(stats.avg*10)/10, stats.cnt, apt.doctor_id);
  }
  res.json({ success: true });
});

router.put('/appointments/:id/cancel', auth, (req, res) => {
  db.prepare(`UPDATE appointments SET status='cancelled' WHERE id=? AND patient_id=?`).run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ---- CERTIFICATES ----
router.get('/certificates', auth, (req, res) => {
  const certs = db.prepare('SELECT * FROM certificates WHERE patient_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(certs);
});

router.post('/certificates', auth, upload.single('file'), (req, res) => {
  const { type, title, issuer, issue_date, expiry_date, policy_number, notes } = req.body;
  const id = uuidv4();
  const file_path = req.file ? '/uploads/' + req.file.filename : null;
  const file_name = req.file ? req.file.originalname : null;
  db.prepare('INSERT INTO certificates (id,patient_id,type,title,issuer,issue_date,expiry_date,policy_number,file_path,file_name,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, type, title, issuer, issue_date, expiry_date, policy_number, file_path, file_name, notes);
  res.json({ success: true, id });
});

router.delete('/certificates/:id', auth, (req, res) => {
  db.prepare('DELETE FROM certificates WHERE id=? AND patient_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ---- HOSPITALS ----
router.get('/doctors', auth, (req, res) => {
  const doctors = db.prepare('SELECT d.*, u.email FROM doctor_profiles d JOIN users u ON u.id=d.user_id WHERE d.name IS NOT NULL').all();
  res.json(doctors);
});

module.exports = router;

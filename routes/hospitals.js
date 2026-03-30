const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'caresync_secret_2024';

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

router.get('/', (req, res) => {
  const hospitals = db.prepare('SELECT * FROM hospitals ORDER BY avg_rating DESC').all();
  res.json(hospitals);
});

router.get('/:id', (req, res) => {
  const hospital = db.prepare('SELECT * FROM hospitals WHERE id=?').get(req.params.id);
  if (!hospital) return res.status(404).json({ error: 'Not found' });
  const reviews = db.prepare(`
    SELECT r.*, COALESCE(p.name, d.name, u.email) as reviewer_name
    FROM hospital_reviews r
    JOIN users u ON u.id=r.user_id
    LEFT JOIN patient_profiles p ON p.user_id=r.user_id
    LEFT JOIN doctor_profiles d ON d.user_id=r.user_id
    WHERE r.hospital_id=? ORDER BY r.created_at DESC
  `).all(req.params.id);
  res.json({ ...hospital, reviews });
});

router.post('/:id/review', auth, (req, res) => {
  const { rating, review } = req.body;
  const existing = db.prepare('SELECT id FROM hospital_reviews WHERE hospital_id=? AND user_id=?').get(req.params.id, req.user.id);
  if (existing) {
    db.prepare('UPDATE hospital_reviews SET rating=?,review=? WHERE id=?').run(rating, review, existing.id);
  } else {
    db.prepare('INSERT INTO hospital_reviews (id,hospital_id,user_id,rating,review) VALUES (?,?,?,?,?)')
      .run(uuidv4(), req.params.id, req.user.id, rating, review);
  }
  const stats = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM hospital_reviews WHERE hospital_id=?').get(req.params.id);
  db.prepare('UPDATE hospitals SET avg_rating=?,total_reviews=? WHERE id=?')
    .run(Math.round(stats.avg * 10) / 10, stats.cnt, req.params.id);
  res.json({ success: true });
});

module.exports = router;

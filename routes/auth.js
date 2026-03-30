const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'caresync_secret_2024';

router.post('/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)').run(id, email, hash);
  const token = jwt.sign({ id, email, role: null }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, userId: id, role: null, needsRole: true });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, userId: user.id, role: user.role, needsRole: !user.role });
});

router.post('/set-role', (req, res) => {
  const { userId, role } = req.body;
  if (!['patient','doctor'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  if (role === 'patient') {
    const exists = db.prepare('SELECT user_id FROM patient_profiles WHERE user_id = ?').get(userId);
    if (!exists) db.prepare('INSERT INTO patient_profiles (user_id) VALUES (?)').run(userId);
  } else {
    const exists = db.prepare('SELECT user_id FROM doctor_profiles WHERE user_id = ?').get(userId);
    if (!exists) db.prepare('INSERT INTO doctor_profiles (user_id) VALUES (?)').run(userId);
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role });
});

router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    res.json(decoded);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

module.exports = router;

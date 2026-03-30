// ============================================================
// CareSync API Helper
// ============================================================

const BASE = '';

async function request(method, url, data, isFormData = false) {
  const token = localStorage.getItem('cs_token');
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (data) opts.body = isFormData ? data : JSON.stringify(data);

  const res = await fetch(BASE + url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

const api = {
  get: (url) => request('GET', url),
  post: (url, data, form) => request('POST', url, data, form),
  put: (url, data, form) => request('PUT', url, data, form),
  delete: (url) => request('DELETE', url),
};

// ---- AUTH ----
api.auth = {
  signup: (email, password) => api.post('/api/auth/signup', { email, password }),
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  setRole: (userId, role) => api.post('/api/auth/set-role', { userId, role }),
  me: () => api.get('/api/auth/me'),
};

// ---- PATIENT ----
api.patient = {
  getProfile: () => api.get('/api/patient/profile'),
  updateProfile: (fd) => api.put('/api/patient/profile', fd, true),
  getMetrics: () => api.get('/api/patient/health-metrics'),
  addMetric: (data) => api.post('/api/patient/health-metrics', data),
  deleteMetric: (id) => api.delete('/api/patient/health-metrics/' + id),
  getReports: (q) => api.get('/api/patient/reports' + (q ? '?' + new URLSearchParams(q) : '')),
  addReport: (fd) => api.post('/api/patient/reports', fd, true),
  deleteReport: (id) => api.delete('/api/patient/reports/' + id),
  getAppointments: () => api.get('/api/patient/appointments'),
  bookAppointment: (data) => api.post('/api/patient/appointments', data),
  reviewAppointment: (id, data) => api.put('/api/patient/appointments/' + id + '/review', data),
  cancelAppointment: (id) => api.put('/api/patient/appointments/' + id + '/cancel'),
  getCertificates: () => api.get('/api/patient/certificates'),
  addCertificate: (fd) => api.post('/api/patient/certificates', fd, true),
  deleteCertificate: (id) => api.delete('/api/patient/certificates/' + id),
  getDoctors: () => api.get('/api/patient/doctors'),
};

// ---- DOCTOR ----
api.doctor = {
  getProfile: () => api.get('/api/doctor/profile'),
  updateProfile: (fd) => api.put('/api/doctor/profile', fd, true),
  getPatients: () => api.get('/api/doctor/patients'),
  getPatient: (id) => api.get('/api/doctor/patients/' + id),
  uploadReport: (fd) => api.post('/api/doctor/upload-report', fd, true),
  getAppointments: () => api.get('/api/doctor/appointments'),
  updateAppointmentStatus: (id, status) => api.put('/api/doctor/appointments/' + id + '/status', { status }),
  getSchedule: () => api.get('/api/doctor/schedule'),
  addSchedule: (data) => api.post('/api/doctor/schedule', data),
  deleteSchedule: (id) => api.delete('/api/doctor/schedule/' + id),
};

// ---- HOSPITALS ----
api.hospitals = {
  list: () => api.get('/api/hospitals'),
  get: (id) => api.get('/api/hospitals/' + id),
  review: (id, data) => api.post('/api/hospitals/' + id + '/review', data),
};

// ---- UTILS ----
api.getUser = () => {
  const token = localStorage.getItem('cs_token');
  if (!token) return null;
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
};

api.logout = () => {
  localStorage.removeItem('cs_token');
  localStorage.removeItem('cs_user');
  window.location.href = '/';
};

window.api = api;

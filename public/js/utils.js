// Toast notification helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// Auth guard
function requireAuth(expectedRole) {
  const user = api.getUser();
  if (!user) { window.location.href = '/'; return null; }
  if (expectedRole && user.role !== expectedRole) {
    window.location.href = user.role === 'doctor' ? '/doctor/dashboard.html' : '/patient/dashboard.html';
    return null;
  }
  return user;
}

// Sidebar active link
function setActiveSidebarLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href && path.endsWith(href.split('/').pop())) {
      item.classList.add('active');
    }
  });
}

// Populate sidebar user info
async function populateSidebarUser(role) {
  try {
    const profile = role === 'doctor' ? await api.doctor.getProfile() : await api.patient.getProfile();
    const name = profile.name || 'User';
    const nameEl = document.getElementById('sidebar-user-name');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (nameEl) nameEl.textContent = name;
    if (avatarEl) {
      if (profile.avatar) {
        avatarEl.innerHTML = `<img src="${profile.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        avatarEl.textContent = name.charAt(0).toUpperCase();
      }
    }
  } catch (e) {}
}

// Format date
function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Status badge helper
function statusBadge(status) {
  const map = { pending: 'badge-amber', confirmed: 'badge-teal', completed: 'badge-green', cancelled: 'badge-red' };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
}

// Stars renderer
function renderStars(rating, interactive = false, onRate) {
  let html = '<div class="stars">';
  for (let i = 1; i <= 5; i++) {
    const cls = i <= rating ? 'star filled' : 'star';
    html += interactive
      ? `<span class="${cls}" data-val="${i}" onclick="if(window._onRate)window._onRate(${i})">★</span>`
      : `<span class="${cls} star-display">★</span>`;
  }
  html += '</div>';
  if (interactive && onRate) window._onRate = onRate;
  return html;
}

window.showToast = showToast;
window.requireAuth = requireAuth;
window.setActiveSidebarLink = setActiveSidebarLink;
window.populateSidebarUser = populateSidebarUser;
window.formatDate = formatDate;
window.statusBadge = statusBadge;
window.renderStars = renderStars;

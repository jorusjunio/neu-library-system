// Show error if Google login was rejected
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('error') === 'noaccess') {
  const toast = document.getElementById('googleErrorToast');
  if (toast) {
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 5000);
  }
}

// entrance/js/app.js

const API_BASE = '/api';

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentStudent = null;
let countdownInterval = null;

// ─── ELEMENTS ────────────────────────────────────────────────────────────────
const screens = {
  idle:     document.getElementById('screenIdle'),
  scanning: document.getElementById('screenScanning'),
  welcome:  document.getElementById('screenWelcome'),
  success:  document.getElementById('screenSuccess'),
  error:    document.getElementById('screenError'),
};

const retryBtn  = document.getElementById('retryBtn');
const countdown = document.getElementById('countdown');

// ─── CANVAS BACKGROUND ───────────────────────────────────────────────────────
(function initCanvas() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], orbs = [], t = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // ── Star particles ──
  function createParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.15,
      dy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.5 + 0.1,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
    };
  }

  // ── Aurora orbs — big soft glowing blobs ──
  function createOrb() {
    const colors = [
      [74, 158, 255],   // blue
      [100, 80, 220],   // purple
      [52, 211, 153],   // green
      [249, 168, 212],  // pink
      [125, 211, 252],  // sky
    ];
    const c = colors[Math.floor(Math.random() * colors.length)];
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 280 + 160,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.3,
      color: c,
      alpha: Math.random() * 0.07 + 0.03,
      pulseSpeed: Math.random() * 0.008 + 0.003,
      pulseOffset: Math.random() * Math.PI * 2,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: 100 }, createParticle);
    orbs = Array.from({ length: 6 }, createOrb);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.016;

    // Draw aurora orbs first (behind particles)
    for (const o of orbs) {
      const pulse = 1 + Math.sin(t * o.pulseSpeed * 60 + o.pulseOffset) * 0.15;
      const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * pulse);
      grad.addColorStop(0,   `rgba(${o.color[0]},${o.color[1]},${o.color[2]},${o.alpha})`);
      grad.addColorStop(0.5, `rgba(${o.color[0]},${o.color[1]},${o.color[2]},${o.alpha * 0.4})`);
      grad.addColorStop(1,   `rgba(${o.color[0]},${o.color[1]},${o.color[2]},0)`);
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      o.x += o.dx; o.y += o.dy;
      if (o.x < -o.r) o.x = W + o.r;
      if (o.x > W + o.r) o.x = -o.r;
      if (o.y < -o.r) o.y = H + o.r;
      if (o.y > H + o.r) o.y = -o.r;
    }

    // Draw star particles on top
    for (const p of particles) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * p.twinkleSpeed * 60 + p.twinkleOffset);
      const a = p.alpha * (0.4 + 0.6 * twinkle);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
})();

// ─── CLOCK ───────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('clockTime').textContent = now.toLocaleTimeString('en-PH', { hour12: false });
  document.getElementById('clockDate').textContent = now.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
setInterval(updateClock, 1000);
updateClock();

// ─── SCREEN SWITCHER ─────────────────────────────────────────────────────────
function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

// ─── RFID SCAN HANDLER ───────────────────────────────────────────────────────
async function handleScan(schoolId) {
  schoolId = schoolId.trim().toUpperCase();
  if (!schoolId) return;

  showScreen('scanning');
  await sleep(800);

  try {
    const res = await fetch(`${API_BASE}/student/${schoolId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(res.status === 403 ? '🚫' : '⚠️',
                res.status === 403 ? 'Access Blocked' : 'ID Not Found',
                data.error || 'Please see the librarian.');
      return;
    }
    currentStudent = data;
    renderWelcome(currentStudent);
    showScreen('welcome');
    checkMilestone(currentStudent, !currentStudent.first_visit_date || currentStudent.total_visits === 0);
  } catch (err) {
    showError('⚠️', 'Error', err.message);
  }
}

// ─── RECORD VISIT ─────────────────────────────────────────────────────────────
async function recordVisit(schoolId, purpose) {
  const res = await fetch(`${API_BASE}/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ school_id: schoolId, purpose }),
  });
  if (!res.ok) throw new Error('Failed to record visit.');
  return await res.json();
}

// ─── RENDER WELCOME ───────────────────────────────────────────────────────────
function renderWelcome(student) {
  const initials = student.name
    .split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('');

  document.getElementById('welcomeAvatar').textContent  = initials;
  document.getElementById('welcomeName').textContent    = student.name;
  document.getElementById('welcomeCollege').textContent = student.college;
  document.getElementById('welcomeType').textContent    = student.type || 'Student';

  const badge = document.getElementById('firstTimerBadge');
  const greetingEl = document.getElementById('welcomeGreeting');
  if (!student.first_visit_date || student.total_visits === 0) {
    badge.classList.remove('hidden');
    if (greetingEl) greetingEl.textContent = 'WELCOME,';
  } else {
    badge.classList.add('hidden');
    if (greetingEl) greetingEl.textContent = 'WELCOME BACK,';
  }

  document.getElementById('streakNumber').textContent = student.current_streak || 0;
  document.getElementById('streakTotal').textContent  = student.total_visits   || 0;

  document.querySelectorAll('.purpose-card').forEach(c => c.classList.remove('selected'));
}

// ─── PURPOSE CARDS ────────────────────────────────────────────────────────────
document.querySelectorAll('.purpose-card').forEach(card => {
  card.addEventListener('click', async () => {
    if (!currentStudent) return;

    document.querySelectorAll('.purpose-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    const purpose = card.dataset.purpose;
    await sleep(300);
    showScreen('scanning');

    try {
      await recordVisit(currentStudent.school_id, purpose);
      document.getElementById('successPurpose').textContent = purpose;
      showScreen('success');
      startCountdown(1);
    } catch (err) {
      document.getElementById('errorMsg').textContent = err.message;
      showScreen('error');
    }
  });
});

// ─── COUNTDOWN RESET ─────────────────────────────────────────────────────────
function startCountdown(seconds) {
  clearInterval(countdownInterval);

  // Show & animate the progress bar
  const barWrap = document.getElementById('countdownBarWrap');
  const bar     = document.getElementById('countdownBar');
  if (barWrap && bar) {
    barWrap.classList.remove('hidden');
    bar.style.animation = 'none';
    bar.offsetHeight; // force reflow
    bar.style.animation = `countdownShrink ${seconds}s linear forwards`;
  }

  let n = seconds;
  countdown.textContent = n;
  countdownInterval = setInterval(() => {
    n--;
    countdown.textContent = n;
    if (n <= 0) {
      clearInterval(countdownInterval);
      if (barWrap) barWrap.classList.add('hidden');
      resetToIdle();
    }
  }, 1000);
}

function showError(icon, title, msg) {
  document.querySelector('.error-icon').textContent = icon;
  document.querySelector('.error-title').textContent = title;
  document.getElementById('errorMsg').textContent = msg;
  showScreen('error');
}

function resetToIdle() {
  currentStudent = null;
  document.getElementById('mainInput').value = '';
  showScreen('idle');
  document.getElementById('mainInput').focus();
}

// ─── LOGIN TOGGLE ────────────────────────────────────────────────────────────
let loginMode = 'id';

document.getElementById('toggleId').addEventListener('click', () => {
  if (loginMode === 'id') return;
  loginMode = 'id';
  document.getElementById('toggleId').classList.add('active');
  document.getElementById('toggleEmail').classList.remove('active');
  document.querySelector('.login-toggle').classList.remove('email-active');
  const inp = document.getElementById('mainInput');
  inp.style.transition = 'opacity 0.18s ease';
  inp.style.opacity = '0';
  setTimeout(() => {
    inp.type        = 'text';
    inp.placeholder = 'School ID  e.g. 26-00123-001';
    inp.maxLength   = 20;
    inp.value       = '';
    inp.style.opacity = '1';
    inp.focus();
  }, 180);
});

document.getElementById('toggleEmail').addEventListener('click', () => {
  if (loginMode === 'email') return;
  loginMode = 'email';
  document.getElementById('toggleEmail').classList.add('active');
  document.getElementById('toggleId').classList.remove('active');
  document.querySelector('.login-toggle').classList.add('email-active');
  const inp = document.getElementById('mainInput');
  inp.style.transition = 'opacity 0.18s ease';
  inp.style.opacity = '0';
  setTimeout(() => {
    inp.type        = 'email';
    inp.placeholder = 'yourname@neu.edu.ph';
    inp.maxLength   = 100;
    inp.value       = '';
    inp.style.opacity = '1';
    inp.focus();
  }, 180);
});

// ─── MAIN BUTTON & ENTER ─────────────────────────────────────────────────────
document.getElementById('mainBtn').addEventListener('click', () => {
  const val = document.getElementById('mainInput').value.trim();
  if (!val) return;
  if (loginMode === 'email') processEmail(val);
  else handleScan(val);
});

document.getElementById('mainInput').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const val = document.getElementById('mainInput').value.trim();
  if (!val) return;
  if (loginMode === 'email') processEmail(val);
  else handleScan(val);
});

// ─── EMAIL LOGIN ─────────────────────────────────────────────────────────────
async function processEmail(email) {
  if (!email.toLowerCase().endsWith('@neu.edu.ph')) {
    document.getElementById('errorMsg').textContent = 'Please use your NEU institutional email (@neu.edu.ph).';
    showScreen('error');
    return;
  }
  showScreen('scanning');
  await sleep(800);
  try {
    const res = await fetch(`${API_BASE}/student/email/${encodeURIComponent(email.toLowerCase())}`);
    const data = await res.json();
    if (!res.ok) {
      showError(res.status === 403 ? '🚫' : '⚠️',
                res.status === 403 ? 'Access Blocked' : 'Email Not Found',
                data.error || 'Please see the librarian.');
      return;
    }
    currentStudent = data;
    renderWelcome(currentStudent);
    showScreen('welcome');
    checkMilestone(currentStudent, !currentStudent.first_visit_date || currentStudent.total_visits === 0);
  } catch (err) {
    document.getElementById('errorMsg').textContent = 'Connection error. Please try again.';
    showScreen('error');
  }
}

// ─── OTHER EVENT LISTENERS ───────────────────────────────────────────────────
retryBtn.addEventListener('click', resetToIdle);

window.addEventListener('load', () => {
  document.getElementById('mainInput').focus();
  showScreen('idle');
});


// ─── CONFETTI & MILESTONES ────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  'rgba(255,255,255,0.9)',
  'rgba(125,211,252,0.9)',
  'rgba(52,211,153,0.9)',
  'rgba(167,139,250,0.9)',
  'rgba(249,168,212,0.9)',
  'rgba(253,224,71,0.9)',
  'rgba(248,113,113,0.9)',
];

function launchConfetti(count = 80) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left     = Math.random() * 100 + 'vw';
      el.style.width    = (Math.random() * 8 + 6) + 'px';
      el.style.height   = (Math.random() * 10 + 8) + 'px';
      el.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      const dur = Math.random() * 2 + 2.5;
      el.style.animationDuration = dur + 's';
      el.style.animationDelay   = (Math.random() * 0.5) + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), (dur + 1) * 1000);
    }, i * 18);
  }
}

function showMilestoneToast(emoji, message) {
  const existing = document.querySelector('.milestone-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'milestone-toast';
  toast.innerHTML = `<span class="milestone-toast-emoji">${emoji}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

function checkMilestone(student, isFirstVisit) {
  const visits = student.total_visits || 0;

  if (isFirstVisit || visits === 0) {
    launchConfetti(100);
    showMilestoneToast("🎉", "Welcome to NEU Library for the first time!");
  } else if (visits === 10) {
    launchConfetti(80);
    showMilestoneToast("🔟", "10th Visit! You're a regular now!");
  } else if (visits === 50) {
    launchConfetti(120);
    showMilestoneToast("🏆", "50th Visit! Library Legend!");
  } else if (visits === 100) {
    launchConfetti(160);
    showMilestoneToast("💯", "100th Visit! You are an NEU Library Champion!");
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── SECRET ADMIN LOGIN ───────────────────────────────────────────────────────
(function initAdminLogin() {
  const overlay   = document.getElementById('adminModalOverlay');
  const modal     = document.getElementById('adminModal');
  const closeBtn  = document.getElementById('adminModalClose');
  const loginBtn  = document.getElementById('adminLoginBtn');
  const btnText   = document.getElementById('adminLoginBtnText');
  const errorEl   = document.getElementById('adminError');
  const logoWrap  = document.querySelector('.neu-logo-wrap');

  // Secret: click logo to open
  let clickCount = 0, clickTimer = null;
  logoWrap.style.cursor = 'pointer';
  logoWrap.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 600);
    if (clickCount >= 1) {
      clickCount = 0;
      openModal();
    }
  });

  function openModal() {
    overlay.classList.remove('hidden');
    document.getElementById('adminUsername').focus();
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
    errorEl.classList.add('hidden');
  }

  function closeModal() {
    modal.style.animation = 'modalOut 0.3s ease forwards';
    overlay.style.animation = 'overlayOut 0.3s ease forwards';
    setTimeout(() => {
      overlay.classList.add('hidden');
      modal.style.animation = '';
      overlay.style.animation = '';
    }, 280);
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Enter key
  [document.getElementById('adminUsername'), document.getElementById('adminPassword')]
    .forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));

  loginBtn.addEventListener('click', doLogin);

  async function doLogin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    if (!username || !password) return;

    loginBtn.disabled = true;
    btnText.textContent = 'Signing in...';
    errorEl.classList.add('hidden');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Invalid credentials.';
        errorEl.classList.remove('hidden');
        loginBtn.disabled = false;
        btnText.textContent = 'Sign In';
        return;
      }
      // Success — redirect to admin
      btnText.textContent = '✓ Welcome, ' + data.name.split(' ')[0] + '!';
      localStorage.removeItem('neu_last_tab');
      localStorage.removeItem('neu_last_range');
      localStorage.removeItem('neu_last_custom_start');
      localStorage.removeItem('neu_last_custom_end');
      setTimeout(() => { window.location.href = '/admin'; }, 800);
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
      errorEl.classList.remove('hidden');
      loginBtn.disabled = false;
      btnText.textContent = 'Sign In';
    }
  }
})();


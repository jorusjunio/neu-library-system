// user/app.js — NEU Library Welcome Page

async function loadUser() {
  try {
    const res  = await fetch('/api/me');
    const user = await res.json();

    document.getElementById('userEmail').textContent = user.email;

    if (user.picture) {
      document.getElementById('avatar').src = user.picture;
    } else {
      document.getElementById('avatar').style.display = 'none';
      document.getElementById('avatarFallback').style.display = 'flex';
    }

    const badge = document.getElementById('roleBadge');
    if (user.activeRole === 'admin') {
      badge.textContent = '👑 Admin Mode';
      badge.classList.add('admin');
    } else {
      badge.textContent = '👤 Regular User';
    }

    // Show switch button only if they have admin role in DB
    if (user.role === 'admin') {
      document.getElementById('adminSection').style.display = 'block';
    }

  } catch (err) {
    window.location.href = '/login';
  }
}

async function switchToAdmin() {
  const res  = await fetch('/api/switch-role', { method: 'POST' });
  const data = await res.json();
  if (data.activeRole === 'admin') {
    window.location.href = '/admin';
  }
}

// Show error if redirected from admin-only page
const params = new URLSearchParams(window.location.search);
if (params.get('error') === 'admin_only') {
  document.getElementById('errorNotice').style.display = 'block';
}

loadUser();
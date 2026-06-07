/** Auth helpers shared by the marketing site (OAuth + email/password). */

function getConfig() {
  return (
    window.PABANDI_CONFIG || {
      API_BASE_URL: 'https://pabandi-server-el.a.run.app',
      API_VERSION: 'v1',
      APP_PATH: '/app',
      SITE_URL: window.location.origin,
    }
  );
}

function apiUrl(path) {
  const cfg = getConfig();
  return `${cfg.API_BASE_URL}/api/${cfg.API_VERSION}${path}`;
}

function appUrl(path) {
  const cfg = getConfig();
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const base = isLocal ? 'http://localhost:3000' : (cfg.SITE_URL || window.location.origin).replace(/\/$/, '') + (cfg.APP_PATH || '/app');
  const sub = path.startsWith('/') ? path : `/${path}`;
  return `${base}${sub}`;
}

function getSelectedRole() {
  const input = document.querySelector('input[name="modal-role"]:checked');
  return input?.value === 'business' ? 'BUSINESS_OWNER' : 'CUSTOMER';
}

function getSelectedRoleQuery() {
  const input = document.querySelector('input[name="modal-role"]:checked');
  return input?.value === 'business' ? 'business' : 'customer';
}

function parseFullName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ') || firstName;
  return { firstName, lastName };
}

function saveAuthSession(user, token) {
  const payload = {
    state: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
      },
      token,
      isAuthenticated: true,
    },
    version: 0,
  };
  localStorage.setItem('auth-storage', JSON.stringify(payload));
}

function redirectToApp(path) {
  window.location.assign(appUrl(path));
}

function setModalError(message) {
  const el = document.getElementById('modal-auth-error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.style.display = 'block';
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}

function setSubmitLoading(loading) {
  const btn = document.getElementById('modal-submit-btn');
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.7' : '';
  btn.style.pointerEvents = loading ? 'none' : '';
  btn.textContent = loading
    ? 'Please wait…'
    : typeof currentTab !== 'undefined' && currentTab === 'signup'
      ? 'Create Account →'
      : 'Log In →';
}

async function apiRequest(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(apiUrl(path), {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error || 'Request failed. Please try again.';
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    if (err.message === 'Failed to fetch') {
      throw new Error('Cannot reach Pabandi servers. Try again in a moment.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleSubmit() {
  setModalError('');
  const isSignup = typeof currentTab !== 'undefined' && currentTab === 'signup';
  const email = document.getElementById('input-email')?.value?.trim();
  const password = document.getElementById('input-password')?.value;
  const phone = document.getElementById('input-phone')?.value?.trim();
  const fullName = document.getElementById('input-name')?.value?.trim();

  if (!email || !password) {
    setModalError('Email and password are required.');
    return;
  }
  if (isSignup && !fullName) {
    setModalError('Please enter your full name.');
    return;
  }
  if (isSignup && password.length < 8) {
    setModalError('Password must be at least 8 characters.');
    return;
  }

  setSubmitLoading(true);
  try {
    if (isSignup) {
      const { firstName, lastName } = parseFullName(fullName);
      const role = getSelectedRole();
      const body = {
        email,
        password,
        firstName,
        lastName,
        phone: phone || undefined,
        role,
      };
      if (role === 'BUSINESS_OWNER') {
        body.businessName =
          document.getElementById('input-business-name')?.value?.trim() ||
          `${firstName}'s Business`;
      }
      const result = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const { user, token } = result.data;
      saveAuthSession(user, token);
      if (typeof closeModal === 'function') closeModal();
      redirectToApp(role === 'BUSINESS_OWNER' ? '/dashboard' : '/wallet');
      return;
    }

    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const { user, token } = result.data;
    saveAuthSession(user, token);
    if (typeof closeModal === 'function') closeModal();
    const dest =
      user.role === 'BUSINESS_OWNER' || user.role === 'ADMIN' ? '/dashboard' : '/wallet';
    redirectToApp(dest);
  } catch (err) {
    if (err.data?.errors) {
      const messages = Object.values(err.data.errors).join(' ');
      setModalError(messages || err.message);
    } else {
      setModalError(err.message || 'Something went wrong.');
    }
    setSubmitLoading(false);
  }
}

function handleOAuth(provider) {
  setModalError('');
  const role = getSelectedRoleQuery();
  const cfg = getConfig();
  window.location.assign(
    `${cfg.API_BASE_URL}/api/${cfg.API_VERSION}/auth/${provider}?role=${role}`
  );
}

/** Only handle OAuth return URLs — not random ?token= query params */
function isAuthCallbackUrl() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  return (
    pathname === '/auth/callback' ||
    pathname.endsWith('/auth/callback') ||
    pathname === '/app/auth/callback' ||
    pathname.endsWith('/app/auth/callback')
  );
}

function handleAuthCallbackFromUrl() {
  if (!isAuthCallbackUrl()) return false;

  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  if (error) {
    const messages = {
      google_failed: 'Google sign-in failed. Please try again.',
      facebook_failed: 'Facebook sign-in failed. Please try again.',
      facebook_not_configured: 'Facebook login is not available yet. Use Google or email instead.',
      oauth_failed: 'Sign-in was cancelled or failed.',
    };
    if (typeof openModal === 'function') openModal('login');
    setModalError(messages[error] || 'Sign-in failed. Please try again.');
    window.history.replaceState({}, '', window.location.origin + '/');
    return false;
  }

  const token = params.get('token');
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    saveAuthSession(
      {
        id: payload.id,
        email: payload.email,
        firstName: payload.firstName || payload.email?.split('@')[0] || 'User',
        lastName: payload.lastName || '',
        role: payload.role,
      },
      token
    );
    redirectToApp(
      payload.role === 'BUSINESS_OWNER' || payload.role === 'ADMIN' ? '/dashboard' : '/wallet'
    );
  } catch {
    if (typeof openModal === 'function') openModal('login');
    setModalError('Could not complete sign-in. Please try again.');
    window.history.replaceState({}, '', window.location.origin + '/');
  }
  return false;
}

function updateSignupFieldsVisibility() {
  const isSignup = typeof currentTab !== 'undefined' && currentTab === 'signup';
  const role = getSelectedRole();
  const businessGroup = document.getElementById('business-name-group');
  const phoneGroup = document.getElementById('phone-group');
  if (phoneGroup) phoneGroup.style.display = isSignup ? 'block' : 'none';
  if (businessGroup) {
    businessGroup.style.display =
      isSignup && role === 'BUSINESS_OWNER' ? 'block' : 'none';
  }
}

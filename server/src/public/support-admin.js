(() => {
  const API = '/api/v1/admin/support';
  const $ = (id) => document.getElementById(id);
  const els = {
    token: $('token'),
    connect: $('connect'),
    tokenMsg: $('tokenMsg'),
    conn: $('conn'),
    tools: $('tools'),
    createCard: $('createCard'),
    usersCard: $('usersCard'),
    q: $('q'),
    role: $('role'),
    refresh: $('refresh'),
    summary: $('summary'),
    rows: $('rows'),
    createUser: $('createUser'),
    createMsg: $('createMsg'),
    cEmail: $('cEmail'),
    cFirstName: $('cFirstName'),
    cLastName: $('cLastName'),
    cPhone: $('cPhone'),
    cPassword: $('cPassword'),
    cRole: $('cRole'),
  };

  let token = localStorage.getItem('pabandi_support_token') || '';
  els.token.value = token;

  function setConn(state, text) {
    els.conn.textContent = text;
    els.conn.className = 'pill ' + state;
  }

  async function api(path, options = {}) {
    const res = await fetch(API + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token,
        ...(options.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return body;
  }

  function showTools() {
    els.tools.classList.remove('hidden');
    els.createCard.classList.remove('hidden');
    els.usersCard.classList.remove('hidden');
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function verifiedLabel(user) {
    const parts = [];
    parts.push(user.isEmailVerified ? '<span class="ok">email</span>' : '<span class="warn">email?</span>');
    parts.push(user.isPhoneVerified ? '<span class="ok">phone</span>' : '<span class="warn">phone?</span>');
    return parts.join(' · ');
  }

  async function loadUsers() {
    const params = new URLSearchParams();
    if (els.q.value.trim()) params.set('q', els.q.value.trim());
    if (els.role.value) params.set('role', els.role.value);
    const { data } = await api(`/users?${params.toString()}`);
    els.summary.textContent = `${data.total} user${data.total === 1 ? '' : 's'}`;
    // User values are escaped through esc(); verifiedLabel() emits static markup only.
  // This innerHTML sink is safe for the fields rendered here.
  els.rows.innerHTML = data.users.map((u) => `
      <tr>
        <td>${esc(u.firstName)} ${esc(u.lastName)}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.phone || '—')}</td>
        <td><span class="pill">${esc(u.role)}</span></td>
        <td>${verifiedLabel(u)}</td>
        <td class="muted">${new Date(u.createdAt).toLocaleString()}</td>
        <td>
          <div class="actions">
            <button class="secondary small" data-edit="${esc(u.id)}">Edit</button>
            <button class="secondary small" data-pass="${esc(u.id)}">Reset password</button>
            <button class="danger small" data-del="${esc(u.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="muted">No users found.</td></tr>';
  }

  async function connect() {
    token = els.token.value.trim();
    if (!token) {
      els.tokenMsg.textContent = 'Enter the admin token';
      return;
    }
    els.tokenMsg.textContent = 'Connecting...';
    try {
      await loadUsers();
      localStorage.setItem('pabandi_support_token', token);
      setConn('ok', 'connected');
      els.tokenMsg.textContent = '';
      showTools();
    } catch (err) {
      setConn('bad', 'invalid token');
      els.tokenMsg.textContent = err.message;
    }
  }

  async function createUser() {
    els.createMsg.textContent = 'Creating...';
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: els.cEmail.value.trim(),
          password: els.cPassword.value,
          firstName: els.cFirstName.value.trim(),
          lastName: els.cLastName.value.trim(),
          phone: els.cPhone.value.trim() || undefined,
          role: els.cRole.value,
        }),
      });
      els.createMsg.textContent = 'User created';
      els.cEmail.value = '';
      els.cFirstName.value = '';
      els.cLastName.value = '';
      els.cPhone.value = '';
      els.cPassword.value = '';
      await loadUsers();
    } catch (err) {
      els.createMsg.textContent = err.message;
    }
  }

  async function editUser(id) {
    const firstName = prompt('First name (blank to keep)');
    const lastName = prompt('Last name (blank to keep)');
    const role = prompt('Role (CUSTOMER, BUSINESS_OWNER, TECHNICIAN, COORDINATOR, ADMIN; blank to keep)');
    const data = {};
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (role) data.role = role;
    if (Object.keys(data).length === 0) return;
    await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    await loadUsers();
  }

  async function resetPassword(id) {
    const password = prompt('Temporary password (min 8 characters)');
    if (!password) return;
    await api(`/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) });
    alert('Password updated');
  }

  async function deleteUser(id) {
    if (!confirm('Delete this user? Related records may block deletion.')) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      await loadUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  els.connect.addEventListener('click', connect);
  els.refresh.addEventListener('click', () => loadUsers().catch((err) => alert(err.message)));
  els.createUser.addEventListener('click', createUser);
  els.rows.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    if (btn.dataset.edit) editUser(btn.dataset.edit).catch((err) => alert(err.message));
    if (btn.dataset.pass) resetPassword(btn.dataset.pass).catch((err) => alert(err.message));
    if (btn.dataset.del) deleteUser(btn.dataset.del).catch((err) => alert(err.message));
  });
  els.q.addEventListener('input', () => loadUsers().catch(() => {}));
  els.role.addEventListener('change', () => loadUsers().catch(() => {}));

  if (token) {
    connect();
  } else {
    setConn('bad', 'no token');
  }
})();

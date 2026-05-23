let currentPage = 'home';
let currentModalMode = 'signup';
let currentTab = 'signup';

const SECTION_PAGES = {
  'biz-how': 'business',
  'biz-features': 'business',
  'biz-pab-rewards': 'business',
  'biz-pricing': 'business',
  'cust-how': 'customer',
};

function showPage(page) {
  document.querySelectorAll('.page, .hero-page').forEach((p) => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (!el) return;

  el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  currentPage = page;
  updateNav(page);
  closeMobileNav();
}

function updateNav(page) {
  document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
  const map = { business: 0, customer: 1 };
  const links = document.querySelectorAll('.nav-link');
  if (map[page] !== undefined && links[map[page]]) {
    links[map[page]].classList.add('active');
  }
}

function scrollToHowItWorks() {
  if (currentPage === 'customer') {
    scrollToSection('cust-how');
  } else {
    scrollToSection('biz-how');
  }
}

function scrollToSection(id) {
  const targetPage = SECTION_PAGES[id];
  if (targetPage && currentPage !== targetPage) {
    showPage(targetPage);
    requestAnimationFrame(() => {
      setTimeout(() => scrollToElement(id), 80);
    });
    return;
  }
  scrollToElement(id);
}

function scrollToElement(id) {
  const el = document.getElementById(id);
  if (el) {
    const offset = 72;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

function openModal(mode) {
  try {
    currentModalMode = mode;
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      console.error('Modal overlay missing');
      return;
    }

    ['modal-auth', 'modal-demo', 'modal-contact', 'modal-success'].forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) section.style.display = 'none';
    });

    if (mode === 'demo') {
      const demo = document.getElementById('modal-demo');
      if (demo) demo.style.display = 'block';
    } else if (mode === 'contact') {
      const contact = document.getElementById('modal-contact');
      if (contact) contact.style.display = 'block';
    } else {
      const auth = document.getElementById('modal-auth');
      if (auth) auth.style.display = 'block';
      switchTab(mode === 'login' ? 'login' : 'signup');
      if (typeof setModalError === 'function') setModalError('');
    }

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error('openModal failed:', err);
    document.body.style.overflow = '';
    if (typeof showToast === 'function') {
      showToast('Could not open form. Go to the app to sign in.');
    }
    const cfg = window.PABANDI_CONFIG || {};
    window.location.assign(
      (cfg.SITE_URL || window.location.origin) +
        (cfg.APP_PATH || '/app') +
        (mode === 'login' ? '/login' : '/register')
    );
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  document.body.style.overflow = '';
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function switchTab(tab) {
  currentTab = tab;
  const isSignup = tab === 'signup';

  const tabSignup = document.getElementById('tab-signup');
  const tabLogin = document.getElementById('tab-login');
  const signupRole = document.getElementById('signup-role');
  const nameGroup = document.getElementById('name-group');
  const phoneGroup = document.getElementById('phone-group');
  const title = document.getElementById('modal-title');
  const sub = document.getElementById('modal-sub');
  const submitBtn = document.getElementById('modal-submit-btn');

  if (tabSignup) tabSignup.classList.toggle('active', isSignup);
  if (tabLogin) tabLogin.classList.toggle('active', !isSignup);
  if (signupRole) signupRole.style.display = isSignup ? 'block' : 'none';
  if (nameGroup) nameGroup.style.display = isSignup ? 'block' : 'none';
  if (phoneGroup) phoneGroup.style.display = isSignup ? 'block' : 'none';
  if (title) title.textContent = isSignup ? 'Get Started' : 'Welcome Back';
  if (sub) {
    sub.textContent = isSignup
      ? 'Join Pabandi — free forever for customers.'
      : 'Log in to your Pabandi account.';
  }
  if (submitBtn) submitBtn.textContent = isSignup ? 'Create Account →' : 'Log In →';

  updateModalRole();
  if (typeof updateSignupFieldsVisibility === 'function') updateSignupFieldsVisibility();
  if (typeof setModalError === 'function') setModalError('');
}

function updateModalRole() {
  const roleInput = document.querySelector('input[name="modal-role"]:checked');
  if (!roleInput) return;
  const role = roleInput.value;
  const sub = document.getElementById('modal-sub');
  if (currentTab === 'signup' && sub) {
    sub.textContent =
      role === 'business'
        ? 'Start protecting your revenue with AI-powered bookings.'
        : 'Join Pabandi — free forever for customers.';
  }
  if (typeof updateSignupFieldsVisibility === 'function') updateSignupFieldsVisibility();
}

function handleDemoSubmit() {
  showSuccess('Demo Requested! 🎉', "We'll reach out within 24 hours to schedule your live demo.");
}

function handleContactSubmit() {
  showSuccess('Message Sent!', 'Our team will get back to you within 24 hours.');
}

function showSuccess(title, msg) {
  ['modal-auth', 'modal-demo', 'modal-contact'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const successTitle = document.getElementById('success-title');
  const successMsg = document.getElementById('success-msg');
  const successBlock = document.getElementById('modal-success');
  if (successTitle) successTitle.textContent = title;
  if (successMsg) successMsg.textContent = msg;
  if (successBlock) successBlock.style.display = 'block';
}

function handleFooterLink(label) {
  if (label === 'Contact') {
    openModal('contact');
    return;
  }
  showToast(`${label} — coming soon. Email hello@pabandi.com for help.`);
}

function handleWalletAction(action) {
  const cfg = window.PABANDI_CONFIG || {};
  const base = cfg.SITE_URL || window.location.origin;
  const appPath = cfg.APP_PATH || '/app';
  window.location.assign(`${base}${appPath}/wallet`);
}

function showToast(message) {
  let toast = document.getElementById('site-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'site-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function toggleMobileNav() {
  const panel = document.getElementById('nav-mobile');
  const btn = document.getElementById('nav-menu-btn');
  if (!panel || !btn) return;
  const open = panel.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
  btn.textContent = open ? '✕' : '☰';
}

function closeMobileNav() {
  const panel = document.getElementById('nav-mobile');
  const btn = document.getElementById('nav-menu-btn');
  if (panel) panel.classList.remove('open');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '☰';
  }
}

function initRoleCards() {
  document.querySelectorAll('.role-card').forEach((card) => {
    const page = card.dataset.page || (card.classList.contains('business') ? 'business' : 'customer');
    card.addEventListener('click', () => showPage(page));
    card.querySelectorAll('button').forEach((btn) => {
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPage(page);
      });
    });
  });
}

function initWalletActions() {
  document.querySelectorAll('.wallet-action-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleWalletAction(btn.textContent.trim());
    });
  });
}

function initFooterLinks() {
  document.querySelectorAll('.footer-link').forEach((link) => {
    if (link.getAttribute('onclick')) return;
    const label = link.textContent.trim();
    link.addEventListener('click', (e) => {
      e.preventDefault();
      handleFooterLink(label);
    });
  });
}

function initModalTriggers() {
  document.querySelectorAll('[data-open-modal]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(el.getAttribute('data-open-modal') || 'signup');
    });
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeMobileNav();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  handleAuthCallbackFromUrl();
  initRoleCards();
  initWalletActions();
  initFooterLinks();
  initModalTriggers();

  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === '1') openModal('login');
});

// Expose for inline handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.switchTab = switchTab;
window.updateModalRole = updateModalRole;
window.handleSubmit = handleSubmit;
window.handleOAuth = handleOAuth;
window.handleOverlayClick = handleOverlayClick;
window.showPage = showPage;
window.scrollToSection = scrollToSection;
window.scrollToHowItWorks = scrollToHowItWorks;
window.toggleMobileNav = toggleMobileNav;

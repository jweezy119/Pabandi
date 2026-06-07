/**
 * Phantom (Solana) wallet on the marketing site.
 * Persists address locally; syncs to API when user is logged in.
 */

const SOLANA_STORAGE_KEY = 'pabandi_solana_wallet';

function getSolanaProvider() {
  const provider = window.solana;
  return provider?.isPhantom ? provider : null;
}

function getAuthToken() {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token || null;
  } catch {
    return null;
  }
}

function shortAddress(addr) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : '';
}

function loadSavedWallet() {
  try {
    return JSON.parse(localStorage.getItem(SOLANA_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveWalletLocal(address) {
  localStorage.setItem(SOLANA_STORAGE_KEY, JSON.stringify({ address, chain: 'solana', connectedAt: Date.now() }));
}

async function syncWalletToApi(address) {
  const token = getAuthToken();
  if (!token) return;
  const cfg = window.PABANDI_CONFIG || {};
  const base = cfg.API_BASE_URL || 'https://pabandi-server-el.a.run.app';
  const version = cfg.API_VERSION || 'v1';
  try {
    await fetch(`${base}/api/${version}/crypto/wallet/solana`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ address }),
    });
  } catch (e) {
    console.warn('Could not sync Solana wallet to account', e);
  }
}

function updateConnectButtons(address) {
  document.querySelectorAll('[data-solana-connect]').forEach((btn) => {
    if (address) {
      btn.textContent = `◎ ${shortAddress(address)}`;
      btn.classList.add('connected');
      btn.setAttribute('aria-label', `Solana wallet ${address}`);
    } else {
      btn.textContent = btn.dataset.defaultLabel || '◎ Connect Phantom';
      btn.classList.remove('connected');
    }
  });

  const statusEls = document.querySelectorAll('[data-solana-status]');
  statusEls.forEach((el) => {
    el.textContent = address ? `Phantom · ${shortAddress(address)}` : 'Not connected';
  });
}

async function connectPhantomWallet() {
  const provider = getSolanaProvider();
  if (!provider) {
    window.open('https://phantom.app/', '_blank', 'noopener');
    if (typeof showToast === 'function') {
      showToast('Install Phantom wallet, then click Connect again.');
    }
    return null;
  }

  try {
    const resp = await provider.connect();
    const address = resp.publicKey.toString();
    saveWalletLocal(address);
    updateConnectButtons(address);
    await syncWalletToApi(address);
    if (typeof showToast === 'function') {
      showToast(`Solana wallet connected · ${shortAddress(address)}`);
    }
    return address;
  } catch (err) {
    if (err?.code !== 4001 && typeof showToast === 'function') {
      showToast(err?.message || 'Phantom connection cancelled.');
    }
    return null;
  }
}

function initSolanaWallet() {
  document.body.classList.add('web3-active');

  document.querySelectorAll('[data-solana-connect]').forEach((btn) => {
    if (!btn.dataset.defaultLabel) {
      btn.dataset.defaultLabel = btn.textContent.trim() || '◎ Connect Phantom';
    }
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      connectPhantomWallet();
    });
  });

  const saved = loadSavedWallet();
  if (saved?.address) {
    updateConnectButtons(saved.address);
  }

  const provider = getSolanaProvider();
  if (provider) {
    provider.on?.('accountChanged', (pubkey) => {
      if (pubkey) {
        const address = pubkey.toString();
        saveWalletLocal(address);
        updateConnectButtons(address);
        syncWalletToApi(address);
      } else {
        localStorage.removeItem(SOLANA_STORAGE_KEY);
        updateConnectButtons(null);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initSolanaWallet);

export const CHECKOUT_STYLES = `
:root {
  --pbn-bg: #0a1118;
  --pbn-bg-raised: #101a24;
  --pbn-surface: #152230;
  --pbn-border: #1e3247;
  --pbn-border-strong: #2d4a68;
  --pbn-text: #e8eef4;
  --pbn-text-muted: #8ca0b4;
  --pbn-accent: #4fd1c5;
  --pbn-accent-hover: #38b2ac;
  --pbn-on-accent: #0a1118;
  --pbn-success: #10b981;
  --pbn-warning: #f59e0b;
  --pbn-error: #ef4444;
  --pbn-font-ui: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --pbn-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.pbn-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(5, 10, 16, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  font-family: var(--pbn-font-ui);
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.pbn-modal-overlay.pbn-visible {
  opacity: 1;
}

.pbn-modal-card {
  background: var(--pbn-bg-raised);
  border: 1px solid var(--pbn-border);
  border-radius: 1rem;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform: scale(0.95);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  color: var(--pbn-text);
}

.pbn-modal-overlay.pbn-visible .pbn-modal-card {
  transform: scale(1);
}

.pbn-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--pbn-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--pbn-surface);
}

.pbn-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pbn-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--pbn-text);
  letter-spacing: -0.01em;
}

.pbn-subtitle {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--pbn-text-muted);
}

.pbn-close-btn {
  background: transparent;
  border: none;
  color: var(--pbn-text-muted);
  cursor: pointer;
  padding: 0.375rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.pbn-close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--pbn-text);
}

.pbn-zk-banner {
  background: rgba(79, 209, 197, 0.08);
  border-bottom: 1px solid rgba(79, 209, 197, 0.2);
  padding: 0.625rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
}

.pbn-zk-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 600;
  color: var(--pbn-accent);
}

.pbn-zk-pill {
  font-family: var(--pbn-font-mono);
  background: rgba(79, 209, 197, 0.15);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(79, 209, 197, 0.3);
}

.pbn-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pbn-amount-card {
  background: var(--pbn-surface);
  border: 1px solid var(--pbn-border);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pbn-amount-val {
  font-family: var(--pbn-font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--pbn-accent);
}

.pbn-amount-alt {
  font-size: 0.8125rem;
  color: var(--pbn-text-muted);
  font-family: var(--pbn-font-mono);
}

.pbn-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  background: var(--pbn-bg);
  padding: 0.25rem;
  border-radius: 0.625rem;
  border: 1px solid var(--pbn-border);
}

.pbn-tab {
  background: transparent;
  border: none;
  padding: 0.5rem 0.25rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--pbn-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.pbn-tab.pbn-tab-active {
  background: var(--pbn-surface);
  color: var(--pbn-accent);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.pbn-tab-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.pbn-qr-box {
  background: #ffffff;
  padding: 0.75rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  display: inline-flex;
}

.pbn-details-box {
  width: 100%;
  background: var(--pbn-surface);
  border: 1px solid var(--pbn-border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
  font-size: 0.8125rem;
}

.pbn-detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.pbn-mono-val {
  font-family: var(--pbn-font-mono);
  color: var(--pbn-text);
  font-size: 0.75rem;
}

.pbn-copy-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--pbn-border);
  border-radius: 0.25rem;
  color: var(--pbn-text-muted);
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.15s ease;
}

.pbn-copy-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--pbn-accent);
}

.pbn-primary-btn {
  width: 100%;
  background: var(--pbn-accent);
  color: var(--pbn-on-accent);
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-weight: 700;
  font-size: 0.9375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.15s ease;
}

.pbn-primary-btn:hover {
  background: var(--pbn-accent-hover);
}

.pbn-footer {
  padding: 0.875rem 1.5rem;
  background: var(--pbn-surface);
  border-top: 1px solid var(--pbn-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--pbn-text-muted);
}

.pbn-sharia-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #34d399;
}
`;

export function injectStyles(): void {
  const STYLE_ID = 'pabandi-checkout-sdk-styles';
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = CHECKOUT_STYLES;
  document.head.appendChild(styleEl);
}


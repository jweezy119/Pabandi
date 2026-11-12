import { CheckoutOptions, CheckoutRail, CheckoutSuccessEvent, ZkVerificationResult } from '../types';
import { injectStyles } from './styles';
import { generateSvgQrCode } from './qrCodeGenerator';
import { ZkVerifier } from './zkVerifier';

export class PabandiCheckout {
  private options: CheckoutOptions;
  private zkVerifier: ZkVerifier;
  private overlayEl: HTMLDivElement | null = null;
  private currentRail: CheckoutRail = 'solana';
  private zkResult: ZkVerificationResult | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: CheckoutOptions) {
    if (!options.publishableKey) {
      throw new Error('PabandiCheckout: publishableKey is required.');
    }
    if (!options.referenceId) {
      throw new Error('PabandiCheckout: referenceId is required.');
    }
    if (typeof options.amount !== 'number' || options.amount <= 0) {
      throw new Error('PabandiCheckout: amount must be a positive number.');
    }

    this.options = {
      currency: 'USDC',
      apiHost: options.apiHost || '',
      recipientWallet: options.recipientWallet || 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre',
      merchantRaastId: options.merchantRaastId || '03001234567',
      merchantIban: options.merchantIban || 'PK00PABN0000000000000000',
      verifyCounterpartyZK: options.verifyCounterpartyZK ?? true,
      ...options,
    };

    this.zkVerifier = new ZkVerifier(this.options.apiHost);
  }

  /**
   * Opens the checkout modal overlay.
   */
  async open(): Promise<void> {
    if (typeof document === 'undefined') return;

    injectStyles();

    // Perform ZK counterparty check if requested
    if (this.options.verifyCounterpartyZK) {
      this.zkResult = await this.zkVerifier.verify(this.options.counterparty);
    }

    this.render();
  }

  /**
   * Closes and removes the modal overlay from DOM.
   */
  close(): void {
    if (!this.overlayEl) return;

    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    this.overlayEl.classList.remove('pbn-visible');
    setTimeout(() => {
      this.overlayEl?.remove();
      this.overlayEl = null;
      this.options.onCancel?.();
    }, 200);
  }

  private render(): void {
    // Remove existing if open
    if (this.overlayEl) {
      this.overlayEl.remove();
    }

    const { amount, currency = 'USDC', title = 'Pabandi Escrow Deposit', subtitle, referenceId } = this.options;
    const isPkr = currency.toUpperCase() === 'PKR';
    const amountUsd = isPkr ? (amount / 280).toFixed(2) : amount.toFixed(2);
    const amountPkr = isPkr ? amount.toLocaleString() : Math.round(amount * 280).toLocaleString();

    const overlay = document.createElement('div');
    overlay.className = 'pbn-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pbn-modal-title');

    // Build ZK banner HTML
    const zkBannerHtml = this.options.verifyCounterpartyZK && this.zkResult?.isValid
      ? `
        <div class="pbn-zk-banner">
          <div class="pbn-zk-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>BBS+ ZK Verified Counterparty</span>
          </div>
          <span class="pbn-zk-pill">Trust ${this.zkResult.score} · Dispute <2%</span>
        </div>
      `
      : '';

    overlay.innerHTML = `
      <div class="pbn-modal-card" id="pbn-modal-container">
        <div class="pbn-header">
          <div class="pbn-title-group">
            <h3 class="pbn-title" id="pbn-modal-title">${escapeHtml(title)}</h3>
            <p class="pbn-subtitle">${escapeHtml(subtitle || `Reference: ${referenceId}`)}</p>
          </div>
          <button class="pbn-close-btn" id="pbn-btn-close" aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        ${zkBannerHtml}

        <div class="pbn-body">
          <div class="pbn-amount-card">
            <div>
              <span style="font-size: 0.75rem; color: var(--pbn-text-muted); text-transform: uppercase;">Total Escrow Amount</span>
              <div class="pbn-amount-val">$${amountUsd} <span style="font-size: 0.875rem;">USDC</span></div>
            </div>
            <div class="pbn-amount-alt">₨ ${amountPkr} PKR</div>
          </div>

          <div class="pbn-tabs" role="tablist">
            <button class="pbn-tab ${this.currentRail === 'solana' ? 'pbn-tab-active' : ''}" data-rail="solana" role="tab">
              <span>⚡ Solana USDC</span>
            </button>
            <button class="pbn-tab ${this.currentRail === 'raast' ? 'pbn-tab-active' : ''}" data-rail="raast" role="tab">
              <span>🇵🇰 SBP Raast</span>
            </button>
            <button class="pbn-tab ${this.currentRail === 'card' ? 'pbn-tab-active' : ''}" data-rail="card" role="tab">
              <span>💳 Credit Card</span>
            </button>
          </div>

          <div id="pbn-rail-container">
            ${this.getRailContentHtml(this.currentRail)}
          </div>
        </div>

        <div class="pbn-footer">
          <span class="pbn-sharia-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            AAOIFI Sharia Certified Escrow
          </span>
          <span>Zero-Knowledge Protected</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlayEl = overlay;

    // Trigger entrance transition
    requestAnimationFrame(() => {
      overlay.classList.add('pbn-visible');
    });

    this.attachEventListeners(overlay);
  }

  private getRailContentHtml(rail: CheckoutRail): string {
    const { amount, recipientWallet, merchantRaastId, merchantIban, referenceId } = this.options;
    const amountUsd = Number(amount).toFixed(2);
    const amountPkr = Math.round(Number(amount) * 280).toLocaleString();

    if (rail === 'solana') {
      const solanaUri = `solana:${recipientWallet}?amount=${amountUsd}&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=PabandiEscrow&message=${encodeURIComponent(
        referenceId
      )}`;
      const qrSvg = generateSvgQrCode(solanaUri, 150);

      return `
        <div class="pbn-tab-content">
          <div class="pbn-qr-box">${qrSvg}</div>
          <div class="pbn-details-box">
            <div class="pbn-detail-row">
              <span style="color: var(--pbn-text-muted);">Network:</span>
              <span class="pbn-mono-val">Solana Mainnet (USDC)</span>
            </div>
            <div class="pbn-detail-row">
              <span style="color: var(--pbn-text-muted);">Escrow Vault:</span>
              <div style="display: flex; align-items: center; gap: 0.25rem;">
                <span class="pbn-mono-val">${shortenAddress(recipientWallet!)}</span>
                <button class="pbn-copy-btn" data-copy="${recipientWallet}">Copy</button>
              </div>
            </div>
          </div>
          <button class="pbn-primary-btn" id="pbn-action-btn">
            Confirm USDC Escrow Lock
          </button>
        </div>
      `;
    }

    if (rail === 'raast') {
      const raastPayload = `raast:${merchantRaastId}?amount=${amountPkr}&ref=${encodeURIComponent(referenceId)}`;
      const qrSvg = generateSvgQrCode(raastPayload, 150);

      return `
        <div class="pbn-tab-content">
          <div class="pbn-qr-box">${qrSvg}</div>
          <div class="pbn-details-box">
            <div class="pbn-detail-row">
              <span style="color: var(--pbn-text-muted);">Raast ID (Phone):</span>
              <div style="display: flex; align-items: center; gap: 0.25rem;">
                <span class="pbn-mono-val">${merchantRaastId}</span>
                <button class="pbn-copy-btn" data-copy="${merchantRaastId}">Copy</button>
              </div>
            </div>
            <div class="pbn-detail-row">
              <span style="color: var(--pbn-text-muted);">IBAN:</span>
              <div style="display: flex; align-items: center; gap: 0.25rem;">
                <span class="pbn-mono-val">${merchantIban}</span>
                <button class="pbn-copy-btn" data-copy="${merchantIban}">Copy</button>
              </div>
            </div>
          </div>
          <button class="pbn-primary-btn" id="pbn-action-btn">
            I Have Transferred via Raast
          </button>
        </div>
      `;
    }

    // Card payment
    return `
      <div class="pbn-tab-content">
        <div style="padding: 1.5rem 0; color: var(--pbn-text-muted); font-size: 0.875rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--pbn-accent)" stroke-width="1.5" style="margin: 0 auto 0.75rem;">
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
          <p style="margin: 0;">Instant credit / debit card processing backed by Square & Stripe.</p>
        </div>
        <button class="pbn-primary-btn" id="pbn-action-btn">
          Pay $${amountUsd} with Card
        </button>
      </div>
    `;
  }

  private attachEventListeners(overlay: HTMLDivElement): void {
    // Close button
    overlay.querySelector('#pbn-btn-close')?.addEventListener('click', () => this.close());

    // Click outside backdrop to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Keyboard navigation (ESC key)
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    // Tab buttons
    overlay.querySelectorAll<HTMLButtonElement>('.pbn-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const rail = tab.getAttribute('data-rail') as CheckoutRail;
        if (rail && rail !== this.currentRail) {
          this.currentRail = rail;
          this.updateRailView();
        }
      });
    });

    // Action button & copy buttons
    this.bindActionAndCopyButtons(overlay);
  }

  private updateRailView(): void {
    if (!this.overlayEl) return;

    // Update active tab styles
    this.overlayEl.querySelectorAll('.pbn-tab').forEach((tab) => {
      if (tab.getAttribute('data-rail') === this.currentRail) {
        tab.classList.add('pbn-tab-active');
      } else {
        tab.classList.remove('pbn-tab-active');
      }
    });

    // Update rail container HTML
    const container = this.overlayEl.querySelector('#pbn-rail-container');
    if (container) {
      container.innerHTML = this.getRailContentHtml(this.currentRail);
      this.bindActionAndCopyButtons(this.overlayEl);
    }
  }

  private bindActionAndCopyButtons(overlay: HTMLDivElement): void {
    // Copy buttons
    overlay.querySelectorAll<HTMLButtonElement>('.pbn-copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy');
        if (text) {
          try {
            await navigator.clipboard.writeText(text);
            const orig = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
              btn.textContent = orig;
            }, 1500);
          } catch {}
        }
      });
    });

    // Primary action button
    overlay.querySelector('#pbn-action-btn')?.addEventListener('click', () => {
      const successEvent: CheckoutSuccessEvent = {
        rail: this.currentRail,
        amount: this.options.amount,
        currency: this.options.currency || 'USDC',
        referenceId: this.options.referenceId,
        txHashOrRef: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        escrowStatus: 'LOCKED',
        zkVerified: this.zkResult?.isValid ?? false,
      };

      this.options.onSuccess?.(successEvent);
      this.close();
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}


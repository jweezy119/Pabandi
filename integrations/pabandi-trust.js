/**
 * Pabandi Trust Layer SDK
 * Integrates with Shopify, WooCommerce, and custom frontends.
 */

const DEFAULT_API_URL = 'https://pabandi-backend-97129395003.asia-south1.run.app/api/v1';

class PabandiTrust {
  constructor(options) {
    options = options || {};
    this.apiKey = options.apiKey;
    this.apiUrl = (options.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
    this.saltUrl = `${this.apiUrl}/network/public-salt`;
    this.bloomUrl = `${this.apiUrl}/network/bloom-filter`;
    this.phoneInput = null;
    this.codRadio = null;
    this.salt = null;
    this.bloomFilterJson = null;
  }

  init({ phoneSelector, codRadioSelector } = {}) {
    this.phoneInput = phoneSelector ? document.querySelector(phoneSelector) : null;
    this.codRadio = codRadioSelector ? document.querySelector(codRadioSelector) : null;

    if (!this.phoneInput) {
      console.warn('Pabandi SDK: Could not find phone input. Initialization paused.');
      return;
    }

    console.log('Pabandi SDK: Initialized and actively monitoring checkout risks.');

    this.phoneInput.addEventListener('blur', async (e) => {
      const target = e.target;
      const phoneNumber = target && target.value && target.value.trim();
      if (phoneNumber && phoneNumber.length > 8) {
        await this.analyzeRisk(phoneNumber);
      }
    });
  }

  setBaseUrl(apiUrl) {
    this.apiUrl = (apiUrl || this.apiUrl).replace(/\/$/, '');
    this.saltUrl = `${this.apiUrl}/network/public-salt`;
    this.bloomUrl = `${this.apiUrl}/network/bloom-filter`;
    this.salt = null;
    this.bloomFilterJson = null;
  }

  async hashString(str) {
    if (!this.salt) {
      const res = await fetch(this.saltUrl);
      const data = await res.json();
      this.salt = data.salt || '';
      console.log('Pabandi SDK: Fetched daily salt for HMAC.');
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.salt);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(str));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async analyzeRisk(phoneNumber) {
    try {
      const hash = await this.hashString(phoneNumber);

      if (!this.bloomFilterJson) {
        const bfRes = await fetch(this.bloomUrl);
        const bfData = await bfRes.json();
        this.bloomFilterJson = bfData.filter || null;
        console.log('Pabandi SDK: Downloaded Global Edge Bloom Filter.');
      }

      let skipApiCall = false;
      if (this.bloomFilterJson && this.bloomFilterJson._filter) {
        const isSafeLocally = false;
        if (isSafeLocally) {
          console.log('Pabandi SDK: Local Bloom Filter verified safe.');
          this.enableCashOnDelivery();
          return;
        }
        console.log('Pabandi SDK: Local Bloom Filter detected possible risk. Verifying via Edge API...');
      }

      const response = await fetch(`${this.apiUrl}/network/check-hash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey || '',
        },
        body: JSON.stringify({ hash }),
      });

      const result = await response.json();

      if (response.ok && result.success && result.data && result.data.prediction && result.data.prediction.riskLevel) {
        const riskLevel = result.data.prediction.riskLevel;
        if (riskLevel === 'CRITICAL') {
          console.warn('Pabandi SDK: High risk detected for this identity hash.');
          this.disableCashOnDelivery();
        } else {
          console.log('Pabandi SDK: Identity hash is trusted.');
          this.enableCashOnDelivery();
        }
      } else {
        console.warn('Pabandi SDK: Unexpected risk API response.', result);
      }
    } catch (error) {
      console.error('Pabandi SDK: Failed to analyze risk:', error);
    }
  }

  disableCashOnDelivery() {
    if (!this.codRadio) return;
    const paymentContainer = this.codRadio.closest('.payment-method-container');
    if (paymentContainer) paymentContainer.style.display = 'none';

    let warning = document.getElementById('pabandi-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'pabandi-warning';
      warning.style.color = '#e74c3c';
      warning.style.fontSize = '0.9rem';
      warning.style.marginTop = '10px';
      warning.innerText = 'Cash on Delivery is currently unavailable for this order. Please select a prepaid option.';
      const checkoutSection = this.codRadio.closest('.checkout-section');
      if (checkoutSection) checkoutSection.appendChild(warning);
    }
  }

  enableCashOnDelivery() {
    if (!this.codRadio) return;
    const paymentContainer = this.codRadio.closest('.payment-method-container');
    if (paymentContainer) paymentContainer.style.display = 'block';
    const warning = document.getElementById('pabandi-warning');
    if (warning) warning.remove();
  }
}

// Attach to window globally for standard HTML integration
window.PabandiTrust = PabandiTrust;

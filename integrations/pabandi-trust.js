/**
 * Pabandi Trust Layer SDK
 * Integrates with Shopify, WooCommerce, and custom frontends.
 */

class PabandiTrust {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiUrl = 'http://localhost:5000/api/v1/network/check-hash'; // Replace with production URL
    this.saltUrl = 'http://localhost:5000/api/v1/network/public-salt';
    this.isInitialized = false;
    this.salt = null;
  }

  /**
   * Initializes the SDK. Looks for phone inputs and COD radio buttons.
   */
  init({ phoneSelector, codRadioSelector }) {
    this.phoneInput = document.querySelector(phoneSelector);
    this.codRadio = document.querySelector(codRadioSelector);
    
    if (!this.phoneInput) {
      console.warn("Pabandi SDK: Could not find phone input. Initialization paused.");
      return;
    }

    this.isInitialized = true;
    console.log("Pabandi SDK: Initialized and actively monitoring checkout risks.");

    // Listen to changes on the phone number
    this.phoneInput.addEventListener('blur', async (e) => {
      const phoneNumber = e.target.value.trim();
      if (phoneNumber.length > 8) {
        await this.analyzeRisk(phoneNumber);
      }
    });
  }

  /**
   * Securely hashes a string locally (HMAC-SHA256).
   * Ensures raw PII NEVER leaves the browser and protects against rainbow tables.
   */
  async hashString(str) {
    if (!this.salt) {
      const res = await fetch(this.saltUrl);
      const data = await res.json();
      this.salt = data.salt;
      console.log("Pabandi SDK: Fetched daily salt for HMAC.");
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const keyData = encoder.encode(this.salt);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Pings the Zero-Knowledge API and updates the UI based on the response.
   */
  async analyzeRisk(phoneNumber) {
    try {
      const hash = await this.hashString(phoneNumber);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({ hash })
      });

      const result = await response.json();

      if (result.success && result.data.prediction) {
        const { riskLevel } = result.data.prediction;
        
        if (riskLevel === 'CRITICAL') {
          console.warn("Pabandi SDK: High risk detected for this identity hash.");
          this.disableCashOnDelivery();
        } else {
          console.log("Pabandi SDK: Identity hash is trusted.");
          this.enableCashOnDelivery();
        }
      }
    } catch (error) {
      console.error("Pabandi SDK: Failed to analyze risk:", error);
    }
  }

  disableCashOnDelivery() {
    if (this.codRadio) {
      // Hide the entire container of the COD option (depends on theme markup)
      this.codRadio.closest('.payment-method-container').style.display = 'none';
      
      // Optionally inject a notification
      let warning = document.getElementById('pabandi-warning');
      if (!warning) {
        warning = document.createElement('div');
        warning.id = 'pabandi-warning';
        warning.style.color = '#e74c3c';
        warning.style.fontSize = '0.9rem';
        warning.style.marginTop = '10px';
        warning.innerText = "Cash on Delivery is currently unavailable for this order. Please select a prepaid option.";
        this.codRadio.closest('.checkout-section').appendChild(warning);
      }
    }
  }

  enableCashOnDelivery() {
    if (this.codRadio) {
      this.codRadio.closest('.payment-method-container').style.display = 'block';
      const warning = document.getElementById('pabandi-warning');
      if (warning) warning.remove();
    }
  }
}

// Attach to window globally for standard HTML integration
window.PabandiTrust = PabandiTrust;

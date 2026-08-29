(function() {
  const API_BASE = 'https://pabandi-backend-97129395003.asia-south1.run.app/api/v1';
  const UNIVERSAL_CHECKOUT = `${API_BASE}/checkout/embed-checkout`;

  const style = document.createElement('style');
  style.innerHTML = `
    .pabandi-escrow-container {
      margin-top: 15px;
      padding: 15px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      text-align: center;
    }
    .pabandi-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #10b981;
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .pabandi-btn {
      width: 100%;
      padding: 14px 20px;
      background-color: #0f172a;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s;
    }
    .pabandi-btn:hover {
      background-color: #1e293b;
    }
    .pabandi-btn:disabled {
      background-color: #94a3b8;
      cursor: not-allowed;
    }
    .pabandi-loader {
      width: 16px;
      height: 16px;
      border: 2px solid #ffffff;
      border-bottom-color: transparent;
      border-radius: 50%;
      display: inline-block;
      box-sizing: border-box;
      animation: pabandi-rotation 1s linear infinite;
    }
    @keyframes pabandi-rotation {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = busy;
    btn.innerHTML = busy
      ? '<span class="pabandi-loader"></span> Processing...'
      : '<span>Checkout via Escrow</span>';
  }

  async function initPabandiWidget() {
    const container = document.getElementById('pabandi-trust-badge');
    if (!container) return;

    const shopDomain = container.getAttribute('data-shop');
    const sellerId = container.getAttribute('data-seller-id');
    const amount = container.getAttribute('data-amount');

    if (!shopDomain && !sellerId) {
      console.error('Pabandi Widget: Missing data-shop or data-seller-id.');
      return;
    }

    container.innerHTML = `
      <div class="pabandi-escrow-container">
        <div class="pabandi-badge">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          Pabandi Trust Protocol Verified
        </div>
        <p id="pabandi-widget-status" style="font-size: 13px; color: #475569; margin: 0 0 12px 0;">Your funds are held securely in escrow until you confirm delivery.</p>
        <button id="pabandi-escrow-checkout" class="pabandi-btn">
          <span>Checkout via Escrow</span>
        </button>
      </div>
    `;

    const btn = document.getElementById('pabandi-escrow-checkout');
    const status = document.getElementById('pabandi-widget-status');

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      setBusy(btn, true);
      if (status) status.textContent = 'Preparing escrow checkout...';

      try {
        let checkoutUrl = null;

        if (shopDomain) {
          const cartResponse = await fetch('/cart.js');
          const cartSource = cartResponse.ok ? await cartResponse.json() : null;
          if (cartSource && cartSource.item_count === 0) {
            if (status) status.textContent = 'Your cart is empty.';
            setBusy(btn, false);
            return;
          }

          const shopPayload = {
            shopUrl: shopDomain,
            cartData: cartSource || {},
            sellerId,
            amount,
          };

          const shopRes = await fetch(`${API_BASE}/shopify-integration/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shopPayload),
          });

          const shopData = await shopRes.json();
          if (shopData.error) throw new Error(shopData.error);
          checkoutUrl = shopData.checkoutUrl;
        }

        if (!checkoutUrl) {
          if (!sellerId || !amount) {
            throw new Error('Missing seller checkout details.');
          }

          const universalRes = await fetch(UNIVERSAL_CHECKOUT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId: sellerId,
              amount,
              source: shopDomain ? 'SHOPIFY' : 'UNIVERSAL',
              successUrl: window.location.href,
              cancelUrl: window.location.href,
            }),
          });

          const universalData = await universalRes.json();
          if (universalData.error) throw new Error(universalData.error);
          checkoutUrl = universalData.data?.checkoutUrl;
        }

        if (!checkoutUrl) throw new Error('Invalid checkout response from Pabandi.');
        window.location.href = checkoutUrl;
      } catch (err) {
        console.error('Pabandi Escrow Checkout Error:', err);
        if (status) status.textContent = 'Checkout failed: ' + err.message;
        setBusy(btn, false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPabandiWidget);
  } else {
    initPabandiWidget();
  }
})();

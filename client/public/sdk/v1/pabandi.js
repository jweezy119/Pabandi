/**
 * Pabandi Universal Drop-in Checkout SDK v1.0.0
 * The open payment element for Cards, SBP Raast, JazzCash, and Solana USDC.
 * (c) 2026 Pabandi. All rights reserved.
 */

(function (window, document) {
  'use strict';

  var PABANDI_API = window.PABANDI_API_HOST || 'https://pabandi.onrender.com';
  var PABANDI_HOST = window.PABANDI_CLIENT_HOST || 'https://pabandi.com';

  function PabandiCheckout(config) {
    if (!config) throw new Error('PabandiCheckout: Configuration object required.');
    this.config = Object.assign({
      elementId: null,
      amount: 100,
      currency: 'USD',
      reference: 'ref_' + Date.now(),
      theme: 'dark', // 'dark' | 'light'
      requireSharia: true,
      preferredRail: 'auto',
      onSuccess: function () {},
      onError: function () {},
      onClose: function () {},
    }, config);

    this.container = null;
    this.iframe = null;
  }

  PabandiCheckout.prototype.mount = function (targetElementId) {
    var elemId = targetElementId || this.config.elementId;
    var target = typeof elemId === 'string' ? document.getElementById(elemId) : elemId;

    if (!target) {
      console.error('PabandiCheckout: Target element not found:', elemId);
      return;
    }

    this.container = target;
    this.container.innerHTML = '';

    // Create responsive container
    var wrapper = document.createElement('div');
    wrapper.className = 'pabandi-checkout-frame-wrapper';
    wrapper.style.cssText = 'width:100%;max-width:500px;min-height:560px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.3);background:#101a24;border:1px solid rgba(255,255,255,0.1);font-family:system-ui,-apple-system,sans-serif;';

    // Construct checkout URL
    var queryParams = [
      'amount=' + encodeURIComponent(this.config.amount),
      'currency=' + encodeURIComponent(this.config.currency),
      'ref=' + encodeURIComponent(this.config.reference),
      'theme=' + encodeURIComponent(this.config.theme),
      'sharia=' + (this.config.requireSharia ? '1' : '0'),
      'rail=' + encodeURIComponent(this.config.preferredRail),
      'embed=1'
    ].join('&');

    var checkoutUrl = PABANDI_HOST + '/pay/' + encodeURIComponent(this.config.reference) + '?' + queryParams;

    var iframe = document.createElement('iframe');
    iframe.src = checkoutUrl;
    iframe.style.cssText = 'width:100%;height:600px;border:none;display:block;';
    iframe.setAttribute('allow', 'payment; clipboard-write; web-share');
    iframe.setAttribute('title', 'Pabandi Universal Secure Checkout');

    wrapper.appendChild(iframe);
    this.container.appendChild(wrapper);
    this.iframe = iframe;

    var self = this;
    // Cross-window postMessage listener for status updates
    window.addEventListener('message', function (e) {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.source === 'pabandi-checkout') {
        if (e.data.type === 'PAYMENT_SUCCEEDED') {
          self.config.onSuccess(e.data.payload);
        } else if (e.data.type === 'PAYMENT_FAILED') {
          self.config.onError(e.data.payload);
        }
      }
    });

    return this;
  };

  PabandiCheckout.prototype.openModal = function () {
    var modalOverlay = document.createElement('div');
    modalOverlay.id = 'pabandi-modal-overlay';
    modalOverlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';

    var modalBox = document.createElement('div');
    modalBox.style.cssText = 'position:relative;width:100%;max-width:480px;border-radius:20px;overflow:hidden;animation:pabandiModalIn 0.2s ease-out;';

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:14px;z-index:10;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:14px;width:30px;height:30px;border-radius:50%;cursor:pointer;';
    
    var self = this;
    closeBtn.onclick = function () {
      document.body.removeChild(modalOverlay);
      self.config.onClose();
    };

    modalBox.appendChild(closeBtn);
    modalOverlay.appendChild(modalBox);
    document.body.appendChild(modalOverlay);

    this.mount(modalBox);
  };

  // Auto-bind declarative HTML attributes: <button data-pabandi-pay data-amount="100">
  document.addEventListener('DOMContentLoaded', function () {
    var triggers = document.querySelectorAll('[data-pabandi-pay]');
    triggers.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var amount = parseFloat(btn.getAttribute('data-amount')) || 100;
        var currency = btn.getAttribute('data-currency') || 'USD';
        var ref = btn.getAttribute('data-ref') || 'btn_' + Date.now();
        var checkout = new PabandiCheckout({
          amount: amount,
          currency: currency,
          reference: ref
        });
        checkout.openModal();
      });
    });
  });

  window.PabandiCheckout = PabandiCheckout;
})(window, document);


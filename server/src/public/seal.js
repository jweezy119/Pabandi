/**
 * Pabandi Trust Seal - Embeddable SDK
 * Lightweight script to render the PTP trust badge on third-party websites.
 */
(function() {
  function initPabandiSeal() {
    const container = document.getElementById('pabandi-trust-seal');
    if (!container) return;

    const sealId = container.getAttribute('data-seal-id');
    if (!sealId) {
      console.error('[PTP] Missing data-seal-id attribute on #pabandi-trust-seal');
      return;
    }

    // Prevent double rendering
    if (container.hasAttribute('data-ptp-rendered')) return;
    container.setAttribute('data-ptp-rendered', 'true');

    // In a real production deployment, this would point to api.pabandi.com
    // Use relative path or a configurable base URL for local testing
    let baseUrl = 'http://localhost:5000/api/v1';
    
    // Check if script tag has a data-api-url attribute
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].src.includes('seal.js') && scripts[i].getAttribute('data-api-url')) {
        baseUrl = scripts[i].getAttribute('data-api-url')!;
      }
    }

    const apiUrl = `${baseUrl}/seal/${sealId}/render?format=json`;

    // Fetch the seal HTML
    fetch(apiUrl)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(res => {
        if (res.success && res.html) {
          container.innerHTML = res.html;
          
          // Optional: intercept clicks to open in a popup or new tab explicitly
          const link = container.querySelector('a');
          if (link) {
            link.addEventListener('click', (e) => {
              // Custom click handling if needed
              // e.preventDefault();
              // window.open(link.href, 'ptp_verify', 'width=600,height=800');
            });
          }
        } else {
          // Render a fallback or nothing
          console.warn('[PTP] Seal could not be rendered:', res.error);
        }
      })
      .catch(error => {
        console.error('[PTP] Error loading trust seal:', error);
      });
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPabandiSeal);
  } else {
    initPabandiSeal();
  }
})();

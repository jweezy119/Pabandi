/**
 * Optional Pabandi embed configuration override.
 *
 * Usage: include this script before the embed/checkout script and set
 * `window.PABANDI_API_BASE` to your preferred Pabandi API root, e.g.:
 *   <script>
 *     window.PABANDI_API_BASE = 'https://api.mirror.example.com/api/v1';
 *   </script>
 *   <script src="pabandi-trust-embed.js"></script>
 */

if (!window.PABANDI_API_BASE) {
  window.PABANDI_API_BASE = location.origin === 'http://localhost:8081'
    ? 'http://localhost:5000/api/v1'
    : 'https://pabandi-backend-97129395003.asia-south1.run.app/api/v1';
}

window.PabandiEmbedConfig = {
  getApiBase() {
    return String(window.PABANDI_API_BASE).replace(/\/$/, '');
  },
  setApiBase(baseUrl) {
    window.PABANDI_API_BASE = String(baseUrl || '').replace(/\/$/, '');
    if (window.PabandiTrust && typeof window.PabandiTrust.prototype?.setBaseUrl === 'function') {
      window.PabandiTrust.prototype.setBaseUrl(window.PABANDI_API_BASE);
    }
  }
};

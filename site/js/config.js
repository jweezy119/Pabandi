/**
 * Production config for https://pabandi-42c5b.web.app
 * OAuth callbacks must use FRONTEND_URL=https://pabandi-42c5b.web.app/app on Cloud Run.
 */
(function () {
  const isLocal =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  window.PABANDI_CONFIG = {
    API_BASE_URL: isLocal ? 'http://localhost:5000' : 'https://pabandi-server-el.a.run.app',
    API_VERSION: 'v1',
    APP_PATH: '/app',
    SITE_URL: isLocal ? 'http://localhost:5500' : 'https://pabandi-42c5b.web.app',
  };
})();

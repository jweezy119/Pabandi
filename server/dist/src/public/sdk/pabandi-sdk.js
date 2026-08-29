/**
 * pabandi-sdk.js — Pabandi Agent SDK for external apps.
 *
 * Drop-in JS client for consuming Pabandi from any web app:
 *
 *   <script src="https://pabandi.onrender.com/sdk/pabandi-sdk.js"></script>
 *   <script>
 *     const pabandi = new PabandiSDK({ appId: 'your-app-id' });
 *     pabandi.search('salon').then(console.log);
 *   </script>
 *
 * No build step required. Works in browser + Node.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PabandiSDK = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_BASE = 'https://pabandi.onrender.com';

  class PabandiSDK {
    constructor(opts = {}) {
      this.base = (opts.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
      this.appId = opts.appId || null;
      this.bearer = opts.bearer || null;
      this.token = opts.token || null;
    }

    setBearer(token) {
      this.bearer = token;
    }

    setToken(token) {
      this.token = token;
    }

    async _call(path, body = {}, method = 'POST') {
      const headers = { 'Content-Type': 'application/json' };
      if (this.bearer) headers['Authorization'] = `Bearer ${this.bearer}`;
      if (this.token && !this.bearer) headers['X-Pabandi-Token'] = this.token;

      const resp = await fetch(`${this.base}${path}`, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: resp.status, ok: resp.ok, data };
    }

    // ── Discovery ─────────────────────────────────────────────────────────
    async discover() {
      return this._call('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'pabandi_discover_platform', arguments: {} } }, 'POST');
    }

    async listTools() {
      return this._call('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, 'POST');
    }

    // ── Search ───────────────────────────────────────────────────────────
    async search(query, opts = {}) {
      const qs = new URLSearchParams({ ...opts, q: query });
      return this._call(`/api/v1/businesses?${qs.toString()}`, {}, 'GET');
    }

    // ── App integration ──────────────────────────────────────────────────
    async connectApp({ appName, scopes = [], webhookUrl, redirectUrl }) {
      return this._call('/api/v1/apps/connect', { appName, scopes, webhookUrl, redirectUrl });
    }

    async getAppConfig(appId) {
      const resp = await fetch(`${this.base}/api/v1/apps/${encodeURIComponent(appId || this.appId)}/config`, {
        headers: this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {},
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: resp.status, ok: resp.ok, data };
    }

    async invoke(toolName, args = {}) {
      return this._call('/api/v1/agents/invoke', { toolName, args });
    }

    async verifyPassport(token, need) {
      return this._call('/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'pabandi_verify_passport', arguments: { token, need } } }, 'POST');
    }

    // ── Trust ───────────────────────────────────────────────────────────
    async getTrustProfile(userId) {
      const resp = await fetch(`${this.base}/api/v1/trust/public/${encodeURIComponent(userId)}`);
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: resp.status, ok: resp.ok, data };
    }

    // ── Widget embed helper ──────────────────────────────────────────────
    embedWidget(containerId, opts = {}) {
      const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      if (!container) return;
      const url = `${this.base}/sdk/widget.html?appId=${encodeURIComponent(this.appId || '')}&mode=${encodeURIComponent(opts.mode || 'search')}&theme=${encodeURIComponent(opts.theme || 'light')}`;
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.cssText = 'width:100%;height:420px;border:none;border-radius:12px;';
      container.innerHTML = '';
      container.appendChild(iframe);
    }
  }

  return PabandiSDK;
});

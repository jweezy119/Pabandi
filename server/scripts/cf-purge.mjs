// Post-deploy Cloudflare cache purge for the pabandi.com zone.
// Runs after `prisma migrate deploy`. Safe no-op if env vars are absent.
// Supports two auth styles:
//   1. Scoped API token:   CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ZONE_ID)
//   2. Global API key:      CLOUDFLARE_API_TOKEN=cfk_... + CLOUDFLARE_EMAIL (+ CLOUDFLARE_ZONE_ID)
import { execSync } from 'node:child_process';

const ZONE = process.env.CLOUDFLARE_ZONE_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const EMAIL = process.env.CLOUDFLARE_EMAIL;

if (!ZONE || !TOKEN) {
  console.log('[cf-purge] CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN not set — skipping cache purge.');
  process.exit(0);
}

const headers = { 'Content-Type': 'application/json' };
if (TOKEN.startsWith('cfk_') && EMAIL) {
  headers['X-Auth-Email'] = EMAIL;
  headers['X-Auth-Key'] = TOKEN;
} else {
  headers['Authorization'] = `Bearer ${TOKEN}`;
}

const url = `https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`;
try {
  const out = execSync(
    `curl -s -o /dev/null -w "%{http_code}" -X POST ` +
      `-H 'Content-Type: application/json' ` +
      `-H 'Authorization: Bearer ${TOKEN.startsWith('cfk_') && EMAIL ? '' : TOKEN}' ` +
      (TOKEN.startsWith('cfk_') && EMAIL ? `-H 'X-Auth-Email: ${EMAIL}' -H 'X-Auth-Key: ${TOKEN}' ` : '') +
      `-d '{"purge_everything":true}' "${url}"`,
    { encoding: 'utf8' }
  ).trim();
  if (out === '200') {
    console.log('[cf-purge] ✅ pabandi.com cache purged (deploy will be visible instantly).');
  } else {
    console.warn(`[cf-purge] ⚠️ purge returned HTTP ${out} (token may lack Cache Purge permission). Continuing.`);
  }
} catch (e) {
  console.warn('[cf-purge] ⚠️ purge failed:', e.message, '— continuing deploy.');
}

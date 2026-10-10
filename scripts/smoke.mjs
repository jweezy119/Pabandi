#!/usr/bin/env node
/**
 * Production smoke test.
 *
 * WHY THIS EXISTS
 * ---------------
 * Six defects shipped and passed every check this project had. Five were found by a
 * person — either the customer, or by reading code. None was caught by anything
 * that ran on its own. /health returned `ok` while six features were broken,
 * including a 500 on /api/v1/crypto/wallet and an email flow that had never
 * worked.
 *
 * The specific failure that made this worth writing: the guard fix was deployed,
 * verified in /health, and confirmed in the deployed Render bundle — while the
 * customer's site was served from an entirely different host (Firebase) that had
 * not been deployed in two days. Every verification was correct and all of them
 * were about the wrong artifact.
 *
 * So this does two things a /health endpoint cannot:
 *   1. Checks the DEPLOYED ARTIFACT, not the deploy's own opinion of itself. A
 *      bundle is fetched and grepped for the code we believe is live.
 *   2. Checks customer entry points and provider reachability, and says which
 *      host each belongs to.
 *   3. Proves the SPA actually STARTS, in a real browser.
 *
 * WHY THE THIRD ONE
 * -----------------
 * On 2026-10-10 the whole site stopped working and every check in this file
 * passed. React never mounted on any page — pabandi.com served a document with
 * an empty <div id="root"> — because the entry chunk statically imported a
 * 290 KB chunk of solana, leaflet and qrcode that throws
 *
 *     Uncaught TypeError: Cannot read properties of undefined (reading 'Buffer')
 *
 * while evaluating. A module that throws during evaluation fails the entire
 * module graph, so the entry never ran. Every page returned 200, every chunk was
 * fetchable, the shell referenced a bundle that existed, and the build was
 * green. The customer reported it as "clicking anything just goes back to
 * pabandi.com", because with no JavaScript a click does nothing and the browser
 * keeps showing the page it already had.
 *
 * Nothing here could have caught that, because nothing here executed a single
 * line of the client. HTTP 200 says a document was served; it says nothing about
 * whether the app in it ran.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * -------------------------------
 * It does not mutate anything, and it does not require credentials. Every check is
 * safe to run against production at any time. Checks that need auth are reported
 * as SKIPPED rather than silently passing, because a check that cannot run must
 * never look like a check that passed.
 *
 * EXIT CODES: 0 = all pass, 1 = a failure, 2 = the target itself is unreachable.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const TARGETS = {
  // The site the customer actually uses.
  site: process.env.SMOKE_SITE_URL || 'https://pabandi.com',
  // The API. Distinct origin, distinct deploy pipeline.
  api: process.env.SMOKE_API_URL || 'https://pabandi.onrender.com',
};

const EXPECTED_COMMIT = process.env.EXPECTED_COMMIT || process.argv[2] || null;
// Set when the commit under test cannot have changed the API. See the commitSha check.
const API_SHA_ADVISORY = process.env.SMOKE_API_SHA_ADVISORY === '1';

/** The marker that proves the CRM guard fix is in a bundle. If this changes, so
 *  does this check — it is deliberately coupled to a specific shipped fix. */
const CLIENT_FIX_MARKER = 'preferredMode)==="personal"?"personal":"business"';

const results = [];
const TIMEOUT_MS = 30_000;

function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'SKIP' ? '–' : '!';
  console.log(`  ${icon} ${name}${detail ? `  ${detail}` : ''}`);
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal, redirect: 'manual' });
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url) {
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not json; caller decides */ }
  return { res, body, text };
}

async function getText(url) {
  const res = await fetchWithTimeout(url);
  return { res, text: await res.text() };
}

async function section(title, fn) {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (err) {
    record(`${title} (unexpected error)`, 'FAIL', err instanceof Error ? err.message : String(err));
  }
}

// ── 1. The API is reachable and running the commit we think it is ──────────
async function waitForApi() {
  const maxRetries = 12; // 12 * 10s = 120s (2 minutes)
  for (let i = 0; i < maxRetries; i++) {
    const { res } = await getJson(`${TARGETS.api}/health`);
    if (res?.ok) return true;
    if (i < maxRetries - 1) {
      console.log(`  API returned ${res?.status || 'network error'}, retrying in 10s...`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
  return false;
}

async function checkApi() {
  const ready = await waitForApi();
  const { res, body } = await getJson(`${TARGETS.api}/health`);
  if (!ready || !res.ok) {
    record('GET /health', 'FAIL', `status ${res?.status || 'unreachable'}`);
    return;
  }
  record('GET /health', 'PASS', `status ${res.status}`);

  if (body?.status !== 'ok') {
    record('health.status', 'FAIL', String(body?.status));
  } else {
    record('health.status', 'PASS', 'ok');
  }

  const sha = body?.commitSha || null;
  if (!sha) {
    record('health.commitSha reported', 'WARN', 'absent — cannot detect a stale deploy');
  } else if (EXPECTED_COMMIT) {
    const matches = sha.startsWith(EXPECTED_COMMIT) || EXPECTED_COMMIT.startsWith(sha);
    // Advisory mode exists because the two deploy targets are independent and on
    // different cadences. deploy-site.yml only triggers on client/**, firebase.json,
    // .firebaserc, itself, and scripts/smoke.mjs — none of which is server code. So
    // the site publishing commit X while Render still serves X-1 is the NORMAL case,
    // not drift. Asserting equality there failed a green deploy on a CI-only commit.
    //
    // It stays a hard failure by default: when someone runs this against a commit that
    // did change the API, an out-of-step Render deploy is exactly the two-day drift
    // this script exists to catch.
    record(
      'health.commitSha matches expected',
      matches ? 'PASS' : API_SHA_ADVISORY ? 'WARN' : 'FAIL',
      matches
        ? sha.slice(0, 9)
        : `expected ${EXPECTED_COMMIT.slice(0, 9)}, got ${sha.slice(0, 9)}` +
          (API_SHA_ADVISORY ? ' (advisory: site and API deploy independently)' : ''),
    );
  } else {
    record('health.commitSha reported', 'PASS', `${sha.slice(0, 9)} (pass EXPECTED_COMMIT to assert)`);
  }
}

// ── 2. The SITE is a separate host and is actually deployed ────────────────
async function checkSite() {
  const { res, text } = await getText(`${TARGETS.site}/login`);
  if (!res.ok) {
    record('GET /login (site)', 'FAIL', `status ${res.status}`);
    return null;
  }
  record('GET /login (site)', 'PASS', `status ${res.status}`);

  // The cache header. A stale site is the failure this whole file exists for, and
  // it shows up here first: a cached shell names a bundle that is no longer live.
  const cache = res.headers.get('cache-control') || '(none)';
  const uncached = /no-store|no-cache/.test(cache);
  record(
    'site shell is not cached',
    uncached ? 'PASS' : 'FAIL',
    uncached ? cache : `${cache} — a cached shell pins an old bundle`,
  );

  const bundleMatch = text.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
  if (!bundleMatch) {
    record('site references a bundle', 'FAIL', 'no hashed bundle found in the shell');
    return null;
  }
  const bundlePath = bundleMatch[0];
  record('site references a bundle', 'PASS', bundlePath);

  const { res: bundleRes, text: bundle } = await getText(`${TARGETS.site}/${bundlePath}`);

  // Is the artifact the customer downloads actually built from the commit we think?
  //
  // A fix was shipped, verified present in this file, and a customer still hit the bug —
  // because their tab was running an older bundle. Nothing here could see that, and the
  // confusion was real: the console named a bundle hash the server no longer had.
  //
  // BUILD_SHA is compiled into every client bundle by vite.config.ts, so this compares
  // the shell, the bundle it references, and the commit both were built from. A mismatch
  // means the published artifact is not the one this pipeline built.
  if (EXPECTED_COMMIT && bundleRes.ok) {
    const shortSha = EXPECTED_COMMIT.slice(0, 7);
    const builtFrom = bundle.includes(shortSha);
    // STRICT only where the assertion is meaningful.
    //
    // deploy-site.yml runs on a `client/**` path filter, so when it triggers, the site
    // bundle MUST be from this commit. Everywhere else — a server-only commit, or an
    // ad-hoc local run — the bundle is legitimately from an earlier commit because no
    // client code changed, and failing there is a false alarm.
    //
    // The first version failed unconditionally and immediately went red on a server-only
    // commit. A check that cries wolf is worse than no check, because people learn to
    // ignore the colour.
    const strict = process.env.SMOKE_STRICT_BUNDLE === '1';
    record(
      'bundle was built from the expected commit',
      builtFrom ? 'PASS' : strict ? 'FAIL' : 'WARN',
      builtFrom
        ? shortSha
        : `${shortSha} not found in ${bundlePath} — this bundle is from a different commit` +
          (strict ? '' : ' (no client change in this commit, so this is expected)'),
    );
  }

  if (!bundleRes.ok) {
    // The exact symptom reported: the shell named a bundle the server does not
    // have. The customer is running a copy from their own cache.
    record('bundle is fetchable', 'FAIL', `${bundlePath} -> status ${bundleRes.status}`);
    return bundlePath;
  }
  record('bundle is fetchable', 'PASS', `${(bundle.length / 1024).toFixed(0)}kb`);

  return { bundlePath, bundle };
}

// ── 3. THE SPA MUST ACTUALLY START ───────────────────────────────────────
// The section this file was missing. Everything above and below is a property of
// documents and HTTP responses; this is the only part that runs client code, and
// it is the only part that could have caught the failure described in the header.
//
// WHY A BROWSER AND NOT A NODE IMPORT
// -----------------------------------
// The crash was in evaluation order, not syntax, so parsing would not have found
// it and a 404 would not have found it — every chunk was present and parseable.
// Importing the bundle in Node instead does not work either: these are browser
// bundles that touch `window` at module scope, so they fail in Node for reasons
// that have nothing to do with a real defect, which is the definition of a check
// that cannot fail meaningfully. A real browser is the only faithful test.
//
// GitHub's ubuntu runners ship Chrome; so does macOS. When none is installed the
// check SKIPS and says so loudly, because a check that cannot run must not look
// like a check that passed.

const BROWSER_CANDIDATES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
// How long Chrome gets to fast-forward before dumping. The app mounts within a
// second or two of the chunks arriving, so this is generous headroom for a cold
// CDN, not a race we expect to lose often.
const VIRTUAL_TIME_BUDGET_MS = 30_000;
const MOUNT_ATTEMPTS = 3;

/** React's mount point, with something rendered inside it. */
const MOUNTED = /<div id="root">\s*<[a-zA-Z]/;

async function resolveBrowser() {
  for (const bin of BROWSER_CANDIDATES) {
    // `--headless=new` is the current interface; older builds only accept the old
    // one. Both are tried so a runner on an aged image still gets a real check
    // rather than a silent SKIP.
    for (const headless of ['=new', '']) {
      try {
        await execFileAsync(bin, [`--headless${headless}`, '--no-sandbox', '--disable-gpu', '--dump-dom', 'about:blank'],
          { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
        return { bin, headless };
      } catch {
        /* not installed, or this headless spelling unsupported — try the next */
      }
    }
  }
  return null;
}

async function dumpDom(browser, url) {
  const { bin, headless } = browser;
  const { stdout } = await execFileAsync(
    bin,
    [
      `--headless${headless}`,
      '--no-sandbox',
      '--disable-gpu',
      // Containers have a small /dev/shm and Chrome crashes without this.
      '--disable-dev-shm-usage',
      // Deterministic: virtual time is spent only when there is work to do, so
      // this does not simply burn 30 seconds on a page that is already ready.
      `--virtual-time-budget=${VIRTUAL_TIME_BUDGET_MS}`,
      '--dump-dom',
      url,
    ],
    { timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
  );
  return stdout;
}

/**
 * Load the site in a real browser and require that React rendered something.
 *
 * Retried before it is allowed to fail: a cold CDN edge can hand back the shell
 * and then stall, which is not the same failure as the app never starting, and
 * colour that turns red on a slow network teaches people to ignore it.
 */
async function checkAppMounts() {
  const browser = await resolveBrowser();
  if (!browser) {
    record(
      'app mounts in a browser',
      'SKIP',
      'no Chrome/Chromium available — the SPA was NOT verified to start',
    );
    return;
  }

  for (const route of ['/', '/contact']) {
    const url = `${TARGETS.site}${route}`;
    let mounted = false;
    let lastDetail = '';

    for (let attempt = 1; attempt <= MOUNT_ATTEMPTS && !mounted; attempt++) {
      try {
        const html = await dumpDom(browser, url);
        mounted = MOUNTED.test(html);
        if (!mounted) {
          lastDetail = attempt === MOUNT_ATTEMPTS
            ? `#root is still empty after ${MOUNT_ATTEMPTS} attempts — React never mounted`
            : `#root empty on attempt ${attempt}, retrying`;
        }
      } catch (err) {
        lastDetail = `browser failed on attempt ${attempt}: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    record(
      `app mounts at ${route}`,
      mounted ? 'PASS' : 'FAIL',
      mounted ? `rendered by ${browser.bin}` : lastDetail,
    );
  }
}

// ── 4. LAZY-ONLY LIBRARIES MUST NOT BE IN THE EAGER GRAPH ────────────────
// A structural guard against the same regression, for runs with no browser. It
// cannot prove the app works, but it can prove the wallet and map libraries are
// not being downloaded by every visitor — which is what put the throwing chunk
// into the entry in the first place.
//
// The walk is over HTTP against the DEPLOYED bundle, matching the entry's own
// imports, for the same reason the rest of this file fetches rather than reasons:
// the artifact the customer downloads is the only thing that matters.

/** Code identifiers that exist only inside these libraries, deliberately not
 *  route strings — `"/crypto/wallet/solana"` appears in the entry legitimately. */
const LAZY_ONLY_MARKERS = ['LAMPORTS_PER_SOL', 'SystemProgram', 'leaflet-container'];

async function fetchText(url) {
  const res = await fetchWithTimeout(url);
  return { res, text: await res.text() };
}

async function eagerClosure() {
  const shell = await fetchText(TARGETS.site);
  const entry = shell.text.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
  if (!entry) return null;

  const cache = new Map();
  const read = async (path) => {
    if (!cache.has(path)) {
      const { res, text } = await fetchText(`${TARGETS.site}/${path}`);
      cache.set(path, res.ok ? text : '');
    }
    return cache.get(path);
  };

  const closure = new Set([entry[0]]);
  const stack = [entry[0]];
  while (stack.length) {
    const body = await read(stack.pop());
    for (const m of body.matchAll(/from"(\.\/[A-Za-z0-9_.-]+\.js)"|import"(\.\/[A-Za-z0-9_.-]+\.js)"/g)) {
      const dep = `assets/${(m[1] || m[2]).replace('./', '')}`;
      if (!closure.has(dep)) { closure.add(dep); stack.push(dep); }
    }
  }
  return { entry: entry[0], closure, cache };
}

async function checkEagerGraphStaysSmall() {
  let info;
  try {
    info = await eagerClosure();
  } catch (err) {
    record('eager graph is small', 'WARN', `could not walk imports: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  if (!info) {
    record('eager graph is small', 'SKIP', 'no hashed bundle in the shell to walk');
    return;
  }

  const { entry, closure, cache } = info;
  const bytes = [...closure].reduce((n, f) => n + (cache.get(f) || '').length, 0);
  record(
    'entry + its static imports',
    'PASS',
    `${(bytes / 1024).toFixed(0)}kb across ${closure.size} chunk(s): ${[...closure].map((f) => f.replace('assets/', '').replace(/\.[a-f0-9]{8,}\.js$/, '.js')).join(', ')}`,
  );

  const leaking = [...closure].filter((f) => LAZY_ONLY_MARKERS.some((m) => (cache.get(f) || '').includes(m)));
  record(
    'lazy-only libraries stay out of the eager graph',
    leaking.length === 0 ? 'PASS' : 'FAIL',
    leaking.length === 0
      ? 'wallet/map code is behind a dynamic import'
      : `${leaking.join(', ')} contain wallet/map code and are loaded on first paint`,
  );
}

// ── 6. The shipped fix is present in the bundle the site serves ───────────
async function checkBundleContainsFix(bundleInfo) {
  if (!bundleInfo) {
    record('shipped fix present in live bundle', 'SKIP', 'no bundle to inspect');
    return;
  }
  const { bundlePath, bundle } = bundleInfo;
  const present = bundle.includes(CLIENT_FIX_MARKER);
  record(
    'CRM guard fix present in live bundle',
    present ? 'PASS' : 'FAIL',
    present ? bundlePath : `${bundlePath} — the fix is NOT in what the customer is served`,
  );

  // The service worker is the other half of the stale-bundle failure: it kept
  // serving a precached bundle long after the deploy.
  const sw = await fetchWithTimeout(`${TARGETS.site}/sw.js`);
  const swIsHtml = (sw.headers.get('content-type') || '').includes('text/html');
  record(
    'no service worker intercepting',
    sw.status === 404 ? 'PASS' : swIsHtml ? 'FAIL' : 'WARN',
    sw.status === 404 ? '404 — no worker' : swIsHtml ? '/sw.js serves HTML' : `status ${sw.status}`,
  );
}

// ── 7. Customer entry points must not 500 ─────────────────────────────────
// A 500 on a page a customer opens is the loudest possible failure, and it is what
// /health was reporting `ok` alongside.
async function checkEntryPoints() {
  const checks = [
    ['GET /', TARGETS.site],
    ['GET /contact', TARGETS.site],
    ['GET /login', TARGETS.site],
    ['GET /dashboard', TARGETS.site],
    ['GET /api/v1/fees/schedule', TARGETS.api],
    ['GET /api/v1/tokenomics/summary', TARGETS.api],
    ['GET /api/v1/escrow/templates', TARGETS.api],
    ['GET /api/v1/subscriptions/pricing', TARGETS.api],
  ];

  for (const [label, url] of checks) {
    const res = await fetchWithTimeout(url, { headers: { Accept: '*/*' } });
    // 401 and 403 are CORRECT for protected routes — they mean the route exists
    // and the gate held. Only 5xx is a failure.
    const status = res.status;
    if (status >= 500) {
      record(label, 'FAIL', `status ${status}`);
    } else if (status === 404) {
      record(label, 'WARN', '404 — route may not exist');
    } else {
      record(label, 'PASS', `status ${status}`);
    }
  }
}

// ── 8. Route modules must LOAD, not just exist ───────────────────────────
// The lazy-route wrapper turns an import-time throw into a 500 with a `cause`. A
// missing env var took down six route modules this way and /health still said ok.
async function checkRouteModulesLoad() {
  const routes = [
    '/api/v1/crypto/wallet',
    '/api/v1/contacts',
    '/api/v1/crm/clients',
    '/api/v1/crm/dashboard',
  ];

  for (const route of routes) {
    const res = await fetchWithTimeout(`${TARGETS.api}${route}`, {
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();

    if (res.status >= 500) {
      const cause = (() => {
        try { return JSON.parse(text).cause || ''; } catch { return ''; }
      })();
      record(
        `${route} loads`,
        'FAIL',
        cause ? `status ${res.status}: ${cause}` : `status ${res.status}`,
      );
    } else {
      record(`${route} loads`, 'PASS', `status ${res.status}`);
    }
  }
}

// ── 9. Webhook endpoints must reject forged input ─────────────────────────
// These are public by design; the signature is the authentication. A 200 here
// would mean anyone can mint a paid subscription.
async function checkWebhooksRejectForgeries() {
  const endpoints = [
    ['Square', '/api/v1/square-checkout/webhook'],
    ['PayPal', '/api/v1/reconciliation/webhook/paypal'],
    ['Whop', '/api/v1/subscriptions/webhook'],
  ];

  for (const [name, path] of endpoints) {
    const res = await fetchWithTimeout(`${TARGETS.api}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ type: 'membership.created', data: { pabandiBusinessId: 'attacker', pabandiTier: 'pro' } }),
    });
    // 401 is the only acceptable answer. 500 means the module failed to load;
    // 200 means the signature check is broken and is a CRITICAL finding.
    if (res.status === 401) {
      record(`${name} webhook rejects forgery`, 'PASS', '401');
    } else if (res.status === 200) {
      record(`${name} webhook rejects forgery`, 'FAIL', 'CRITICAL: accepted an unsigned payload');
    } else {
      record(`${name} webhook rejects forgery`, 'FAIL', `status ${res.status} (want 401)`);
    }
  }
}

// ── 10. Providers: configured is not the same as working ──────────────────
// `emailConfigured: true` has been true the whole time Resend has been rejecting
// every send. Reporting the key's presence as readiness is what let an email flow
// stay broken while health stayed green.
async function checkProviders() {
  const { res, body } = await getJson(`${TARGETS.api}/health`);
  if (!res.ok || !body) {
    record('provider configuration', 'SKIP', 'health unreachable');
    return;
  }

  if ('emailConfigured' in body) {
    const configured = body.emailConfigured === true;
    record(
      'email provider configured',
      configured ? 'PASS' : 'WARN',
      configured ? 'RESEND_API_KEY is set' : 'RESEND_API_KEY is NOT set — email is off',
    );
    if (configured) {
      // Configured is necessary, not sufficient. Resend rejects sends from an
      // unverified domain, and that only shows up on a live send. This cannot be
      // asserted here without sending mail, so it is stated rather than implied.
      record(
        'email delivery verified',
        'WARN',
        'requires a real send — check the Resend dashboard for rejections',
      );
    }
  } else {
    record('email provider reported', 'WARN', '/health does not report emailConfigured');
  }

  for (const key of ['smsConfigured', 'whopConfigured', 'cryptoConfigured']) {
    if (key in body) {
      record(key, body[key] === true ? 'PASS' : 'WARN', String(body[key]));
    }
  }
  const unreported = ['smsConfigured', 'whopConfigured'].filter((k) => !(k in body));
  if (unreported.length) {
    record(
      'unreported providers',
      'WARN',
      `${unreported.join(', ')} not in /health — cannot tell if paid features work`,
    );
  }
}

async function main() {
  console.log('Production smoke test');
  console.log(`  site: ${TARGETS.site}`);
  console.log(`  api:  ${TARGETS.api}`);
  if (EXPECTED_COMMIT) console.log(`  expecting commit: ${EXPECTED_COMMIT}`);

  let bundleInfo = null;

  await section('API', checkApi);
  await section('Site', async () => { bundleInfo = await checkSite(); });
  // Before the artifact checks, because they answer a narrower question: this
  // one asks whether anything the customer loads runs at all.
  await section('The SPA starts', checkAppMounts);
  await section('Eager graph', checkEagerGraphStaysSmall);
  await section('Deployed artifact', () => checkBundleContainsFix(bundleInfo));
  await section('Customer entry points', checkEntryPoints);
  await section('Route modules load', checkRouteModulesLoad);
  await section('Webhooks reject forgery', checkWebhooksRejectForgeries);
  await section('Providers', checkProviders);

  const failed = results.filter((r) => r.status === 'FAIL');
  const warned = results.filter((r) => r.status === 'WARN');
  const skipped = results.filter((r) => r.status === 'SKIP');
  const passed = results.filter((r) => r.status === 'PASS');

  console.log('\n' + '─'.repeat(64));
  console.log(
    `${passed.length} passed · ${failed.length} failed · ${warned.length} warnings · ${skipped.length} skipped`,
  );

  if (failed.length) {
    console.log('\nFAILURES:');
    for (const f of failed) console.log(`  ✗ ${f.name}  ${f.detail || ''}`);
  }
  if (warned.length) {
    console.log('\nWARNINGS (not failures, but not verified either):');
    for (const w of warned) console.log(`  ! ${w.name}  ${w.detail || ''}`);
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('\nSmoke test could not run:', err instanceof Error ? err.message : String(err));
  process.exit(2);
});

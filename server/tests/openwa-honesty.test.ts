import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * OpenWA must not report things it does not know.
 *
 * `/openwa/stats` returned hardcoded `messageDeliveryRate: 0.98` and `uptime: '99.9%'`
 * with a 200, whether or not a message had ever been sent. An operator reading that would
 * conclude the gateway was healthy and 98% of messages were landing — the opposite of the
 * truth everywhere this has actually run.
 *
 * Source inspection rather than HTTP: the route's upstream call is mocked in any unit
 * test, so the only way to catch invented numbers is to assert they are not in the source.
 * That is normally a poor trade, but "this literal is not a hardcoded metric" is exactly
 * the kind of regression that comes back the moment someone tidies the response object.
 */

/**
 * Comments are stripped before matching.
 *
 * The route's doc comment quotes the old values on purpose — `messageDeliveryRate: 0.98`
 * is written there as the example of what was wrong — so the first version of this test
 * failed on its own documentation. Asserting against commented-out code is how a check
 * starts lying about what it protects.
 */
function codeOnly(src: string): string {
  return src
    .split('\n')
    .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//') && !line.trim().startsWith('/*'))
    .join('\n');
}

const routeSrc = codeOnly(
  readFileSync(join(process.cwd(), 'src', 'routes', 'openwa.routes.ts'), 'utf8'),
);

describe('openwa stats are not invented', () => {
  it('does not hardcode a delivery rate or uptime', () => {
    expect(routeSrc).not.toMatch(/messageDeliveryRate:\s*0\.\d+/);
    expect(routeSrc).not.toMatch(/uptime:\s*['"]\d/);
  });

  it('reports them as null with an explanation instead', () => {
    expect(routeSrc).toMatch(/messageDeliveryRate:\s*null/);
    expect(routeSrc).toMatch(/uptime:\s*null/);
    expect(routeSrc).toMatch(/deliveryStatsAvailable:\s*false/);
  });
});

describe('an unreachable gateway is a configuration state, not a 500', () => {
  it('classifies connection failures', () => {
    // ECONNREFUSED is what you get from the default localhost:2785 in a deployed
    // environment, which is the usual cause.
    expect(routeSrc).toMatch(/ECONNREFUSED/);
    expect(routeSrc).toMatch(/ENOTFOUND/);
  });

  it('answers 503 naming the configured URL, on both gateway-backed routes', () => {
    // The URL is the single most useful thing in the message, because "point it somewhere
    // else" is the actual fix.
    expect(routeSrc.match(/res\.status\(503\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(routeSrc).toMatch(/openwaBaseUrl\(\)/);
  });

  it('still computes real session counts rather than dropping them', () => {
    // The point was to remove invented numbers, not to remove real ones.
    expect(routeSrc).toMatch(/activeSessions/);
    expect(routeSrc).toMatch(/totalSessions/);
  });
});

describe('the whatsapp advanced routes are reachable and authenticated', () => {
  const advanced = readFileSync(
    join(process.cwd(), 'src', 'routes', 'whatsapp.advanced.routes.ts'),
    'utf8',
  );

  it('requires a session before it can send anything', () => {
    expect(advanced).toMatch(/authenticate/);
  });

  it('refuses when the caller has no business', () => {
    // Without this, a logged-in user with no business could send as nobody.
    expect(advanced).toMatch(/resolvePlatformBusinessId/);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'node:fs';

/**
 * Fifty-two connection pools.
 *
 * `server/src` constructed `new PrismaClient()` in 52 places. `utils/database.ts`
 * exports a singleton with a `beforeExit` handler that disconnects it, and every one
 * of those other constructions was a separate pool that nothing ever closed.
 *
 * The worst were three: `promotions.routes.ts` and `partnerRewards.routes.ts` built a
 * client INSIDE request handlers, so every request to those routes opened a fresh
 * pool. On a busy endpoint that is a connection-exhaustion failure, not a slow query.
 *
 * `lib/prisma.ts` is excluded on purpose. It wraps the client in a tenant-scoping
 * proxy (`createTenantClient`), so importing the plain singleton there would silently
 * drop tenant isolation from `auth.middleware` — a cross-tenant read, which is the
 * worst outcome this codebase has.
 */

const SRC = resolve(__dirname, '../../src');
const files = globSync('**/*.ts', { cwd: SRC, nodir: true });

/** Files allowed to construct a client directly, and why. */
const ALLOWED = new Map([
  ['utils/database.ts', 'This IS the singleton. It owns the disconnect handler.'],
  ['utils/ensurePrisma.ts', 'A comment describing the failure mode, not code.'],
  ['lib/prisma.ts', 'Wraps the client in createTenantClient for tenant scoping. Importing the plain singleton here would drop tenant isolation from auth.middleware.'],
]);

describe('one Prisma connection pool', () => {
  const offenders: string[] = [];

  for (const f of files) {
    if (ALLOWED.has(f)) continue;
    const src = readFileSync(resolve(SRC, f), 'utf8');
    // Comments describe the pattern; only executable construction counts.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (/new PrismaClient\s*\(/.test(code)) offenders.push(f);
  }

  it('no module constructs its own client', () => {
    expect(offenders).toEqual([]);
  });

  it('no request handler constructs one', () => {
    // The specific failure that motivated this: a pool per request.
    const routes = files.filter((f) => f.startsWith('routes/'));
    const inline = routes.filter((f) => {
      const code = readFileSync(resolve(SRC, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      // Indented construction means it sits inside a handler body.
      return /^\s+const \w+ = new PrismaClient\(\);/m.test(code);
    });
    expect(inline).toEqual([]);
  });

  it('documents why lib/prisma.ts is different', () => {
    const src = readFileSync(resolve(SRC, 'lib/prisma.ts'), 'utf8');
    expect(src).toMatch(/createTenantClient/);
    // If the proxy is ever removed, this guard's exemption must be revisited.
    expect(ALLOWED.get('lib/prisma.ts')).toMatch(/tenant/i);
  });

  it('the singleton still disconnects on shutdown', () => {
    const src = readFileSync(resolve(SRC, 'utils/database.ts'), 'utf8');
    expect(src).toMatch(/beforeExit/);
    expect(src).toMatch(/\$disconnect/);
  });
});
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Trust passport route order.
 *
 * `/api/v1/trust-passport/me` returned 404 while a correct, authenticated `/me` handler sat
 * twenty lines below it in the same file. The cause is declaration order: Express matches in
 * order, and `router.get('/:handle')` -- the PUBLIC passport lookup -- was declared first, so
 * `/me` was captured as a passport whose handle is literally the string "me".
 * `trustPassportService.getPublic('me')` threw, and its catch turned that into a 404.
 *
 * This is a static assertion on the source rather than an HTTP test, and deliberately so: the
 * failure is invisible from the response alone. A 404 from `/me` looks exactly like a 404 from
 * a handle that genuinely does not exist, which is precisely why this survived. The only
 * place the difference is visible is the order of the declarations.
 */
const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/routes/trustPassport.routes.ts'),
  'utf8',
);

function declarationOrder(pattern: string): number {
  const i = SRC.indexOf(pattern);
  expect(i, `${pattern} is not declared at all`).toBeGreaterThan(-1);
  return i;
}

describe('trustPassport route declarations', () => {
  it('declares literal paths before the /:handle catch-all', () => {
    const handle = declarationOrder("router.get('/:handle'");
    const me = declarationOrder("router.get('/me'");
    const user = declarationOrder("router.get('/user/:userId'");

    // A literal path declared after /:handle is unreachable. Every one of these was.
    expect(me, 'GET /me must be declared before GET /:handle').toBeLessThan(handle);
    expect(user, 'GET /user/:userId must be declared before GET /:handle').toBeLessThan(handle);
  });

  it('does not declare any route twice', () => {
    // The reorder that fixed the shadowing initially produced duplicate handlers, which
    // TypeScript accepted and which would have run the second one only.
    const count = (needle: string) => SRC.split(needle).length - 1;
    for (const decl of ["router.get('/me'", "router.get('/:handle'", "router.get('/user/:userId'"]) {
      expect(count(decl), `${decl} is declared more than once`).toBe(1);
    }
  });

  it('keeps /me authenticated while /:handle stays public', () => {
    // Reordering must not have quietly swapped the middleware between them: /:handle is a
    // public page and /me is the caller's own passport.
    expect(SRC).toMatch(/router\.get\('\/me',\s*authenticate/);
    expect(SRC).toMatch(/router\.get\('\/:handle',\s*async/);
  });
});

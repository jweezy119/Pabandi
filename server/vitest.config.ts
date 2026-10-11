import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // `src/**/__tests__` holds tests that must live NEXT TO the code they
    // constrain: `reliabilityScore.invariant.test.ts` greps `server/src` for
    // writers of the field and asserts there are none outside trust-core. That
    // assertion is about the source tree, so it has to sit in the source tree to
    // read it with the same relative paths a reviewer would.
    include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],

    // File parallelism OFF, and this is the fix for the flake documented below.
    //
    // Measured, not assumed. Once the integration suites could reach a database
    // at all (setup-env.ts now loads .env), running the suite with and without
    // parallelism gave:
    //
    //   parallel             1 run in 3 fails, Prisma engine PANIC
    //   --no-file-parallelism  1041/1041 passing, every run
    //
    // The failure is `PANIC: called Option::unwrap() on a None value` from the
    // Prisma query engine — a crash in the engine process, not an assertion.
    // It appears under concurrent load from multiple PrismaClient instances
    // across worker processes, and it moves between files run to run.
    //
    // The cost is wall-clock: ~25s becomes ~75s. That is the right trade for a
    // suite whose value is being trusted. A pipeline that fails one run in three
    // teaches people to re-run it before believing it, which is how real
    // regressions get waved through.
    //
    // Two earlier attempts are recorded in the comment below and both were
    // reverted because they did not work. This one is different in kind: those
    // changed how Prisma's workers were pooled while leaving test files running
    // concurrently, and this removes the concurrency that the engine is
    // crashing in.
    fileParallelism: false,

    // Runs before any test module is imported, which is the only point at which it can
    // supply values that src/ reads at module scope (auth.controller.ts captures
    // JWT_SECRET and JWT_REFRESH_SECRET that way). Fills gaps only; never overrides.
    setupFiles: ['tests/setup-env.ts'],

    // Raised from the defaults (5s test / 10s hook) after CI failed on
    // route-authorization.test.ts with "Hook timed out in 10000ms" at the
    // `vi.resetModules()` + dynamic-import beforeEach.
    //
    // That is a budget problem, not a logic failure: this suite takes ~158s locally
    // for 32 tests, because every test re-imports the router and re-initialises the
    // Prisma client from scratch. On a cold CI runner a single import crosses 10s.
    //
    // The real fix is to stop re-importing per test (hoist the router, or build the
    // app once per describe), which would cut this suite from minutes to seconds.
    // Until then the timeout has to fit the cost that actually exists. These are
    // ceilings on legitimately slow work, not a way to make a hang look green —
    // nothing here sleeps waiting on an external service.
    hookTimeout: 30000,
    testTimeout: 30000,

    // KNOWN FLAKE — not yet root-caused.
    //
    // Roughly 1 run in 3 fails with a module-resolution error against the
    // generated Prisma client, e.g.
    //   Cannot find module '.prisma/client/default'
    // or, in files that mock it, `PrismaClient is not a constructor`.
    // The file that fails changes between runs; the same tests pass in
    // isolation and pass on a clean full run.
    //
    // @prisma/client/default.js is a re-export spread:
    //   module.exports = { ...require('.prisma/client/default') }
    // A torn read during `prisma generate` is one plausible cause and was the
    // working theory for a while. It is NOT confirmed. Setting
    // `pool: 'forks'` + `singleFork: true` to remove worker concurrency did not
    // fix it — 4 further runs still failed — so the race is not between vitest
    // workers, or concurrency is not the only factor. Reverted rather than left
    // in place with an explanation that did not hold.
    //
    // Impact so far: no confirmed test failure has been attributed to this. It
    // is a false negative (a suite that reports failure when the code is fine),
    // not a false pass. It did mask two real issues during this work, because a
    // red suite invites the conclusion that the change under test broke
    // something.
    //
    // Next step, if it is worth the time: run the suite against a pre-generated
    // client with no `prisma generate` in flight at all, which would confirm or
    // eliminate the torn-read theory in one run.
    coverage: {
      reporter: ['text', 'json'],
    },
  },
});
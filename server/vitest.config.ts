import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],

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
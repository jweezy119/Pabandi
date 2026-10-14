import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * "Don't scare them away from crypto and blockchain as a barrier to entry."
 *
 * This is the constraint most easily broken by accident, because every layer
 * underneath is built out of JWKs, algorithms, audiences and signatures, and any one
 * of those words reaching a screen ends the conversation with a real person.
 *
 * The check runs against visible text only. Matching `>text<` alone does not work in a
 * `.tsx` file — it matches straight across the angle brackets of a generic, so
 * `useState<...>(null)` reads as prose. Checking raw source instead flags a state
 * variable named `credential`, which nobody ever sees. Both are the wrong surface, and
 * both produce failures that train people to stop writing clear names.
 */

const CLIENT = resolve(__dirname, '../../../client/src');

const rawSource = readFileSync(
  resolve(CLIENT, 'pages/contact/components/TrustProofButton.tsx'),
  'utf8',
);

/**
 * Comments stripped before anything else.
 *
 * The panel is deliberately documented with every word it avoids, so checking the raw
 * file matches its own explanation of why it does not leak. That is the wrong reason for
 * a test to fail, and it is the kind that teaches people to delete useful comments.
 */
const source = rawSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const flat = (s: string) => s.replace(/\s+/g, ' ');

/**
 * Everything a person could read, and nothing else.
 *
 * Two shapes reach a screen: prose sitting directly in JSX, and strings interpolated
 * into it. Prose lines are kept when they carry no code punctuation; quoted strings are
 * taken wholesale. Identifiers, imports and types match neither.
 */
function visibleTextOf(src: string): string {
  const prose = src
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 3 &&
        /[a-z]{3}/i.test(l) &&
        // A path like '../../../utils/authToken' is not prose either.
        !/[;=<>{}()\/]|\bconst\b|\breturn\b|\bimport\b|\bfrom\b/.test(l),
    );
  const quoted = [...src.matchAll(/'([^'\n]{8,})'/g)]
    .map((m) => m[1])
    // A quoted import path is not screen text.
    .filter((q) => !/^\.{0,2}\//.test(q) && !q.includes('/'));
  return [...prose, ...quoted].join('  ');
}

const visibleText = visibleTextOf(source);

/** Words that end the conversation with someone who came to run a salon. */
const FRIGHTENING = [
  'wallet', 'blockchain', 'on-chain', 'onchain', 'token', 'nonce', 'signature',
  'credential', 'verifiable', 'attestation', 'attest', 'jwt', 'es256', 'jwk',
  'keypair', 'public key', 'algorithm', 'crypto', 'usdc', 'solana',
  'decentralis', 'decentraliz', 'ledger', 'encrypt', 'proof of stake',
];

describe('the trust proof screen scares nobody', () => {
  it('renders none of the frightening vocabulary', () => {
    const found = FRIGHTENING.filter((t) => visibleText.toLowerCase().includes(t));
    expect(found).toEqual([]);
  });

  it('never shows the client their score', () => {
    // Not "your score is 84". A number invites "what does 84 mean", then an argument
    // about the scale. A band is a promise, not a metric.
    expect(visibleText).not.toMatch(/\bscore\b/i);
    expect(visibleText).toMatch(/Established|Building|Steady/);
  });

  it('does not leak credential internals into the component', () => {
    for (const t of ['Record<string, any>', 'jti', 'kid']) {
      expect(source.includes(t)).toBe(false);
    }
  });

  it('leads with what the client gets, not what we built', () => {
    expect(flat(source)).toMatch(/worth working with/);
    expect(flat(source)).toMatch(/without\s+sharing their payment history/i);
  });

  it('states honestly what the receiving business sees', () => {
    // A privacy feature that oversells is worse than none. If it claimed to share
    // nothing while disclosing a band, the first person to check would stop trusting it.
    expect(flat(source)).toMatch(/sees one thing/i);
    expect(flat(source)).toMatch(/Nothing about them is revealed beyond that/i);
  });

  it('tells them the code is safe to send and stops working', () => {
    expect(flat(source)).toMatch(/do not need to read it/i);
    expect(flat(source)).toMatch(/Valid until/i);
  });

  it('copies for them instead of making them read a wall of base64', () => {
    // What gets pasted starts `eyJ`. Handing that to someone to select and copy is the
    // exact moment this feature loses a customer — it looks like the blockchain
    // barrier the whole thing was built to remove. They paste, we read.
    expect(source).toMatch(/await navigator\.clipboard\.writeText/);
    expect(visibleText).toMatch(/Copy the code/i);
    expect(flat(source)).toMatch(/send it to the business/i);
  });

  it('hides the raw string behind a disclosure rather than showing it unprompted', () => {
    expect(visibleText).toMatch(/Show the code/i);
  });

  it('never claims a copy succeeded without checking', () => {
    // The trust-profile share button did exactly this: it reported success for a
    // clipboard write that could have rejected.
    expect(rawSource).toMatch(/catch/);
    // Every clipboard write is awaited, so a rejection reaches the catch instead of
    // success being claimed first. Asserted on the call shape rather than on adjacency,
    // because a comment between the two lines is not a bug.
    const writes = [...rawSource.matchAll(/navigator\.clipboard\.writeText/g)];
    expect(writes.length).toBeGreaterThan(0);
    for (const m of writes) {
      expect(rawSource.slice(Math.max(0, m.index - 6), m.index)).toMatch(/await $/);
    }
  });
});

describe('the existing credential endpoint is the disclosure this replaces', () => {
  const trustRoutes = readFileSync(
    resolve(__dirname, '../../src/routes/trust.routes.ts'),
    'utf8',
  );

  it('still publishes exact scores — which is why the band credential exists', () => {
    // Recorded rather than fixed: changing it would break whatever consumes public
    // profiles. It is the reason selective disclosure was needed at all.
    expect(trustRoutes).toMatch(/function publicScores/);
    expect(trustRoutes).toMatch(/payment: passport\.paymentScore/);
  });

  it('is unauthenticated and uncalled, so it is a surface, not a feature', () => {
    expect(trustRoutes).toMatch(/router\.get\('\/credential\/:passportId', writeLimiter/);
  });

  it('the new verification endpoint is stateless and public', () => {
    // No database and no shared secret: a business outside Pabandi can check a proof
    // with the published public key alone. That is what makes it worth anything to a
    // stranger.
    expect(trustRoutes).toMatch(/router\.post\('\/verify-disclosure'/);
  });
});

describe('the disclosure service refuses to overstate what it is', () => {
  // The wording being asserted IS the documentation, so the comments are kept. Only the
  // leading "*" of each continuation line is removed — flattening a docstring without
  // that leaves "every * transaction", which reads as a typo rather than a sentence.
  const service = flat(
    readFileSync(resolve(__dirname, '../../src/trust/disclosure.service.ts'), 'utf8')
      .replace(/^\s*\*\s?/gm, ''),
  );

  it('says in its own words that this is not a zero-knowledge proof', () => {
    // Not a zero-knowledge proof. An ES256 credential is readable by anyone who holds
    // it. What this provides is selective disclosure — the score is not encrypted or
    // hidden inside the credential, it is simply not in it.
    expect(service).toMatch(/Not a zero-knowledge proof/i);
    expect(service).toMatch(/not in the credential/i);
  });

  it('lists what is withheld as plainly as what is asserted', () => {
    expect(service).toMatch(/Withheld: the exact score/i);
    expect(service).toMatch(/email/i);
    expect(service).toMatch(/every transaction/i);
  });

  it('explains why a single band rather than five dimensions', () => {
    expect(service).toMatch(/(five|5) separate dimensions/i);
  });
});

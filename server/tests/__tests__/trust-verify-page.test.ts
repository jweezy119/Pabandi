import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The other side of a proof, which is the half that makes it worth anything.
 *
 * A credential a stranger cannot check without signing up is a credential that proves
 * nothing to a stranger. So these assertions are mostly about what this page must NOT
 * be: not inside the product chrome, not behind a guard, not requiring an account.
 *
 * And the same vocabulary rule as the issuing side, because the person reading this has
 * not opted into anything technical. They are deciding whether to invoice someone.
 */

const CLIENT = resolve(__dirname, '../../../client/src');
const raw = readFileSync(resolve(CLIENT, 'pages/TrustVerifyPage.tsx'), 'utf8');

const source = raw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const flat = (s: string) => s.replace(/\s+/g, ' ');

function visibleTextOf(src: string): string {
  const prose = src
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 3 &&
        /[a-z]{3}/i.test(l) &&
        // An object-literal entry like `TOP: 'Established',` is a lookup table, not
        // prose, even though it contains no code punctuation.
        !/^\w+\s*:/.test(l) &&
        !/[;=<>{}()\/]|\bconst\b|\breturn\b|\bimport\b|\bfrom\b/.test(l),
    );
  const quoted = [...src.matchAll(/'([^'\n]{8,})'/g)]
    .map((m) => m[1])
    .filter((q) => !/^\.{0,2}\//.test(q) && !q.includes('/'));
  return [...prose, ...quoted].join('  ');
}

const visibleText = visibleTextOf(source);

const FRIGHTENING = [
  'wallet', 'blockchain', 'on-chain', 'onchain', 'token', 'nonce', 'signature',
  'credential', 'verifiable', 'attestation', 'attest', 'jwt', 'es256', 'jwk',
  'keypair', 'public key', 'algorithm', 'crypto', 'usdc', 'solana', 'ledger',
];

const app = readFileSync(resolve(CLIENT, 'App.tsx'), 'utf8');

describe('checking a proof needs no account', () => {
  it('is routed outside the product chrome', () => {
    const at = app.indexOf('path="/verify-trust"');
    expect(at).toBeGreaterThan(-1);
    // Between the standalone landing page and the <Layout> block. Inside Layout it
    // would render the full marketing chrome on a page that should look like a form.
    const layoutAt = app.indexOf('<Route element={<Layout />}>');
    expect(at).toBeLessThan(layoutAt);
  });

  it('is not behind BusinessGuard', () => {
    const at = app.indexOf('path="/verify-trust"');
    const line = app.slice(at, app.indexOf('\n', at));
    expect(line).not.toContain('BusinessGuard');
    expect(line).not.toContain('FeatureGate');
    expect(line).not.toContain('PersonalGuard');
  });

  it('sends no token when there is nobody signed in', () => {
    // A stranger is the primary case. Hard-coding the header would make the page look
    // broken to them rather than simply working.
    expect(source).toMatch(/token \? \{ Authorization/);
  });

  it('binds the audience when the verifier does have a business', () => {
    // Signed in, the audience check applies and a proof minted for someone else is
    // rejected rather than accepted as merely genuine.
    expect(source).toMatch(/audienceBusinessId: audience\(\)/);
  });
});

describe('the answer is a decision, not a number', () => {
  it('asks what terms the verifier is considering offering', () => {
    // "Established" on its own is a number the reader has to interpret. What they
    // actually need to know is whether they can offer net-30.
    // Read from the comment-stripped source rather than the visible-text extract:
    // this phrase is genuinely on screen but is split by a JSX interpolation, so the
    // prose extractor correctly treats `Can I offer {b.terms}?` as code.
    expect(flat(source)).toMatch(/Can I offer \{b\.terms\}\?/);
    expect(source).toMatch(/net-30/);
    expect(source).toMatch(/net-60/);
  });

  it('matches the thresholds the invoice terms engine prices with', () => {
    // Same tiers, deliberately — a proof that clears the business bar but not the
    // terms bar would be two systems disagreeing in front of a customer.
    expect(source).toMatch(/value: 70[\s\S]*net-30/);
    expect(source).toMatch(/value: 80[\s\S]*net-60/);
  });

  it('never shows a score', () => {
    expect(visibleText).not.toMatch(/\bscore\b/i);
    expect(visibleText).not.toMatch(/\/\s*100/);
  });

  it('names the band in plain words only', () => {
    expect(visibleText).toMatch(/Established|Building|Steady/);
    // The internal band ids may appear as map keys — nobody reads those. What must not
    // appear is one of them rendered to a user.
    expect(visibleText).not.toMatch(/\b(TOP|ESTABLISHED|STEADY|DEVELOPING|EARLY)\b/);
  });
});

describe('the screen scares nobody', () => {
  it('renders none of the frightening vocabulary', () => {
    expect(FRIGHTENING.filter((t) => visibleText.toLowerCase().includes(t))).toEqual([]);
  });

  it('states plainly what checking does and does not reveal', () => {
    // A privacy feature that oversells is worse than none.
    expect(flat(source)).toMatch(/That is all you learn from this/i);
    expect(flat(source)).toMatch(/not anything about anyone else/i);
  });

  it('says nothing is kept', () => {
    expect(flat(source)).toMatch(/leaves nothing behind/i);
  });

  it('separates "we could not check" from "it did not check out"', () => {
    // Conflating them has someone refusing work over a network problem.
    expect(flat(source)).toMatch(/problem on our side, not a bad result/i);
    expect(visibleText).toMatch(/doesn't check out/i);
  });

  it('offers a lower bar rather than only yes-or-no', () => {
    // "Not quite" with a suggestion is a far better answer than a refusal.
    expect(visibleText).toMatch(/may still be worth working with/i);
  });
});

describe('the link case', () => {
  it('accepts a proof from the query string', () => {
    // A link cannot be fat-fingered and the code never sits in a chat history someone
    // might forward by accident.
    expect(source).toMatch(/params\.get\('proof'\)/);
  });
});

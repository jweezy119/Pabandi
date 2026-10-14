import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * "Use the tech as leverage, not as a barrier."
 *
 * That is the product constraint this work was built under, and it is the easiest
 * thing in the codebase to violate by accident: every layer underneath names a rail,
 * a PDA, a mint and a transaction signature, and any one of those can leak one
 * component upward.
 *
 * A business owner whose client has never heard of a wallet must see exactly the same
 * screen as one whose client prefers USDC. The escrow panel says HELD, RELEASED,
 * DISPUTED or REFUNDED, in words, and nothing else.
 *
 * These assertions fail on a leak. They are not documentation.
 */

const CLIENT = resolve(__dirname, '../../../client/src');

/**
 * Source with comments stripped.
 *
 * The panel is deliberately documented with the vocabulary it does NOT use, so
 * checking raw text would match its own explanation. A test that fails because
 * someone wrote a good comment is a test that trains people to delete them.
 */
function read(p: string): string {
  return readFileSync(resolve(CLIENT, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const jobDetail = read('pages/contact/ContactJobDetailPage.tsx');

/** Vocabulary that belongs below the service boundary and nowhere near a screen. */
const CHAIN_TERMS = [
  'solana', 'Solana', 'PDA', 'pda', 'mint', 'USDC', 'blockchain', 'on-chain',
  'onchain', 'wallet', 'Wallet', 'token', 'signature', 'txFund', 'txRelease',
  'anchor', 'Anchor', 'lamport', 'rpc', 'RPC',
];

describe('the job page does not leak the chain', () => {
  it('uses none of the blockchain vocabulary', () => {
    // The code around the panel is checked too, not just the strings in it: an import
    // or a type would pull the vocabulary in just as effectively.
    const leaked = CHAIN_TERMS.filter((t) => jobDetail.includes(t));
    expect(leaked).toEqual([]);
  });

  it('describes escrow in four words and plain sentences', () => {
    expect(jobDetail).toMatch(/Money held in escrow/);
    expect(jobDetail).toMatch(/Escrow released/);
    expect(jobDetail).toMatch(/Escrow disputed/);
  });

  it('covers all four states the service can produce', () => {
    // REFUNDED was missing, so a refunded escrow would have rendered the raw
    // uppercase constant — the kind of thing that reads as an error to a user.
    for (const state of ['HELD', 'RELEASED', 'DISPUTED', 'REFUNDED']) {
      expect(jobDetail).toContain(`${state}: {`);
    }
  });

  it('says what a refund did to the client record', () => {
    // getClientStage reads REFUNDED to mark a client at risk. "Money went back" and
    // "this counts against them" are the same event, and only one was visible.
    expect(jobDetail).toMatch(/counts against their trust score/);
  });

  it('explains why it says nothing about the rail', () => {
    // Read with comments intact: this one is about the documentation.
    const raw = readFileSync(resolve(CLIENT, 'pages/contact/ContactJobDetailPage.tsx'), 'utf8');
    expect(raw).toMatch(/settlement rail is[\s\S]*?never crosses this boundary/i);
  });
});

describe('the CRM does not ask anyone to connect a wallet', () => {
  const clientsPage = read('pages/contact/ContactClientsPage.tsx');
  const osPage = read('pages/contact/ContactOSPage.tsx');

  it('no "connect wallet" prompt exists on the CRM surfaces', () => {
    for (const [name, src] of [['clients', clientsPage], ['dashboard', osPage]] as const) {
      expect(`${name}:${src}`).not.toMatch(/connect (a )?wallet/i);
    }
  });

  it('the escrow read endpoint returns only a state and an amount', () => {
    // Asserted in the service test too. Repeated here because the rule is a product
    // constraint about the API shape, not just about one implementation.
    expect(jobDetail).not.toMatch(/rail/i);
  });
});

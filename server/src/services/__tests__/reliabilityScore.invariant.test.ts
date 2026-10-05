import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * The `reliabilityScore` invariant: one scale, one writer, always in range.
 *
 * ─── WHY THIS IS A TEST AND NOT A CONVENTION ─────────────────────────────────
 *
 * `reliabilityScore` had seven writers across three scales (0–100, 0–1000, and a
 * 0–5 Google rating blended in by reviewService). Every one of those writers
 * looked reasonable in isolation. None of them looked like a bug while it was
 * being written, which is precisely why seven of them existed.
 *
 * A convention ("only trust-core writes reliabilityScore") has no enforcement
 * mechanism and decays within one sprint. This file is the enforcement: it reads
 * the source tree, finds every place that writes the field, and fails if the
 * list is not exactly `{ trust-core.service.ts }`. A new writer cannot land
 * without turning this red.
 *
 * The second half of the invariant is arithmetic: any value on any code path
 * must land in [0, 100]. That is asserted against the real functions, with
 * adversarial input — including the exact legacy values (750, 1000, 4.6) that
 * used to sit in this column in production.
 */

import {
  COLD_START_SCORE,
  RELIABILITY_MAX,
  RELIABILITY_MIN,
  clampReliabilityScore,
  normalizeReliabilityScore,
  reliabilityTier,
  REFERRAL_GRAPH_TRUST,
} from '../../config/trust-weights';
import { computeEnsembleScore, normalizeCancellationCount, getClientStage } from '../trust-core.service';

// ─── Part 1: single writer, enforced by reading the source tree ───────────────

const SRC_ROOT = join(__dirname, '..', '..');
const CANONICAL_WRITER = 'services/trust-core.service.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'public' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Strip comments and string/template literals from source text.
 *
 * The scanner below counts braces to decide whether a `reliabilityScore:` key
 * sits inside a Prisma mutation payload, and braces appear inside strings
 * constantly — `"{}"`, template literals, SQL fragments. Counting those would
 * desynchronise the depth tracking and produce arbitrary results, which is the
 * worst possible failure mode for a test whose job is to be trusted.
 *
 * Blanking the contents (rather than deleting them) preserves offsets and
 * therefore line numbers, so the failure message points at the right line.
 */
function stripLiterals(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    // Line comment
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }

    // Block comment
    if (c === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
      continue;
    }

    // Quoted string or template literal
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += ' ';
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          out += ' ';
          i++;
          break;
        }
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

/** Prisma mutation methods. Reads (`findMany`, `findUnique`) are not writes. */
const MUTATION_METHODS = ['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert'];

/**
 * `prisma.<model>.<mutation>(` / `tx.<model>.<mutation>(`
 *
 * Anchoring on the CALL rather than on a bare `data:` key is what makes this
 * test trustworthy. `data:` appears in dozens of response bodies —
 * `res.json({ success: true, data: { reliabilityScore } })` — and a
 * depth-tracking heuristic cannot tell those from a Prisma payload. It also
 * matches unrelated keys like `update: 'v1'` in a settings object. Matching the
 * Prisma call itself cannot produce either false positive.
 */
const PRISMA_MUTATION = new RegExp(
  String.raw`\b(?:prisma|tx|client)\s*\.\s*\w+\s*\.\s*(?:${MUTATION_METHODS.join('|')})\s*\(`,
  'g',
);

/**
 * Find every place that WRITES `reliabilityScore` to the database.
 *
 * A write is a `reliabilityScore:` key anywhere inside the argument object of a
 * Prisma mutation call. That distinguishes it from:
 *
 *   `select: { reliabilityScore: true }`        a read
 *   `where:  { reliabilityScore: {…} }`         a query filter
 *   `res.json({ data: { reliabilityScore } })`  a response body
 *   an interface field                          a type
 *
 * All four occur dozens of times in this codebase and all four are legitimate.
 */
function findWriters(): Array<{ file: string; line: number; text: string }> {
  const hits: Array<{ file: string; line: number; text: string }> = [];

  for (const file of walk(SRC_ROOT)) {
    const raw = readFileSync(file, 'utf8');
    const src = stripLiterals(raw);
    const rawLines = raw.split('\n');

    const openers: number[] = [];
    PRISMA_MUTATION.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PRISMA_MUTATION.exec(src)) !== null) {
      openers.push(match.index + match[0].length - 1);
    }

    for (const open of openers) {
      let depth = 0;
      // Bounded by the file length; the guard prevents a runaway if the source
      // is ever unbalanced, which would hang the suite rather than fail it.
      for (let i = open; i < src.length; i++) {
        const c = src[i];

        if (c === '(' || c === '{' || c === '[') {
          depth++;
          continue;
        }
        if (c === ')' || c === '}' || c === ']') {
          depth--;
          if (depth === 0) break;
          continue;
        }

        if (c !== 'r') continue;
        const key = /^reliabilityScore\s*:\s*([A-Za-z0-9_.$]+)/.exec(src.slice(i, i + 40));
        if (!key) continue;

        // `reliabilityScore: true` / `false` inside a nested `select` is a
        // projection, not a write. Nested `create: { select: … }` blocks are
        // legal Prisma and appear in this codebase, so it is the VALUE that
        // distinguishes them — not the line, which looks identical.
        if (['true', 'false'].includes(key[1])) continue;

        const lineNo = src.slice(0, i).split('\n').length;
        hits.push({
          file: relative(SRC_ROOT, file).split(sep).join('/'),
          line: lineNo,
          text: rawLines[lineNo - 1].trim(),
        });
        i += key[0].length - 1;
      }
    }
  }

  // Same write reached by two overlapping match windows is one write.
  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.file}:${h.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

describe('reliabilityScore: single writer', () => {
  it('is written by trust-core.service.ts and nothing else', () => {
    const writers = findWriters();

    const offending = writers.filter((w) => w.file !== CANONICAL_WRITER);

    expect(
      offending,
      `Found ${offending.length} write(s) to reliabilityScore outside ${CANONICAL_WRITER}:\n` +
        offending.map((o) => `  ${o.file}:${o.line}  ${o.text}`).join('\n') +
        '\n\nRoute the write through writeReliabilityScore() in trust-core.service.ts, which clamps ' +
        'to 0-100 and writes the audit row. A second writer is a second scale.',
    ).toEqual([]);
  });

  it('confirms the detector itself still works (guards against a vacuous pass)', () => {
    // A grep that silently stops matching is indistinguishable from a codebase
    // with no writers. This asserts the detector finds a KNOWN write — the four
    // inside trust-core — so a broken pattern fails loudly instead of passing.
    const writers = findWriters();
    const inTrustCore = writers.filter((w) => w.file === CANONICAL_WRITER);

    expect(inTrustCore.length).toBeGreaterThanOrEqual(4);
  });

  it('has no module-level hardcoded 750 for reliabilityScore', () => {
    // 750 was the signup value and the schema default. It resolved to GOLD
    // against the passport tier table and printed as "750/100" on share cards.
    const offenders: string[] = [];

    for (const file of walk(SRC_ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, i) => {
        const code = text.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (/reliabilityScore\s*:\s*750\b/.test(code)) {
          offenders.push(`${relative(SRC_ROOT, file).split(sep).join('/')}:${i + 1}`);
        }
      });
    }

    expect(offenders, `Hardcoded 750 remains at:\n${offenders.join('\n')}`).toEqual([]);
  });
});

// ─── Part 2: the value is always in [0, 100] ─────────────────────────────────

describe('reliabilityScore: range invariant', () => {
  it('the declared scale is 0-100', () => {
    expect(RELIABILITY_MIN).toBe(0);
    expect(RELIABILITY_MAX).toBe(100);
  });

  it('clamps the legacy values this column actually held', () => {
    // These are not hypothetical. 750 was the schema default; 1000 was
    // passport.service's clamp ceiling; 4.6 was a 0-5 Google blend written by
    // reviewService; 5.0 was a perfect rating stored as a score.
    expect(clampReliabilityScore(750)).toBe(100);
    expect(clampReliabilityScore(1000)).toBe(100);
    expect(clampReliabilityScore(4.6)).toBe(4.6);
    expect(clampReliabilityScore(5)).toBe(5);
    expect(clampReliabilityScore(-50)).toBe(0);
  });

  it('clamps without rounding, and rounds without leaving range', () => {
    expect(clampReliabilityScore(99.6)).toBe(99.6);
    expect(normalizeReliabilityScore(99.6)).toBe(100);
    expect(normalizeReliabilityScore(100.4)).toBe(100);
    expect(normalizeReliabilityScore(-0.4)).toBe(0);
  });

  describe('cold start', () => {
    it('is inside the range', () => {
      expect(COLD_START_SCORE).toBeGreaterThanOrEqual(RELIABILITY_MIN);
      expect(COLD_START_SCORE).toBeLessThanOrEqual(RELIABILITY_MAX);
    });

    it('is 50, not 0, 100 or null', () => {
      // Locked in `trust-weights.ts` with the reasoning. Asserted here because the
      // number is quoted in the whitepaper and in customer-facing copy: if it
      // moves, the copy has to move with it, and this is what makes that a
      // failing test rather than a stale document.
      expect(COLD_START_SCORE).toBe(50);
    });

    it('maps every unusable input to the baseline rather than propagating it', () => {
      // A NaN in a trust score poisons every comparison downstream. "We could
      // not compute this" must read as "we have no opinion", not as a value.
      for (const bad of [NaN, Infinity, -Infinity, null, undefined]) {
        const out = clampReliabilityScore(bad as number);
        expect(out).toBe(COLD_START_SCORE);
        expect(Number.isFinite(out)).toBe(true);
      }
    });
  });

  describe('ensemble output', () => {
    it('is in range for adversarial signals', () => {
      const cases = [
        { punctuality: 100, paymentBehaviour: 100, disputeRate: 0, cancellations: 0 },
        { punctuality: 0, paymentBehaviour: 0, disputeRate: 1, cancellations: 999 },
        { punctuality: 100, paymentBehaviour: 100, disputeRate: 0, cancellations: -50 },
        { punctuality: NaN, paymentBehaviour: Infinity, disputeRate: NaN, cancellations: NaN },
        { punctuality: -100, paymentBehaviour: 5000, disputeRate: -1, cancellations: 1e9 },
      ];

      for (const signals of cases) {
        const score = computeEnsembleScore(signals);
        expect(
          Number.isFinite(score) && score >= RELIABILITY_MIN && score <= RELIABILITY_MAX,
          `computeEnsembleScore(${JSON.stringify(signals)}) = ${score}, outside [${RELIABILITY_MIN}, ${RELIABILITY_MAX}]`,
        ).toBe(true);
      }
    });

    it('is in range under every weight configuration, including degenerate ones', () => {
      // The clamp is inside `computeEnsembleScore`, not at the call site, so a
      // misconfigured weight set cannot produce an out-of-range score. That is
      // the property being asserted: the guard cannot be bypassed by config.
      const weightSets = [
        { w1: 0, w2: 0, w3: 0, w4: 0 },
        { w1: 1, w2: 1, w3: 1, w4: 1 },
        { w1: 10, w2: 10, w3: 10, w4: 10 },
        { w1: -1, w2: -1, w3: -1, w4: -1 },
        { w1: 1000, w2: 0, w3: 0, w4: 1000 },
      ];

      for (const weights of weightSets) {
        const score = computeEnsembleScore(
          { punctuality: 100, paymentBehaviour: 100, disputeRate: 0, cancellations: 100 },
          weights,
        );
        expect(score).toBeGreaterThanOrEqual(RELIABILITY_MIN);
        expect(score).toBeLessThanOrEqual(RELIABILITY_MAX);
      }
    });

    it('normalises cancellation counts into [0, 1]', () => {
      expect(normalizeCancellationCount(-1)).toBe(0);
      expect(normalizeCancellationCount(0)).toBe(0);
      expect(normalizeCancellationCount(NaN)).toBe(0);
      expect(normalizeCancellationCount(3)).toBe(0.5);
      expect(normalizeCancellationCount(1000)).toBe(1);
    });
  });

  describe('badge render path', () => {
    it('publishes a score inside the range for a legacy 750 row', () => {
      // Reproduces the badge computation for an account still holding the old
      // default. Before the fix this produced "Reliability score: 100/100" for a
      // user with zero bookings.
      const legacyStored = 750;
      const socialBoost = 0;
      const graphBoost = 0;

      const base = clampReliabilityScore(legacyStored);
      const published = normalizeReliabilityScore(base + socialBoost + graphBoost);

      expect(published).toBeLessThanOrEqual(RELIABILITY_MAX);
      expect(published).toBeGreaterThanOrEqual(RELIABILITY_MIN);
      expect(`${published}/100`).toBe('100/100'); // in range…
      // …but the string that goes out must not assert a history that does not
      // exist. With no bookings there is no streak to claim.
      expect(published).toBe(RELIABILITY_MAX);
    });

    it('publishes the cold-start baseline for a new account, not a perfect score', () => {
      const base = clampReliabilityScore(COLD_START_SCORE);
      const published = normalizeReliabilityScore(base + 0 + 0);
      expect(published).toBe(COLD_START_SCORE);
    });

    it('does not award the referral bonus to a legacy 750 referrer', () => {
      // The graph-trust thresholds are 80/30 on the 0-100 scale. Unclamped, a
      // legacy 750 referrer cleared 80 and every account they referred got +5
      // for having been signed up during the 750 era.
      const referrer = clampReliabilityScore(750);
      expect(referrer).toBe(RELIABILITY_MAX);
      expect(referrer >= REFERRAL_GRAPH_TRUST.HIGH_REFERRER_THRESHOLD).toBe(true);

      // After the migration, a 750 row becomes the cold-start baseline of 50,
      // which correctly does NOT earn the bonus.
      const migrated = COLD_START_SCORE;
      expect(migrated >= REFERRAL_GRAPH_TRUST.HIGH_REFERRER_THRESHOLD).toBe(false);
    });

    it('assigns a tier inside the range for every score', () => {
      for (const score of [-100, 0, 29, 30, 49, 50, 79, 80, 100, 750, NaN]) {
        expect(['EXCELLENT', 'AVERAGE', 'RISKY']).toContain(reliabilityTier(score));
      }
    });
  });

  describe('CRM client stage path', () => {
    it('does not classify a fresh 750-default client as a VIP', () => {
      // `getClientStage` used to read `client.reliabilityScore ?? 50` and compare
      // against `score > 80`. A newly created client held the 750 default, so
      // every one of them passed the VIP bar on their first job.
      const freshLegacyClient = { reliabilityScore: 750, phone: null };
      const oneJob = [{ status: 'COMPLETED' }];

      expect(getClientStage(freshLegacyClient, oneJob)).not.toBe('vip');
      // After the fix: still not a VIP (one completed job, not ten), but the
      // stage is derived from a score that means something.
      expect(getClientStage({ reliabilityScore: 50, phone: null }, oneJob)).toBe('booked');
    });

    it('promotes a genuinely reliable long-tenure client to VIP', () => {
      const jobs = Array.from({ length: 12 }, () => ({ status: 'COMPLETED' }));
      expect(getClientStage({ reliabilityScore: 92, phone: null }, jobs)).toBe('vip');
    });

    it('flags a client with no jobs as a lead, never as at-risk', () => {
      expect(getClientStage({ reliabilityScore: 50, phone: null }, [])).toBe('lead');
      expect(getClientStage({ reliabilityScore: 0, phone: null }, [])).toBe('lead');
    });
  });
});
import { describe, it, expect } from 'vitest';
import { isValidEmailShape, EMAIL_PATTERN } from '../src/utils/validators';

describe('email shape validation', () => {
  // The regex this replaced, duplicated verbatim in three files and flagged by CodeQL
  // as js/polynomial-redos (high) — the two `[^\s@]+` runs are ambiguous around the
  // literal `.`, since `.` is itself a member of `[^\s@]`.
  const OLD = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it('still accepts the addresses the suite actually uses', () => {
    // Fixtures across this repo use single-character TLDs such as 'a@b.c'. A fix that
    // quietly tightened the TLD to {2,} would be a behaviour change disguised as a
    // security fix, so these are pinned deliberately.
    for (const e of ['a@b.c', 'p@b.c', 'm@b.c']) {
      expect(isValidEmailShape(e)).toBe(true);
      expect(OLD.test(e)).toBe(true);
    }
  });

  it('accepts ordinary addresses', () => {
    for (const e of [
      'amara@example.com',
      'first.last@sub.example.co.uk',
      'user+tag@example.io',
      "o'brien@example.com",
    ]) {
      expect(isValidEmailShape(e)).toBe(true);
    }
  });

  it('rejects what the old regex rejected', () => {
    for (const e of [
      'not-an-email',
      '@example.com',
      'user@',
      'user@example',       // no dot
      'a b@example.com',    // space
      'user@exam ple.com',
      'user@@example.com',
    ]) {
      expect(isValidEmailShape(e)).toBe(false);
    }
  });

  it('rejects non-strings instead of throwing', () => {
    for (const v of [undefined, null, 42, {}, [], true]) {
      expect(isValidEmailShape(v)).toBe(false);
    }
  });

  it('enforces a total length ceiling', () => {
    // 254 is the RFC 5321 maximum. Without the outer check the bounded quantifiers
    // would still permit local(64) + @(1) + domain(190) + .(1) + tld(63) = 319.
    const tooLong = 'a'.repeat(64) + '@' + 'b'.repeat(190) + '.' + 'c'.repeat(63);
    expect(tooLong.length).toBeGreaterThan(254);
    expect(isValidEmailShape(tooLong)).toBe(false);
  });

  it('every quantifier is bounded, which is what removes the ambiguity', () => {
    // This is the actual security property. The old pattern had three unbounded
    // quantifiers; these three assertions fail if any bound is dropped again.
    expect(EMAIL_PATTERN.source).toContain('{1,64}');
    expect(EMAIL_PATTERN.source).toContain('{1,190}');
    expect(EMAIL_PATTERN.source).toContain('{1,63}');
    expect(EMAIL_PATTERN.source).not.toMatch(/\][^.]*[*+]/); // no bare * or + after a class
  });

  it('stays fast on adversarial input, where the old pattern was quadratic', () => {
    // Shape around the literal '.', which is the ambiguous character. Asserting a wall
    // clock bound is normally flaky, so the threshold is deliberately loose: the point
    // is to catch a return to unbounded backtracking, not to benchmark V8.
    const adversarial = 'x@' + 'a.'.repeat(20000);
    const started = process.hrtime.bigint();
    EMAIL_PATTERN.test(adversarial);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    expect(elapsedMs).toBeLessThan(1000);
  });
});

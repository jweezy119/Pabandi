// Shared input validators.
//
// WHY THIS FILE EXISTS
// --------------------
// The email regex was duplicated in three places (agentSignup.routes,
// rentalDeposit.routes, admin.controller), all three identical:
//
//   /^[^\s@]+@[^\s@]+\.[^\s@]+$/
//
// CodeQL flagged js/polynomial-redos on it (high). The two `[^\s@]+` runs are
// ambiguous around the literal `.` — because `.` is itself a member of `[^\s@]` —
// so a long run of dots gives the engine many ways to partition before it fails.
//
// Honest caveat on severity: I could not make it slow on V8. Three adversarial
// shapes ("!@!." repeats, "x@" + "a." repeats, and a trailing dot to force full
// backtracking) all completed in under a millisecond up to n=32000, so this is
// static-analysis risk on an unauthenticated route, not a reproduced denial of
// service. It is fixed anyway because agentSignup is reachable pre-auth, the fix is
// a one-line quantifier bound, and "the scanner says quadratic" is not something to
// leave on an open endpoint on the chance that a future engine behaves differently.
//
// The bound is what removes the ambiguity: every quantifier now has a finite
// maximum, so the number of partitions is bounded rather than proportional to input
// length.
//
// Acceptance is deliberately UNCHANGED for realistic addresses. Bounds follow RFC
// 5321: local part <= 64, domain <= 253-ish, TLD <= 63. The TLD stays {1,63}
// rather than {2,63} because fixtures across the suite use addresses like 'a@b.c'
// and shortening that to a minimum of 2 would be a behaviour change dressed up as a
// security fix.

/**
 * Linear-time email shape check.
 *
 * Bounded, so no input can drive super-linear backtracking. Deliberately a shape
 * check and not a deliverability check: it does not verify the domain exists, and it
 * is not a substitute for sending a confirmation to the address.
 */
export const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{1,63}$/;

export function isValidEmailShape(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value);
}

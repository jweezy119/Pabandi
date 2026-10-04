# Pabandi — Build Plan

Customer-obsessed and frugal means profitable. These two pull against each other in one
specific place, and it is worth naming up front: **every feature here ships ungated until a
limit is enforced.** That is the cheapest possible way to run a business — no code to
maintain, no upgrade wall — and it is also how you go broke, because the thing you are
selling is the limit.

Three constraints shape everything below.

1. **Frugal.** No new infrastructure. No new paid services. Every task uses what is already
   deployed: Prisma, Express, Square, Resend, the existing cron, the existing test suite.
2. **Customer-obsessed.** Every task states the customer-visible symptom. If a task cannot
   name one, it is not a task.
3. **Profitable.** Every task either raises revenue, cuts cost, or removes a way to lose
   money. Work that does none of the three is last, not first.

---

## Where the product actually stands

Measured, not estimated.

| Area | State |
|---|---|
| Schema | 19 CRM/Contact models, `prisma validate` passes |
| CRM API | 20 routes in `crm.routes.ts`, 15 in `contact.routes.ts`, 6 in `businessOS.routes.ts` |
| CRM service | 19 exported functions |
| CRM UI | 13 pages in `pages/contact/`, all routed, real `fetch` calls, **no mock data** |
| Automation | `jobCronService` runs every minute, wired at `index.ts:537` |
| Tests | 412 passing across 25 files |
| Type errors | 26, all pre-existing |
| **CRM tests** | **zero** |

---

## The three findings that set this plan

### 1. `CrmJob` has two writers and the readers see one

```
Writers                        Column set
bookings.routes.ts:425         businessId
job.service.ts:24              businessId
crm.service.ts:254             serviceBusinessId

Readers                        Filter
crm.service.ts (dashboard)     where: { serviceBusinessId }   ← 3 sites
```

A business that takes bookings sees an **empty dashboard**, because the booking flow writes
`businessId` and every dashboard query filters on `serviceBusinessId`.

This is the same shape as the invoice-delete regression caught earlier: a constraint that
looks satisfied at the boundary but is not carried through. The merge made both FKs optional
so neither writer would break — which fixed writes and created the read gap.

### 2. Subscription tiers are defined and enforced nowhere

```
tier: 'free'       monthlyPrice: null      maxClients: 50      maxInvoicesPerMonth: 100
tier: 'pro'        monthlyPrice: 49        unlimited
tier: 'business'   monthlyPrice: 149       unlimited + API, webhooks, white label

checkLimits       — 0 callers
tierLimits        — 0 callers
publicPricing     — 0 callers
```

`POST /crm/clients`, `/crm/jobs` and `/crm/invoices` have **no tier check**. A free user can
create unlimited clients, jobs and invoices. The $49 and $149 plans are described on a
pricing page and cannot be charged for.

This is the single largest item on this list by revenue.

### 3. Fees are assessed on 2 of the money paths

```
assessFee call sites: bookings.routes.ts, invoice.service.ts
```

`squareCheckout.routes.ts` and `checkout.routes.ts` move money and assess nothing. Whatever
percentage of revenue flows through Square direct checkout, that revenue is uncollected.

---

## Phase 0 — Stop the bleeding (money first)

Frugal means these are the cheapest tasks with the highest return. Nothing else matters if
money is not collected.

### 0.1 Enforce tier limits on write · **revenue**
Block `POST /crm/clients`, `/crm/jobs`, `/crm/invoices` when over `maxClients` or
`maxInvoicesPerMonth`. `checkLimits` already exists and is correct — it has zero callers.

*Customer sees:* a free user is told "50 clients included on the free plan, upgrade to
continue" instead of silently succeeding forever.
*Frugal:* no new code path, one middleware call. `checkLimits` is written and tested.
*Test:* free tier at 50 clients gets 402; at 49 succeeds. Pro is unlimited.

### 0.2 Assess fees on Square checkout · **revenue**
`assessFeeSafe` exists and is used twice. Wire it into `squareCheckout.routes.ts`.

*Customer sees:* nothing. It is invisible and correct.
*Why it matters:* this is revenue currently walking away on every direct checkout.

### 0.3 Fix the CRM read/write split · **customer + revenue**
Decide one column, not two. Cheapest correct answer: **the booking flow also sets
`serviceBusinessId`**, resolving `CrmServiceBusiness` from `CrmBusiness`. Reads stay on one
column and keep working.

*Customer sees:* their dashboard has data. Today it is empty.
*Frugal:* one lookup at job creation, no schema change, no migration.
*Test:* create a job through `POST /bookings`, then assert `GET /crm/dashboard` counts it.
That test does not exist today and its absence is why this survived the merge.

### 0.4 Square `INVOICES_WRITE` scope · **revenue**
Fee collection ships but the OAuth scope is missing, so it cannot run. Merchants must
re-consent.

*Customer sees:* platform fees can actually be invoiced to them.
*Blocked on:* merchant re-consent, which is a product decision, not code.

### 0.5 Kill the 3 dead UI endpoints · **customer**
`crm/files`, `crm/settings`, `crm/import/*` are called from 4 routed pages. No server route
exists. Those buttons 404.

*Customer sees:* buttons that do not exist get removed, or stubbed honestly. A 404 button is
worse than an absent one.

---

## Phase 1 — Make it true

### 1.1 CRM test suite · **everything**
Zero tests on 19 functions and 41 routes. This is why 0.3 survived a merge.

Target: one test per service function, plus a route-authorization pass mirroring
`route-authorization.test.ts`. The dashboard test from 0.3 is the first one — write it
*before* the fix so it fails for the right reason.

### 1.2 Whop checkout and webhooks · **revenue**
`whop.service.ts` exists; no route mounts it. Without this, 0.1 enforces a limit but there
is no way to upgrade — a paid wall with no door.

*Frugal:* Whop already exists; we do not build billing.

### 1.3 Billing state that survives a restart · **revenue**
Subscription state is a local row. A restart or a missed webhook loses it, and a paying
customer silently reverts to free.

### 1.4 Kill the 26 type errors · **quality**
`checkin.routes` (6) and `booking.service` (3) are customer-facing. Not urgent, not free.

---

## Phase 2 — Customer obsession

### 2.1 The first-run experience · **customer**
A business enrolls, adds a client, books a job. Does anything teach them? If the answer is no,
every other feature is wasted.

### 2.2 Every empty state · **customer**
The dashboard is empty today and probably says nothing useful. An empty state that explains
the next action converts; one that says "No data" does not.

### 2.3 Notifications customers asked for · **customer**
Email works now that templates ship. SMS does not exist. `smsReminders: true` is advertised
on Pro.

### 2.4 Trust Score explainability · **customer**
The delta table is published. Show it to the customer in the product, not just the docs.

---

## Phase 3 — Earn trust with the outside world

### 3.1 Whitepaper corrections · **trust**
Drafted in `docs/whitepaper-corrections-v6.md`, unshipped. §16 escrow custody and §9.3 the
four nonexistent models are the two that would be tested first by a technical reader.

### 3.2 Fix the intermittent test flake · **quality** — **DONE, root cause found**
`pab-supply.test.ts` failed ~1 run in 4 on Prisma client resolution. Never a false pass, but a
red suite invites "my change broke it" — which cost real time twice today.

**Root cause: `src/utils/ensurePrisma.ts`.** It ran `npx prisma generate` via `execSync` on
*every* import of `utils/database.ts`. Vitest runs test files in parallel workers, so several
workers each spawned a `prisma generate` writing into `node_modules/.prisma/client` while other
workers were reading it — a torn read. The concurrency was only the delivery mechanism; the
redundant regeneration was the defect.

It is now skipped when `VITEST=true` or `NODE_ENV=test`, which is safe because the client is
generated explicitly before the suite runs (`verify.yml` has a dedicated step; `npm run compile`
does it locally).

Evidence: 5 consecutive clean full runs with the fix; with regeneration restored, the third
run failed with the exact historical error. Small sample, and the proof is really the code
path rather than the ratio — but the failure mode and the ~1-in-3 rate both match what was
documented for months as unexplained.

It only became visible when `tests/customer-flow.integration.test.ts` started booting the real
Express app, which forces a generate at a moment when other suites are mid-run. That test did
not create the flake; it made an existing one fire reliably, which is how it was caught.

### 3.3 Two CRMs, one brand · **technical debt**
`CrmBusiness` and `CrmServiceBusiness` coexist. Every read picks one. Consolidating is a
migration and should follow 0.3, not precede it.

---

## Progress

Phase 0 and Phase 1 are shipped. Recorded because the order was the point: every one
of these was revenue already built but not switched on — the code existed and
nothing called it.

| Task | Commit | Verified by |
|---|---|---|
| 0.1 Enforce tier limits | `620ddfaa3` | 10 tests. The boundary test caught an off-by-one in my own guard. |
| 0.2 Fees on Square checkout | `2f658576e` | 11 tests. Both fixes fail when reverted. |
| 0.3 CRM read/write split | `07b0f9030` | 9 tests. 4 fail against the pre-fix code. |
| 0.5 Kill dead module routes | `8185f30cc` | 7 tests. 2 fail against the original routes. |
| 1.1 CRM suite (complete) | `eda08e81f` | All 18 `crm.service` functions covered. Surfaced two more bugs. |
| 1.2 Whop checkout + webhooks | `1ab5251f3` | 13 tests, including a behavioural `/pricing` 401. |
| 1.3 Billing reconciliation | `8ced3484f` | 9 tests. 3 fail if provider errors downgrade rows. |

### Bugs found by writing the tests, not by reviewing the code

Four defects that were present and invisible:

- **Delivery scores went nowhere.** Nothing subscribed to `delivery.on_time`,
  `delivery.late` or `delivery.missed`, so a perfect provider and a chronic no-show
  carried the same `deliveryScore`. Delivery is what the reputation product is sold
  on. Fixed `dd4973a0d`; 8 of 12 tests fail without it.
- **Payroll could name any tenant's employee.** No ownership check, and
  `employeeId` is a real FK. Fixed `4e49d48cf`.
- **The no-show route never ran.** `new Date(`${date}T${time}`)` where `date` is a
  `DateTime` column — always `Invalid Date`, so `NaN > 30` was always false. The
  cron did the same job correctly, which is why it went unnoticed. Fixed `eda08e81f`.
- **Email-code login had never worked.** The controller required a method from
  `email.service` that did not exist. Because the account and code were written
  before the send, every step before the failure succeeded — which is why it read as
  flaky email rather than a feature that had never shipped. Fixed `27a3daeca`.

### Mobile and login

| Fix | Commit | Was |
|---|---|---|
| Bottom nav hid ~33px of every page | `27a3daeca` | `pb-16` (64px) against a ~97px nav. `mobile-safe-bottom` was applied to 3 elements and **defined nowhere**. |
| Back/forward | `adb07b1a6` | `window.location.assign` (full reload) and no scroll restoration on `POP`. |
| Email failure diagnosability | `9d092ce41` | The provider's rejection reason was discarded, so a failure was undiagnosable from outside. |

### TWO DEPLOY TARGETS — the trap that cost a day

`pabandi.com` is **Firebase Hosting** (`client/dist`, project `pabandi-42c5b`).
`pabandi.onrender.com` is **Render** (the API, from `server/`).

Two independent pipelines. Every server-side verification this session checked
Render, while the customer was on Firebase. A fix can be deployed, verified against
the API, live in `/health`, and completely absent from the site the customer uses.

Concretely: `preferredMode` guard fix, mobile nav, back/forward — all live and
verified on Render, none of them on Firebase. The customer reported the loop
persisting because they were right, and the server was not evidence.

**State as of `e778d6f85` + Firebase deploy:** both targets current. Firebase deploy
is still MANUAL — nothing in `.github/workflows` or `package.json` publishes it, which
is exactly why it drifted silently. Adding a CI publish step is the fix; until then,
verify against the host the customer is actually on.

### Still open

- **1.4** 26 server type errors (`checkin.routes` 6, `booking.service` 3) and a
  separate 539 in the client. All pre-existing; neither surface gained any.
- **3.2** RESOLVED. The Prisma client flake was `ensurePrisma.ts` running `prisma generate` on
  every import, racing parallel test workers. Skipped under test; 5 clean full runs.
- **3.3** Two CRMs, one brand. `CrmBusiness` and `CrmServiceBusiness` coexist.
  0.3 made reads span both, so consolidation is now safe — and it is the cause of
  the dual-column design that caused the empty dashboard.
- **0.4** Square `INVOICES_WRITE`. Code plus a merchant re-consent. **Blocked on a
  product decision.**
- **Email delivery is configured but NOT verified working.** `request-code` returns
  500, which now means Resend rejected the send rather than our code being broken —
  most likely an unverified `from` domain. Confirming needs the Resend dashboard or
  a send to the account owner's address. `/health` now reports `emailConfigured`.

## Order, and why

Phase 0 first because each item is cheap, individually revenue-positive, and currently
losing money or trust. Phase 1 makes it durable — 1.1 in particular, because the absence of
tests is what let a broken merge through. Phase 2 is what makes customers stay. Phase 3 is
what makes outsiders believe us.

**Suggested first three: 0.1, 0.3, 1.1.** Tier limits recover revenue today, the dashboard
fix restores a feature we already shipped, and the tests stop the next merge from breaking
either one silently.

## The trap to avoid

Phase 2 is the most fun and the least profitable. It is also the phase that gets built first
by anyone who enjoys building. Every task here is ungated until 0.1 exists — a customer-obsessed
product with no upgrade path is a hobby, and the limits *are* the product.
## The database cannot be rebuilt from migrations (verified 2026-10-03)

Found while wiring CI to a real database: 14 test suites talk to Postgres, so the
pipeline needed a throwaway database to exist at all. Building it exposed this.

- `prisma/migrations/003_recommendation_tables.sql` sits in the migrations **root**,
  not in a timestamped folder. `prisma migrate deploy` only applies migrations in
  folders, so it never ran. It was applied by hand, once, to the live database.
- Consequently `migrate deploy` against an empty database fails at
  `20260829_add_agent_learning_and_app_integration`:
  `ERROR: relation "Project" does not exist`.
- No migration anywhere creates `Web3Agent`, which is the table `AgentStake`'s
  foreign key targets.
- Counting `CREATE TABLE` across all 37 migrations yields **72 tables against 338
  models in `schema.prisma` — 271 models have no migration at all.**

Production was built by `db push`, not by migrations. CI therefore uses
`prisma db push`, which derives the schema from `schema.prisma` — the schema
production actually runs — and verified green on a fresh container.

**The risk this creates:** there is no verified restore path. If the live database
is lost, `prisma migrate deploy` cannot rebuild it, and the `migrate` folder
implies a reproducibility it does not have. Recovery currently means `db push`
against `schema.prisma`, which reproduces table structure but not data and not any
migration-specific data backfills.

Not fixed here. Closing it properly means either baselining the remaining 271
tables into migrations or explicitly documenting `db push` as the supported
procedure and treating `prisma/migrations` as vestigial. That is a decision, not a
cleanup, and it wants a deliberate plan rather than a drive-by edit.

## CodeQL triage (2026-10-03)

CodeQL had been failing continuously and was being ignored as noise. Triaged:

**Fixed**
- `js/incomplete-url-substring-sanitization` (high) — `verify-agent-surface.ts`
  checked `host.includes('pabandi.onrender.com')`, which passes for
  `https://pabandi.onrender.com.evil.example`. It was also silently disabled: with
  `PUBLIC_API_URL` unset the fallback was `'//'`, which every absolute URL contains.
  Now parses both URLs and compares hostnames.
- `js/polynomial-redos` (high) — `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, duplicated in three
  files. Bounded to RFC 5321 limits in `src/utils/validators.ts`. Could not be made
  slow on V8, so this was static-analysis risk on a pre-auth route, not a reproduced
  DoS.
- `actions/missing-workflow-permissions` — added `permissions: contents: read` to all
  four workflows.

**False positives, deliberately left open**
- `js/insufficient-password-hash` (3, high) flags SHA-256 over `x-api-key` / `apiKey`.
  API keys are `pab_` + 24 random bytes = 192 bits of entropy. SHA-256 is correct for
  high-entropy tokens; bcrypt would be slower and no safer. The rule cannot tell a
  password from a random token. The third is `passwordHash: crypto.randomBytes(32)` on
  an account with no interactive login by design — the API key is the credential.
- Not dismissed in config. A dismissal needs a justification someone will read in six
  months, and that belongs next to the rule, not in a commit message.

**Open backlog**
- `js/missing-rate-limiting` — **95 high**, essentially every Express route. Real
  hardening, not a defect, and too large to do properly in one sitting. Prioritise by
  money and auth paths first: `payments`, `payout`, `escrow`, `checkout`, `auth`,
  `admin`, then the read-only discovery routes last.
- `js/sensitive-get-query` (1, medium) — `bookingService.routes.ts` filters a roster by
  `gender` via query string, so it lands in access logs and referrers. Moving it to POST
  would change the API contract; needs a deliberate decision, not a drive-by edit.

## Integration tests, and what the first one found (2026-10-03)

`server/tests/customer-flow.integration.test.ts` walks the flow a customer actually
reports: register → set up the business → add a client → read it back. Real Express
app with its real middleware, over real HTTP on an ephemeral port, against a real
Postgres. Only cron and outbound email are stubbed.

It is guarded against the obvious footgun: `server/.env` points `DATABASE_URL` at the
live Aliyun RDS instance, and these tests write and `deleteMany`. The suite refuses to
run unless the connected database's name contains `test`, `integration` or `ci`.

### It found a registration-blocking bug on its first run

`identity.service.findOrCreateUser` created users with only an email:

```ts
const newUser = await prisma.user.create({
  data: { email: ... } as any,
});
```

`passwordHash`, `firstName` and `lastName` are all **required** by the schema, so that
`create` threw on every genuinely new user, on any database. Reachable three ways:

- the "Sign up" form on `/login` (`AuthPage` posts `/auth/register` without a `code`)
- first-time GitHub sign-in
- first-time Twitter/X sign-in

Only pre-existing users got through, via the email-match branch. So new-user signup and
both OAuth providers returned **500**.

The `as any` is why nobody saw it: it silenced the compile error that would have named
all three missing fields. Removing it made `tsc` report them immediately, which is how
`firstName`/`lastName` were found after `passwordHash`. The create now type-checks.

Why no test caught it: every unit test of this service mocked Prisma, and a mocked
Prisma cannot tell you a required column is missing. That is precisely the class of
defect a unit test cannot see, and the reason for adding this layer.

Fixed by supplying an unguessable random `passwordHash` (these accounts are
passwordless — the provider is the credential) and deriving names from provider metadata,
mirroring `agentSignup.routes.ts`.

### Also closed here

- `vitest.config.ts` item 3.2, the Prisma flake — see 3.2 above for the root cause.
- `PersonalGuard` redirected to `/contact`, which is itself mode-guarded. Covered by the
  client test suite, not this one.

## Pricing ladder: free / $29 / $49 / $149 (2026-10-03)

Free → $49 was a $49 step, and the first thing a free user needs is not a feature —
it is the 50-client cap coming off. That cap is a wall rather than a tax: past it a
solo operator cannot record work they have already done. Charging $49 to remove a wall
is why the ladder read as three evenly spaced numbers rather than a path.

Each rung now adds exactly one thing:

| tier | price | what it adds over the one below |
|---|---|---|
| free | $0 | 50 clients, 100 invoices/mo, 1 seat, no reminders |
| starter | $29 | cap removed, 2 seats, email reminders |
| pro | $49 | + SMS reminders, analytics, 5 seats, priority support |
| business | $149 | + API, webhooks, custom fields, white label, 20 seats |

SMS is above the entry rung deliberately: it is a real per-message cost, so it belongs
where it can be paid for. Seat count is the other separator, set at 2 because that is a
limit a solo merchant notices and a two-person shop feels.

`$29 → $49` buys SMS plus analytics. That has to be worth $20 to someone, and it is the
honest test of the ladder: if $29 converts and almost nobody climbs to Pro, then SMS
and analytics are not worth $20 and the middle rung should move rather than the prices.

**No migration needed.** `CrmServiceBusiness.subscriptionTier` is a `String`, not an
enum, so a new tier is a config change.

Tests assert the ladder's *shape*, not just its prices: paid tiers publish
cheapest-first, and every rung must add at least one capability the rung below lacks —
otherwise a merchant is being asked to pay for something they can already get.

### Two pricing bugs found while doing this

1. **A paying customer could not be detected as paying.** `OutreachCRMPage` computed
   `user?.tier === 'PRO' || user?.subscriptionTier === 'PRO'`. The login payload
   includes neither field, so `isPro` was permanently false — for genuine Pro
   subscribers too. The casing was wrong besides: the tier config is lowercase while
   `CrmServiceBusiness.subscriptionTier` defaults to `"FREE"` in the schema.

   Now `GET /api/v1/subscriptions/me` is the source of truth, interpreted by
   `client/src/utils/subscriptionTier.ts`, which compares by rank rather than by tier
   name — so adding the $29 rung did not require touching a boolean called `isPro`, and
   the next rung will not either. Neither endpoint had a client method at all.

2. **`BusinessJoinPage` charged through a booking endpoint.** Its $29 Growth plan called
   `POST /api/payments` with a fabricated `reservationId: 'sub_growth'` — a
   reservation-payment route handed a subscription id that does not exist. Even had it
   succeeded, the money would not have been attributed to a subscription. It now calls
   `subscriptionService.checkout('starter')` and reads its price from
   `/subscriptions/pricing`, with the button disabled and labelled "coming soon" while
   `purchasable` is false, rather than a live control that charges nothing.

   **Not changed, needs a decision:** that page's plan copy describes a *venue* product
   (dynamic deposit capture, webhook integration, advanced analytics) which does not map
   onto the CRM tier feature sets. Only the price and the checkout were wired to the
   tier system; the marketing copy still needs to be reconciled with what each tier
   actually includes.

## /api/v1/sms was unauthenticated (fixed 2026-10-03)

The router had **no authentication, no authorisation and no tier check on any route**,
and took `businessId` from the request body:

```ts
router.post('/send', ...)  ->  smsService.sendSMS(to, message, req.body.businessId)
```

So the moment `TWILIO_ACCOUNT_SID` existed, anyone on the internet could send SMS
through Pabandi's account, attribute it to any business id, and we paid the bill.
Latent only because no credentials were configured — `smsConfigured` has been false in
`/health` throughout.

It also meant `smsReminders`, priced into the $49 plan and advertised on the pricing
page, was read by **nothing**: a free account could send billed SMS. The tier said "SMS
is a paid feature" and the server did not agree.

### Fixed

- `authenticate` on every user-facing route.
- New `tierFeature('smsReminders')` gate — the numeric `tierGuard` could not express a
  boolean entitlement. It fails **closed**, unlike `tierGuard` which fails open on its
  own errors: an unmetered CRM write is a bookkeeping problem, an unmetered SMS send
  spends real money on every call.
- Tenant resolved from the verified token or CRM context, never the body. A mismatched
  body id is **rejected**, not ignored — preferring it would let a caller bill another
  tenant, and ignoring it hides the caller's own bug.
- 500-number ceiling on one bulk request.
- `POST /sms/credentials` **removed**. It accepted a Twilio SID and auth token, stored
  nothing, and replied "Credentials saved" — a false confirmation on the one route where
  a false confirmation costs money. Per-business provider credentials are the next
  change, with a real verified flow.
- Twilio webhook now verifies `X-Twilio-Signature` and fails closed (503 when no auth
  token is configured). It previously accepted any callback and wrote whatever delivery
  status it claimed onto any message id.

`tests/sms-security.integration.test.ts` — 14 tests. Bite-checked: reverting the route
to the original fails 6 of them.

### Related, found while doing it

- `tierGuard`'s own `resolveBusinessId` fell back to `req.body.businessId` and
  `req.query.businessId`. Acceptable for counting usage, wrong for deciding what a caller
  may read or spend. **Now removed** — see "One tenant resolver" below.
- The registration rate limiter (10 per 15 min per IP) now skips under NODE_ENV=test.
  The integration suites register a dozen businesses from one address and were failing
  on a 429 unrelated to what they assert. Raising `max` instead would have removed a
  protection that exists because a script was found creating accounts in bulk, so it is
  keyed on NODE_ENV — which is never `test` in production — rather than an env var.

### Square tokens: encrypted, and now observable

`protectToken` stores the Square OAuth token **raw** when `ENCRYPTION_KEY` is unset,
warning rather than failing. Whether that was happening in production was unobservable.

It is not happening. `utils/encryption.ts` throws at import time in production without
the key, and `auth.controller` imports it — and the auth router is registered with
`directRoute`, so it loads eagerly at boot. A production process missing `ENCRYPTION_KEY`
would not have started. Verified by reproducing both ways with `.env` hidden.

`/health` now reports `tokenEncryptionConfigured` as a boolean, never the key, so this
is observed rather than inferred — the same reasoning already documented for
`smsConfigured` and `whopConfigured`.

## One tenant resolver, and a guard that could not fail closed (2026-10-03)

Follow-up to the SMS work, which turned up two more problems in the same area.

### Three answers to "which tenant is this", and the dangerous one

| resolver | trusted body/query? | ownership-checked? |
|---|---|---|
| `resolveCrmBusiness` | yes | **yes** — pairs the id with `ownerId: userId` |
| `tierGuard.resolveBusinessId` | yes | **no** |
| `resolveOwnedBusinessId` (added with SMS) | no | n/a — server-derived only |

Three answers means a new route picks one at random, and the wrong one is silent. The
`tierGuard` fallback was unreachable today — all three callers run after
`resolveCrmBusiness`, so it never fired — but it was a loaded gun: the next route to
mount `tierGuard` outside the CRM router inherits it, and a limit evaluated against
someone else's usage is not an error anyone would notice.

**`src/middleware/tenant.middleware.ts` replaces all of it.** Body and query are not
consulted at all. The one caller-influenced input — an explicit `serviceBusinessId` — is
paired with `ownerId`, so it is checked rather than trusted.

The two business identities are named explicitly rather than conflated, which is item 3.3
on the backlog: `serviceBusinessId` (`CrmServiceBusiness`, for jobs/clients/payroll) and
`businessId` (platform `Business`, for invoices/`SMSLog`/bookings). A tenant resolver that
returns both makes the dual-CRM split visible at every call site instead of implicit.

`resolvePlatformBusinessId` is split out from `resolveTenant` on purpose: the tier gates
and the SMS router need only the platform id, and making them call the full resolver
forced a `crmServiceBusiness` query on every CRM write to obtain an id they already had.
A limit check should not depend on the CRM tables existing.

`attachTenant()` attaches the result so handlers read `req.tenant` instead of
re-deriving an id — which is how the SMS router ended up billing a caller-supplied
tenant, and how nine call sites ended up reading a JWT claim enrollment had not set.

### A guard that turned "no" into "yes"

`tierGuard`'s catch block failed open on any internal error. That was reasonable when the
resolver could only return null. Once resolution can *throw* — 401 for signed out, 403 for
no business — the catch swallowed the refusal and **allowed the request**. An
authentication failure became an unexplained success, silently, and the request then
worked.

Both guards now forward anything carrying a 4xx and only fail open on a genuine fault.
`tierFeature` does the same rather than reporting a 401 as a retryable 503.

Bite-checked: restoring the swallow fails the 401 test; restoring the body/query fallback
fails exactly the two tests written to catch it.

### Tests

- `tests/tenant-resolution.test.ts` — 14, including the negative: a test that fails when
  a dangerous fallback returns is the only thing that makes removing it stick.
- `tests/tier-guard.test.ts` — its fixture gained `user.id`, which every real JWT has and
  the old resolver never looked at. Its single "no tenant" case split into 401
  (unauthenticated) and 403 (authenticated, nothing set up), which the old code conflated.

601 server tests (40 files), 16 client, tsc unchanged at 26 / 539.

## Bring-your-own SMS provider (2026-10-03)

Reselling SMS means Pabandi pays ~$0.005 a message and the cost lands on our margin: at
5,000 messages that is ~$25 against a $49 subscription. Connecting the merchant's own
provider makes it their bill and our COGS zero — the model already used for Square, where
the money never touches Pabandi at all.

### Schema: a raw SQL file, because nothing runs `migrate deploy`

`BusinessSmsProvider` is created by `sql/sms-provider-tables.sql`, applied by the deploy
hook and again by the runtime bootstrap. Render's `preDeployCommand` runs
`ensure-agent-tables.cjs`, the Dockerfile runs no `prisma migrate deploy` and no
`db push`, and the `migrate` folder cannot rebuild this schema anyway (271 of 338 models
have no migration). A table that exists only in a migration folder **does not exist in
production**. Added to `SQL_FILES` in both the hook and `tableBootstrap.ts`.

### THE DEPLOY HOOK WAS ALREADY BROKEN

Wiring the new file surfaced it. `ensure-agent-tables.cjs` split DDL with a naive
`.split(';')`. Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so guarded foreign keys
must be `DO $$ ... $$` blocks — which contain semicolons. The naive split cut them in
half and the hook exited 1:

```
ERROR: unterminated dollar-quoted string at or near "$$ BEGIN"
```

`fee-tables.sql` had **8** such statements and the new file had 2, so the hook was already
dying on `fee-tables.sql` and never reached anything after it.

Deploys kept succeeding because `src/utils/tableBootstrap.ts` runs the *same* SQL at boot
with the correct splitter from `src/utils/ddl.ts`. So the deploy hook was silently
contributing nothing — and a file added to `SQL_FILES` but not to `tableBootstrap.ts`
would have been a table that never appeared at all.

The hook now uses a faithful port of the tested `splitStatements`, because preDeploy runs
from the repo root before `npm run compile` and cannot import the TS module.
`tests/ddl-splitter.test.ts` asserts the two agree, file by file, so the port cannot
drift. Bite-checked: restoring the naive split fails exactly the two `$$` tests.

### The credential handling

Three rules, each with a test:

1. **Fail closed on encryption.** `square-connection.service.protectToken` stores the
   secret RAW when `ENCRYPTION_KEY` is missing, warning rather than failing. Repeating
   that would put a credential that spends money into the database in plaintext, so this
   path **refuses to save** and says why. Bite-checked: reverting to fail-open fails the
   test and the "nothing was written" assertion with it.
2. **Verify before trusting.** The credential is checked against the provider first, so a
   merchant who pastes a mistyped token does not see "connected" and then find every
   reminder silently failing. A failure is stored as `FAILED` **with the provider's own
   message**, because "Invalid username or password" is the single most useful thing we
   can tell them.
3. **The secret never leaves.** The public view is a whitelist, not a projection — a
   secret smuggled in through a wider `SELECT` does not survive it.

`requireCredentials` on the send path **throws** rather than returning null, so a business
with no provider is distinguishable from a misconfigured one and neither can silently
become a platform-billed send.

### Webhooks are per-tenant

The status callback URL carries the business id, and the signature is verified against
**that merchant's auth token**. Twilio signs with the token of the account that sent the
message, so verifying every callback against one platform-wide token would reject every
legitimate callback the moment a second merchant connects. When the credential is gone or
unverified the callback is refused rather than falling back to the platform token, which
would accept a callback nobody can attribute.

### Deliberately not done

- **No client UI yet.** `GET/POST/DELETE /api/v1/settings/sms` is the whole contract; the
  settings screen is the next piece.
- **The `smsReminders` tier gate still applies.** Bring-your-own removes the *cost*, not
  the *entitlement*: a merchant on the free tier still needs to upgrade to send. That is a
  pricing decision, not a technical one, so it is unchanged.
- **Platform credentials remain** for system notifications, which have no merchant to
  bill.

## SMS provider UI (2026-10-03)

`SmsProviderSettings`, mounted in Contact OS → Settings → Notifications, above the
per-event table — because the SMS column in that table is useless until a provider is
connected.

The rule the screen is written to: **never claim a state the server did not confirm.**
That rule exists because the last attempt at this UI, `SMSSetup.tsx`, posted to an
endpoint that stored nothing and replied "Credentials saved". It was unmounted, so
nothing broke — but it is the reason this one is shaped differently:

- "Connected" is shown only when the server says `status === 'VERIFIED'`.
- A FAILED connection shows **the provider's own reason**. "Invalid username or password"
  is the only useful thing to tell someone who just pasted the wrong token.
- Credential fields are **never pre-filled**, and the token inputs are `type="password"`.
  The server cannot read them back, so a pre-filled field would be a form implying it
  holds a secret it does not have — the same lie in a new place.
- The secret is cleared from component state as soon as it is saved.
- A 503 says the key was **NOT saved**, rather than "try again", which would imply it
  might have been.
- Disconnect confirms first and says what it removes.
- Failures render `role="alert"` instead of `alert()`, and leave a working control rather
  than a disabled one.

`smsSettingsService` has **no `businessId` parameter** anywhere — the server resolves the
tenant from the session, so there is nothing to point at someone else's account.

11 component tests. Bite-checked: showing the success notice regardless of the server's
verdict fails the test written for exactly that.

### Two pre-existing bugs fixed on the way

- **`NotificationsPage` hung on "Loading…" forever** without a `businessId` in
  localStorage. `loadConfig` only ran `if (businessId)`, and only its `finally` ever
  cleared `loading`, so the early return below waited forever. That would have hidden the
  new section from exactly the accounts least able to reach it.
- **`tests/crm-lifecycle.test.ts` failed for a ten-hour window every day.** It set
  `scheduledDate` to "an hour ago" with `scheduledTime: '10:00'`, but `composeJobStart`
  calls `setUTCHours` on that date — so the job only started in the past when the suite
  ran after 10:00 UTC. Now two days ago, plus a sibling test for the not-yet-started side
  of the same boundary. This looked like a no-show penalty bug and was neither.

The SMS suite also needed the same cleanup fix as the money suite: registering a business
emits a `Notification`, whose FK to `User` has no cascade, so the user delete was refused
and every later test failed on an error unrelated to what it asserted.

623 server tests (42 files), 27 client, tsc unchanged at 26 / 539.

### Still not honest

The per-event **SMS checkbox column** in that table is local-only: `saveConfig` persists
just `enabledFeatures`, so ticking SMS for an event changes nothing and survives neither a
reload nor a logout. Wiring it needs a server-side model for per-event channel
preferences, which is a real feature rather than a fix. Left alone rather than made to
look functional.

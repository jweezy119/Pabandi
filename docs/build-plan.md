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

## WhatsApp / OpenWA reachability (2026-10-03)

Finishing the question "are the OpenWA routes still ready for WhatsApp". The answer was
**no**, in three separate ways.

### A dead registration was shadowing the working routes

`/api/v1/whatsapp` pointed at `./routes/whatsapp.routes`, which has never existed.
Because routes mount with `app.use` — which matches subpaths — the lazy stub swallowed
every `/api/v1/whatsapp/**` request with a 500, **including the working
`/whatsapp/advanced/*` registered on the very next line**. Verified on production: opt-in,
smart and advanced/capabilities all returned the same "Cannot find module" 500.

### …and those advanced routes had no authentication either

They were unreachable only by accident. Unblocking them without adding auth first would
have turned a broken endpoint into an **open** one — `POST /smart-action` sends real
WhatsApp messages to real customer phone numbers. So auth went on first, along with a
tenant check so a logged-in user with no business cannot send as nobody.

### AND TWO MORE DEAD REGISTRATIONS

`tests/route-registration.test.ts` asserts that every lazily registered module exists on
disk. It found two more on its first run:

| registration | module | live client caller |
|---|---|---|
| `/api/v1/onboarding` | `onboarding.routes` | `OnboardingWizard` → `POST /onboarding/complete` |
| `/api/v1/dashboard` | `dashboard.routes` | `BusinessDashboard` → 4 endpoints |

**`/dashboard` is a routed page and is currently non-functional.** All three
registrations removed, so they 404 honestly instead of 500 mysteriously. Reinstating them
means writing the APIs — a feature, not a fix.

The test also had to be corrected. My first version asserted that no registered prefix
shadows another, which produced **24 false positives**: `app.use('/a', …)` matches `/a/b`,
but the stub delegates with `next()`, so the child is still reached. The WhatsApp case was
fatal for a different reason — the parent module failed to load, so it never delegated. The
assertion now tests the compound property that actually breaks routes: *a registration
whose module is missing, and which has children.*

### Client features that called endpoints which never existed

Three WhatsApp client features were calling 404s:

- `smartAction` posted to `/api/v1/waitlist/lead/:id/smart-action` — no such route. Now
  points at `/api/v1/whatsapp/advanced/smart-action`, which exists and takes exactly the
  `{ intent }` body it was already sending.
- `saveAutomations` posted to `/api/v1/whatsapp/smart` and then alerted **"Automation
  rules saved" without looking at the response** — a false confirmation on a control whose
  entire purpose is to report whether a save happened. It checks the response now, and
  says the toggles are not persisted.
- `WhatsAppOptIn` said "Failed to save. Please try again." for an endpoint that has never
  existed, so retrying could never succeed. Consent capture needs its own stored record —
  and for WhatsApp marketing, not having one is a compliance problem rather than a missing
  endpoint — so it now says the feature is unavailable rather than implying a transient
  fault.

### OpenWA was reporting numbers it invented

`GET /api/v1/openwa/stats` returned hardcoded `messageDeliveryRate: 0.98` and
`uptime: '99.9%'` with a 200, whether or not a message had ever been sent. Anyone reading
that would conclude the gateway was healthy and 98% of messages were landing — the
opposite of the truth in every environment this has run.

Now `null`, with `deliveryStatsAvailable: false` explaining why. Session counts stay real.
`/stats` and `/sessions` also answer **503 naming the configured gateway URL** instead of
an opaque "Internal Server Error", because "point it somewhere else" is the actual fix and
the usual cause is still the default `localhost:2785` in a deployed environment.

637 server tests (44 files), 27 client, tsc unchanged at 26 / 539.

## The stale-tab problem, and a detector for it (2026-10-03)

Reported again: clicking Contact OS bounces to the homepage, after that had been fixed and
verified in the deployed bundle. The console named a bundle hash,
`assets/index-Dop2oh0W.js`, that **no longer existed on the server**.

### What was actually happening

`curl https://pabandi.com/assets/index-Dop2oh0W.js` returns **HTML**, not JavaScript —
Firebase rewrites `**` to `/index.html`, so a request for an asset that is gone comes back
with a 200 and an HTML body. The trace's only API call was
`GET /api/v1/trust-profile/stats/count`, which exists in exactly one place:
`LandingPage.tsx`. So the tab was on the landing page — which is precisely where the old
`BusinessGuard` sent a personal-mode account, before it was changed to render the mode
gate.

The live bundle contained the gate's strings, so **the fix was deployed and the tab was
not running it.** Two settings that are individually correct combine to cause this:

- `assets/**` is served `max-age=31536000, immutable` — correct, because filenames are
  content-hashed, so a cached bundle can never be stale *for its own hash*.
- `**` rewrites to `/index.html` — correct for client-side routing, and the reason a
  missing chunk is HTML instead of a 404.

Nothing told the open tab to reload. This project has been bitten by this shape of problem
repeatedly: the two-day site drift where the API was current and the site was not, and a
Save button that "did nothing" because the browser ran pre-fix code.

### `client/src/utils/staleTab.ts`

Fetches the server's `index.html` with `no-store`, reads which bundle it references, and
compares that with the bundle this tab loaded. If they differ, it reloads **once**, with
`location.replace` so the stale entry is not left in history for Back. It also re-checks on
`focus` and `visibilitychange`, so a tab left open across a deploy picks it up on return
rather than needing a manual refresh.

Three properties, each tested:

- **Never a loop.** Guarded by `sessionStorage`, keyed on the server build, so it reloads
  once per deploy and again only when the server moves to a *further* build.
- **Never reloads when the check itself fails.** A network blip must not lose someone
  mid-transaction, and a refresh loop is worse than a stale tab.
- **Never guesses.** No bundle on either side means no decision.

15 tests. Bite-checked: removing the loop guard fails the once-per-build test.

Two bugs found while writing it, both mine:

1. **It would have reloaded on every page load.** The normalisation stripped `^index-` from
   a value that is a full `/assets/index-X.js` path, so the two sides never matched. The
   once-per-build guard hid it — it fired once and then looked like it was working.
2. **`buildSha` was tree-shaken.** Exported but imported by nothing in the app, so Rollup
   dropped it and the sha never reached the bundle. It is now written to
   `<html data-build>`, which is both the fix and a useful answer to "which build are you
   running?" — the bundle hash is unreadable, a short sha is not.

### The smoke check that was missing

`scripts/smoke.mjs` verified the API's `commitSha` and that the shell was uncached. It did
**not** verify that the artifact the customer downloads was built from that commit — which
is the exact gap this episode fell through.

It now asserts the published bundle contains the expected sha. Run against the bundle
deployed before this change it fails correctly:

```
✗ bundle was built from the expected commit
  ca597f7 not found in assets/index-CasA4obP.js — this bundle is from a different commit
```

`BUILD_SHA` is wired from `github.sha` in both workflows. Without a real value it is
`'dev'` and the marker would be missing in production while every local test still passed.

### The immediate unblock

A hard refresh. The fix for the Contact OS bounce was deployed at `13954c7c6`; a tab that
predates it will keep reproducing the old behaviour no matter what else changes.

## Payment webhooks were sharing a rate-limit bucket with human traffic (2026-10-03)

The 95 `js/missing-rate-limiting` CodeQL alerts look alarming and are largely
misleading: `app.use('/api/', rateLimiter)` covers every route under `/api/`, and
CodeQL cannot see a global `app.use`. So the real severity was much lower than "95 high".

Following that thread found something worse.

### The measurement

```
POST /api/v1/square-checkout/webhook   x105   -> all 401, no 429
GET  /api/v1/health                    x120   -> 429 at request #64
```

`/health` should have allowed 100 requests. It refused at 64 — because the webhook burst
had already spent part of the **same counter**. The two paths share one per-IP budget of
100 requests per 15 minutes.

### Why that is a money defect

Square emits an event per payment state change, from shared Square IPs. A busy merchant's
webhook traffic therefore competes with every other request from the same address, and all
Square merchants share Square's addresses. When the bucket empties Square gets a 429, and
until it retries we have not recorded the payment event.

Provider callbacks are not a DoS surface — an unauthenticated flood of webhook POSTs
cannot do anything, because the handler rejects it on the signature. And a 429 is not a
useful answer to a provider: it cannot fix it and will not stop retrying.

### Fixed

The global limiter now skips provider callback paths. Skipped: `/webhook` (with or without
a subpath), `/webhooks/<subpath>`, anything ending in `-webhook` or `-webhook/<subpath>`,
and `/callback/<subpath>` — the last because OAuth redirects are user-initiated, protected
by the `state` parameter rather than an IP budget, one request per login, and a 429 there
is a confusing broken sign-in the user cannot retry out of.

Every ordinary `/api/` route keeps its limit, including ones that merely contain the word:
`/api/v1/webhook-templates`, `/api/v1/notifications/webhook-settings` and
`/api/v1/subscriptions/webhooks` — the last being a real merchant-facing write surface.

### Two tests, because the first one could not fail

`tests/rate-limit-webhooks.test.ts` asserts the path predicate. Its bite check — delete
`skip:` from the limiter and re-run — **passed**, because nothing connected the predicate
to the middleware. That is the failure mode this project keeps hitting: a test that looks
like coverage and cannot fail.

`tests/rate-limit-integration.test.ts` therefore fires real requests through the real app
with `RATE_LIMIT_MAX_REQUESTS=2`, and asserts the asymmetry: `/health` and
`/subscriptions/webhooks` get 429, `/square-checkout/webhook` and `/openwa/webhook/incoming`
never do. Removing `skip:` now fails exactly those two.

The first version of the regex also over-matched — `\/webhook-` caught
`webhook-templates` and `notifications/webhook-settings`, quietly unmetering them. Caught
by the test asserting ordinary traffic is still limited, and by a probe over 18 real paths.

### The remaining 95 alerts

Not fixed by adding 95 limiters. Every route already sits behind the global limiter, and
sprinkling per-route limiters on routes that have one is churn that breaks provider
callbacks. If specific routes need tighter budgets than 100/15min, the ones that justify it
are auth (`authRateLimiter`, `strictApiLimiter` exist for this) and money writes
(`writeLimiter` exists). That is a prioritisation pass, not a bulk edit, and it is not done.

## CRM P0: a dead page and three missing security gates (2026-10-03)

An audit of the CRM surfaced more broken and insecure wiring than missing features. The
three most severe were verified by hand before acting.

### 1. `/crm` threw on every request

`ServiceBusinessDashboard.tsx` referenced three identifiers that were never declared in the
file:

```
${API}${path}          line 20   — ReferenceError before the fetch
${PM_API}${path}       line 28   — ReferenceError before the fetch
unwrapError(err, ...)  line 100  — ReferenceError in the catch that reports failures
```

The page is mounted at `/crm`, so it threw on every call and rendered nothing. Because the
throw happened *before* the fetch, it looked like a network problem rather than a code one.

`pmApi` had a second bug: it did `return res.data` on a `fetch` Response, which has no
`.data` — so it always resolved to `undefined` and every property/tenant/maintenance list
rendered empty even once the base URL existed.

Client tsc went 539 → 534: the undefined globals were counted errors all along.

### 2. Cross-tenant employee writes

`PUT /crm/employees/:id` and `DELETE /crm/employees/:id` updated and deleted `crmEmployee`
**by primary key with no tenant predicate**. Any authenticated caller could rewrite any
employee on the platform — including changing someone's `payRate`, which needs nothing more
than an employee id.

`crm.service.ts` documents this exact bug class at length for payroll and fixes it there;
these two inline handlers were written afterwards and missed it. Now scoped with
`crmScope`, answering **404** for both "not yours" and "does not exist" so the endpoint
cannot be used to enumerate ids across tenants.

### 3. Thirty-two routes with no authentication at all

| router | mount | routes |
|---|---|---|
| `reports.routes.ts` | `/api/v1/reports` | 6 |
| `apiKey.routes.ts` | `/api/v1/api-keys` | 3 |
| `paymentMethods.routes.ts` | `/api/v1/payment-methods` | 4 |
| `crmAdvanced.routes.ts` | `/api/v1/crm-advanced` | 19 |

Rent generation, late fees, lease renewal, inspections, maintenance vendors, cashflow, API
keys, payment methods, revenue and trust reports — each taking a tenant from the query
string, with no caller identity. All 32 are business-scoped reads/writes; none is a webhook
or otherwise public, so all now require a session via `router.use(authenticate)` rather than
per-handler, so a route added later is covered by default.

`tests/router-auth-regression.test.ts` probes **every** route in all four files rather than
one per router, and asserts the probe list matches the number of routes declared in the
source — so the list cannot silently fall behind as routes are added.

Bite-checked: removing `router.use(authenticate)` fails 27 of the 33.

### Also noted, not fixed

`/api/v1/api-keys` is registered twice in `index.ts` (lines 367 and 425). Harmless — the
first lazy stub handles it — but it should be one line.

**Reports still read a tenant from the query string.** Authentication is now required, but
an authenticated caller can still pass another tenant's `businessId`. That is the next thing
to close here, and it needs the `serviceBusinessId` split below resolved first, because
`reports.service.ts` filters on the platform `businessId` while `crm.service.ts` writes only
`serviceBusinessId` — which is also why `/contact/reports` is always empty for CRM data.

### Verified

696 server tests (48 files), 42 client, server tsc 26, client tsc 534 (improved from 539).

## Route-level code splitting (2026-10-03)

Asked what would make the site smoother on mobile. The answer turned out to be one
mechanical problem, measured rather than guessed.

### Before

```
entry bundle   3,853 KB raw  →  930 KB gzipped,  in ONE file
JS files in dist                2
eager page imports in App.tsx  221
```

221 static imports meant every page, and everything they pull in, shipped as one bundle a
phone had to download before anything rendered. On a mid-range device over 3G that is
roughly twenty seconds of blank screen. Nothing about the CSS, images or rendering was
worth touching first — this was.

### After

```
entry bundle     182 KB raw  →   37 KB gzipped
JS chunks          258       (was 2)
first load       512 KB gzipped across 7 files   (was 930 KB in 1)
```

**First-load weight down 45%, entry down 96%.** Each route now downloads only itself.

### What was done

- All 221 page imports became `lazy()`, with a `<Suspense>` boundary inside
  `AnimatePresence` so the fallback participates in the same transition as the page it
  replaces. Outside it, every navigation would play the exit animation and then hold on a
  blank frame.
- The 9 non-page imports stay **eager on purpose**: providers, auth store, API client and
  the layout shell are needed by nearly every route, so splitting them would add a
  waterfall and save nothing.
- Four heavy *components* (`TrustStakingPortal`, `StakingInterface`, `EscrowInterface`,
  `AgentInterface`) also deferred. They render on one route each and drag in the wallet,
  Solana, QR and map libraries — the largest thing still in the first load after route
  splitting.
- `manualChunks` in `vite.config.ts` groups React, the router, motion and the heavy vendor
  libs, so they are fetched once and cached independently of app code instead of being
  duplicated into every lazy chunk.

### The lesson in the chunk config, learned twice

A manual chunk is a unit, so putting a small always-needed library in the same bucket as a
large rarely-needed one makes the bucket cost the sum of both, on every visit.

- `react-icons` shared a bucket with solana/leaflet, so the single `react-icons` import in
  the eager graph pulled in 345 KB of wallet libraries.
- `axios` shared that bucket too, and `apiClient` is used by the eager auth store — so
  axios being needed meant solana came along for the ride.

Both are now separate chunks (`icons`, `http`). This is the same shape as the deploy-hook
splitter bug: a grouping decision that looks free and quietly costs everyone.

### What is still on the critical path

`heavy` (81 KB gz) is still preloaded, and the reason is **not** the entry chunk — the
entry does not import it. Vite preloads the dependency chain of the **initial route**, so
`heavy` is reachable from the landing page's own closure, most likely a map or wallet
component in it. Trimming that means deferring those inside the landing page, which is a
separate, deliberate change.

`vendor` is 282 KB gzipped and is the catch-all for everything not matched above. It needs
a real look at what is actually in it before it can be split meaningfully.

### Verified

Client 42 tests (4 files), tsc unchanged at 534, build exit 0, no service worker emitted,
258 chunks in place of 2. `chunkSizeWarningLimit` raised to 1200 KB so that a genuine
regression in a deliberate chunk is still visible.

## CRM deals: the endpoint the pages were already built for (2026-10-03)

`ContactDealsPage` and `ContactDealDetailPage` have been complete for some time —
`DealKanbanBoard`, `DealListTable`, `DealFormModal`, `CSVImportModal` — and all of them
fetch `/api/v1/crm/deals`. That endpoint did not exist. Every load 404'd and both pages
rendered empty. Not a polish item: an entire feature wired to nothing.

### There were three Deal models

| model | anchor | status |
|---|---|---|
| `Deal` | legacy Abode, via `AbodeManager` | **orphaned** — 0 reads, 0 writes, `prisma.deal` used 0 times, and nothing ever created an `AbodeManager` row |
| `ContactDeal` | `lead.ownerId` — personal, not per-business | live, but wrong granularity and missing `probability`/`lostReason` |
| `CrmDeal` | `businessId` | **already business-scoped, and a field-for-field match for the client** |

`CrmDeal` is what the UI was written against: `clientId` → `CrmClient`, the same six-stage
vocabulary (`LEAD…LOST`), `probability`, `lostReason`, `notes`, `expectedCloseDate`. No
client change was needed at all — the pages were already correct, the server was empty.

I first set out to consolidate onto `ContactDeal` per the earlier plan. `CrmDeal` turned out
to dominate it on every axis, so the target changed. `ContactDeal` would have needed `leadId`
relaxed to nullable plus five new columns; `CrmDeal` needed one.

### The actual bug: an endpoint alone would still have been empty

`CrmDeal` had **no `serviceBusinessId`**, and there is no path from `CrmServiceBusiness` to
the legacy `CrmBusiness`. So scoping it the way every other CRM endpoint is scoped matched
nothing for a correctly enrolled business — adding routes without the column would have
left both pages just as blank, and looked like the fix didn't work.

This is the same `businessId` vs `serviceBusinessId` split that makes `/contact/reports`
empty. It is not one bug in one file; it is a pattern.

Two id spaces collide here, and it is worth writing down because it is not obvious:

- `req.crm.businessId` is the **platform `Business.id`**.
- `CrmDeal.businessId` is a foreign key to the **legacy `CrmBusiness.id`**.

Passing one where the other is expected produced `CrmDeal_businessId_fkey (index)` on every
create — caught by the integration test, not by reading the code. And `CrmBusiness` cannot
be mapped to a tenant at all: no `businessId`, no `ownerId`, only an `ownerEmail`.

So deals are scoped by `serviceBusinessId` **alone**, via a `dealScope()` helper rather than
the usual `crmScope()`. `crmScope()` ORs in `{ businessId }`, which is right for `CrmClient`
and meaningless for `CrmDeal`. `CrmDeal.businessId` is left null on write and never filtered
on, because an id from that column cannot be attributed to a tenant — guessing one would
either violate the FK or match someone else's.

Consequence to be aware of: any `CrmDeal` row written before this change carries only the
legacy `businessId` and is therefore invisible to the CRM deals UI. There were no such rows
to lose — `prisma.crmDeal` had zero write paths, so nothing could have created one through
the app.

### Schema change

One nullable column (`CrmDeal.serviceBusinessId`) plus `businessId` relaxed to nullable, and
`db push` applies exactly this. Nullable with no backfill, so nothing is dropped. Mirrored in
`server/sql/crm-deal-tenant.sql` and registered in `ensure-agent-tables.cjs`, because nothing
in the deploy path runs `prisma migrate deploy` — a column that exists only in a migration
folder does not exist in production.

### Tests: 16, mutation-checked five ways

`server/tests/crm-deals.integration.test.ts`, real HTTP against a disposable database.
Reverting each fix makes a test fail, so the suite is worth something:

| mutation | result |
|---|---|
| drop tenant scoping from the deals list | 2 failed |
| trust a body-supplied `serviceBusinessId` | 1 failed |
| skip the cross-tenant client check | 1 failed |
| accept any stage | 1 failed |
| stop clearing `closedAt` on reopen | 2 failed |

Full server suite 712 passed / 49 files (was 696 / 48). Client 42. Server tsc 26, unchanged.

Two things the tests corrected in my own assumptions, both worth keeping:

- `resolveCrmBusiness` **does** read a body `businessId`, as an owner-scoped selector, and
  403s on a mismatch rather than ignoring it. My first test asserted it was ignored; it is
  not, and the real behaviour is safe. `serviceBusinessId` is the one that is ignored.
- The first email mock was hand-listed and broke registration on `sendWelcome`. The
  existing suites use a `Proxy` for exactly this reason.

### Still missing

- `POST /api/v1/crm/import/deals` (CSV import) does not exist. `CSVImportModal` surfaces a
  visible error rather than failing silently, so it is honest, but the button does not work.
- `reports.service.ts` still filters `CrmDeal` on the platform `businessId`, so pipeline
  figures in `/contact/reports` will not see these rows. That is the next item on the list and
  needs the same `dealScope()` treatment.
- `Deal`, `AbodeManager` and the rest of the Abode-era schema are dead weight. Deleting them
  is a real migration and should not be done casually.

## P0: /api/v1/reports was a cross-tenant financial leak (2026-10-03)

Found while fixing the empty reports page. It is not a display bug.

### The hole

`reports.routes.ts` read its tenant from the query string and handed it to the service:

```ts
const businessId = String(req.query.businessId);   // all six routes
```

The router had `router.use(authenticate)`, added in the earlier auth sweep, so the routes
*looked* protected. But authentication establishes **who** the caller is; it says nothing
about **which tenant** they may read. There was no ownership check anywhere on the router.

So any authenticated user could read any other business's:

- `/pipeline` — deal values, the sales forecast
- `/revenue` — billed, collected, outstanding
- `/expenses` — spend by category
- `/client-health` — client names, statuses
- `/trust-insights`
- `/activity-metrics` — the activity feed

Six routes of business financials, cross-tenant, by putting an id in the query string.

### What was masking it

The routes also produced *empty* reports, which is why nobody noticed. One `businessId`
parameter was being handed to five models that disagree on what it means:

| model | `businessId` means |
|---|---|
| `Invoice` | platform `Business.id` |
| `CrmDeal`, `CrmExpense`, `CrmClient`, `CrmActivity` | legacy `CrmBusiness.id` |

No single value satisfies all five. The client sent the platform id, so the four CRM reports
matched nothing. **The bug that hid the security hole was the same bug that made the page
look empty.** Fixing only the emptiness would have shipped the leak with a populated UI —
which is worse, because it would have looked like it worked.

### The fix

- `businessId` is now ignored. The tenant comes from `resolveCrmBusiness`, which pairs a
  requested id with `ownerId: userId`, so a foreign id resolves to nothing and the request is
  **refused (403)** rather than silently falling back to the caller's own business.
- `ReportsService` takes a `ReportsContext { serviceBusinessId, businessId }` instead of a
  bare string, and scopes each model on the anchor it actually owns. `CrmActivity` gained
  `serviceBusinessId` (with the matching SQL in `sql/crm-deal-tenant.sql`) because a
  standalone note has no client or deal to be reached through — those were exactly the rows
  the activity report dropped.
- Revenue scopes on the platform `businessId`, and returns an **impossible predicate** when
  the tenant has no platform business. An empty filter there would be a match-all, and a
  match-all on a revenue report is the worst available failure direction.
- 500s no longer echo `err.message`, which included raw Prisma text (table and column names).

### Also removed: fabricated numbers

`getTrustInsights` returned a **literal object** and queried nothing:

```ts
scoreDistribution: { '80-100': 15, '60-79': 8, '40-59': 3, '0-39': 1 },
events: [{ type: 'activity.task_completed', count: 42 }, ...],
escalations: 2,
```

Every business saw identical numbers, and no test could catch it because the values were
never derived from anything. Now computed from real rows: score quartiles from the tenant's
own `CrmClient.reliabilityScore`, real `CrmActivity` counts by type, escalations from
`AT_RISK` clients. With no clients the distribution is empty rather than four invented
buckets.

Buckets are labelled by the observed min/max rather than fixed 0-100 boundaries:
`reliabilityScore` defaults to **750** and nothing in the codebase establishes a scale, so
hardcoding "80-100" would have put every client in the bottom quartile by accident.

### Two more real bugs found on the way

- **`getRevenue` reported paid invoices as outstanding.** `collected` required
  `status === 'paid'`; `paidAt` was ignored. `paidAt` is now authoritative. Both status
  casings are compared as defence in depth — every current `Invoice` write is lowercase, so
  this is not a live bug, but UPPERCASE `'PAID'` is the convention on sibling payment models
  (`Booking`, `PropertyLease`, the Stripe/PayLio webhooks), and an invoice arriving through
  one of those paths would read as outstanding forever.
- **`client-health` returned every client under a heading called "new".** The filter was
  `clients.filter(c => startDate && ...)`, which evaluates `startDate` for truthiness — so
  with no range selected it returned the entire client list labelled as new. With no range
  there is no notion of new, so it is now empty.

### Tests: 12, mutation-checked six ways

`server/tests/reports-tenant.integration.test.ts`, real HTTP against a disposable database.

| mutation | result |
|---|---|
| trust `req.query.businessId` again (the original exploit) | 4 failed |
| drop `serviceBusinessId` scoping from the CRM reports | 4 failed |
| restore the hardcoded trust constants | 1 failed |
| remove the date-range validation | 1 failed |
| stop honouring `paidAt` | 1 failed |
| return every client as "new" | 1 failed |

Two mutations initially did **not** fail, and both were test defects rather than code
defects:

- The range check existed in the route *and* the service. Deleting the route's copy left the
  suite green, because the service still threw. Duplicated validation is how a check rots
  without anyone noticing, so it now has one owner — the service, which knows what a range
  means — and the route only parses.
- The `paidAt` and `newClients` branches were unreachable from the API (the status endpoint
  sets `paidAt` *and* status together), so neither was actually pinned. Both now have tests,
  the first by setting `paidAt` through Prisma to model a payment rail that settled while the
  status string lagged.

Full server suite 724 passed / 50 files (was 712 / 49). Client 42. tsc 26, unchanged.

## POST /api/v1/crm/import/deals — built and hardened (2026-10-03)

`CSVImportModal` and the deals page have called `/api/v1/crm/import/deals` for some time. The
endpoint did not exist, so the import button 404'd. The page handled that honestly (it
threw), but the feature was dead.

Contract, taken from the modal rather than invented: columns `title, value, stage,
probability, expectedCloseDate, client, notes`, and the response the modal expects is
`{ imported, skipped, errors }`.

### Hardening

A CSV import is an unbounded, caller-supplied write, so the interesting work is all in what
it refuses.

- **Byte cap, 1 MB**, measured with `Buffer.byteLength` rather than `.length` — the limit is
  about memory, and a multi-byte character is more than one byte on the wire.
- **Row cap, 1,000** and **column cap, 50**. Without the row cap, 50,000 well-formed rows
  become 50,000 inserts inside one transaction: a long lock on `CrmDeal` and a timeout that
  leaves the caller unsure whether it landed.
- **Truncation is never an option.** Both caps reject the file. Importing an arbitrary
  prefix and reporting success is the worst outcome available, because the numbers look
  right.
- **Per-row errors carry the row number the user sees** (1-based, counting the header, so it
  matches a spreadsheet), and the error list is capped at 20 so a 1000-row bad file cannot
  become a multi-megabyte response.
- **The same validators as the form.** Every row goes through the exported `parseStage`,
  `parseValue`, `parseProbability` and `parseOptionalDate`. An import that accepted a stage
  the UI rejects would strand deals in a column the kanban does not render — CSV must not be
  a way around the rules.
- **`client` resolves by name or email, within the caller's tenant only.** A name that does
  not resolve is a row error; so is an ambiguous one, with the email offered as the
  disambiguator. A name from another business simply does not exist here, and silently
  attaching a deal to the wrong client is worse than refusing the row.
- **Unbalanced quotes are rejected.** A quoted field that never closes would otherwise be
  swallowed into the next field and produce a mangled row that looks imported.
- **A `title` column and at least one data row are required**, and the error names the
  columns actually found.

### All-or-nothing, deliberately

The file is fully validated and nothing is written unless every row passes. A partial import
is the wrong trade here: `value` feeds the pipeline forecast, so 400 of 500 rows landing
produces a forecast that is wrong by 20% and looks entirely plausible. Refusing the file
with a row-by-row list is recoverable; a half-written pipeline is not.

### The server parses the CSV itself

The modal already parses client-side for its preview, so it was tempting to accept parsed
rows. The server parses anyway, on purpose: the client's row count and preview are
untrusted input, and the parser is exactly where trusting the client would let a crafted
file describe rows that were never in it. The parser is RFC 4180 (quoted fields, `""`
escapes, embedded newlines, CRLF) and mirrors the one in the modal, because the two have to
agree on quoting rules — `split(',')` would turn `"Quoted job, with comma"` into four
columns of nonsense.

No CSV dependency was added; there is no parser in `server/package.json` today.

### Tests: 10 import cases, mutation-checked eight ways

| mutation | result |
|---|---|
| make the import partial | 5 failed |
| skip the byte cap | 1 failed |
| skip the row cap (parser) | 1 failed |
| resolve clients across all tenants | 1 failed |
| accept an unbalanced quote | 1 failed |
| skip per-row stage validation | 1 failed |
| remove the error cap | 1 failed |
| drop the ambiguous-client guard | 1 failed |

The row-cap mutation initially did **not** fail: `parseCsv` and `importDeals` both enforced
it, the parser always tripped first, and the service-level copy was dead code. Same
duplicate-validation smell as the date-range fix in the previous commit. It now has one
owner — the parser.

### Three client bugs fixed alongside

- `handleImportDeals` fell back to **`https://pabandi.onrender.com`** when `VITE_API_URL`
  was unset, while every other call in that file falls back to `localhost`. A developer's
  test import would have written deals into the live database.
- It read `data.error`, but the API error shape is `{ success: false, message }` — `error`
  only exists in development. Every real reason (no title column, too many rows, unbalanced
  quote, oversized file) surfaced as a bare "Import failed".
- `CSVImportModal` fired a **green `Imported ${res.imported} records` toast even when
  `imported` was 0**. Since the import is all-or-nothing, a rejected file is the common
  failure, and it was announcing success while the only useful information — the row errors
  — arrived underneath. Now an error toast naming how many problems to fix.

Server 734 passed / 50 files (was 724 / 50). Client 42. Client tsc 534 and server tsc 26,
both unchanged. Client build exit 0.

### Known remaining gap

The modal's generic 5 MB pre-check is looser than the server's 1 MB deals cap. A 2 MB file
passes the client check and is then refused by the server — now with the actual reason
visible, rather than as an unexplained failure. The modal is shared with other imports, so
its limit was left generic rather than tightened to the deals cap.

## CRM invoices now go through invoice.service (2026-10-03)

I wrote last turn that routing CRM invoices through `invoice.service.createInvoice` would
recover "paymentLink, fee assessment and trust events". **That was wrong on all three
counts**, and checking it before acting is the only reason it did not become a regression.

- Nothing in the server creates a `paymentLink`. There is no such write path.
- Fees are not assessed at invoice creation. They live in unrelated services
  (`trustGuarantee`, `pabond`, `agentMarketplace`).
- Trust events fire on invoice **status change** (`invoiceTrustService.processInvoiceStatusChange`),
  and the CRM route already called that.

So the two paths were not "canonical vs incomplete". Measured side by side, **the hand-rolled
route was better on four counts and the service was worse on all four**:

| | CRM route (hand-rolled) | `invoice.service.createInvoice` |
|---|---|---|
| client ownership check | verified `serviceBusinessId` | **none** |
| number | `INV-YYYY-NNNN`, scoped, collision retry | **`INV-<random 6 digits>`**, unscoped, no retry |
| tenant source | `resolveCrmBusiness` (server-derived) | `req.user.businessId` (a JWT claim that goes stale) |
| plan quota | `tierGuard({ resource: 'invoices' })` | unmetered |

Consolidating as originally described would have imported every one of those weaknesses into
the CRM's money path.

### The actual bug: anyone could invoice anyone

`POST /api/v1/invoices` passed `req.body` straight to `createInvoice`, which performed **no
ownership check at all**. `Invoice.clientId` is a required FK to `CrmClient`, so any
authenticated user could raise an invoice against **any other tenant's client**. That invoice
then appears on the victim client's record and in the money trail under someone else's
business — a cross-tenant integrity hole on the payment path, reachable from the public
invoice API.

`assertClientInBusiness()` now proves ownership via the only chain that can be proven:
platform `Business.id` → `CrmServiceBusiness` → `CrmClient`. `CrmClient.businessId` is a
foreign key to the legacy `CrmBusiness` table, which has no `ownerId` and no mapping to a
platform `Business`, so it cannot be used for this.

It **fails closed**: a client whose `serviceBusinessId` is null cannot be shown to belong to
the business, so it is refused rather than trusted — consistent with legacy CRM rows not
being surfaced in the CRM UI either. Accepting it would reopen the hole.

### 404, not 400

Cross-tenant and unknown clients both return **404 "client not found"**. The old route
returned 400 "does not belong", which confirms the id *exists* and is merely someone else's
— one request per candidate turns the endpoint into an oracle for enumerating another
tenant's client list. 404 is indistinguishable from a real miss. This is a deliberate change
to an existing test's expectation, for the same reason cross-tenant deals return 404.

### Invoice numbers: two wrong answers, one right one

`Invoice.number` is `@unique` **globally**. Both previous implementations were wrong:

- **Random 6 digits**: 10^6 against a global index, so by the birthday bound a collision is
  likely past ~1000 invoices platform-wide, with no retry — a P2002 500 on a customer.
- **Per-business counter** (the obvious fix): I wrote a comment claiming it "fails quietly"
  and exhausts the retry budget with a 503. **Mutation testing proved that wrong.** With the
  retry loop, a per-business counter still yields unique numbers — it just walks forward past
  clashes (B1 takes 0001, B2 clashes and takes 0002, …), so the real cost is gapped,
  out-of-order numbers and extra queries per attempt. Eight businesses colliding in one year
  still resolve, because each consumes a number.

So the global counter is a **sequence and efficiency choice, not a correctness one**, and the
comment now says so. Numbers stay contiguous and each attempt is one cheap lookup.

**Tradeoff, stated plainly:** a platform-wide sequence means a business's first invoice of
the year reveals roughly how many invoices the whole platform issued that year. That is
ordinary sequential-invoice behaviour and exposes no customer data, but it is a real (small)
cross-tenant volume signal. The alternative — a per-business discriminator such as
`INV-2026-A7K3-0001` — removes it and is still unique by construction, at the cost of
changing the number format on every invoice, template and document that embeds it. Not done
here; worth revisiting only if it ever matters.

### The notes envelope is load-bearing — do not "clean it up"

`createInvoice` stores `notes` as `JSON.stringify({ text, metadata })` because
`requireEscrow` has no column. Two consumers `JSON.parse` it — `invoicePublic.routes` and
`money-flow.service` (`metadata.currency`) — and I had intended to remove the envelope as
"corrupting user notes". Both readers are `try`/`catch`-guarded and fall back cleanly, so
plain text is safe, but the envelope is how escrow and currency travel. **Left alone
deliberately.**

### Tests: 3 new in money-flow, mutation-checked seven ways

| mutation | result |
|---|---|
| remove the client ownership check | 2 failed |
| scope the ownership check to any service business | 1 failed |
| fail open on an unknown clientId | 2 failed |
| revert to the random 6-digit number | 2 failed |
| per-business counter against the global index | **0 failed — claim was wrong** |
| drop the collision-retry loop | 1 failed |
| skip the clash check | 1 failed |
| re-introduce the raw insert in the CRM route | 7 failed |

The occupied-number test needed two attempts. Squatting `INV-<year>-0001` did **not**
collide: the global COUNT includes the squatted row, so the count rose to 1 and the
allocator returned 0002 happily — leaving both number mutations green. Squatting **0002**,
the number the counter actually computes, forces the collision and pins the loop.

Server 737 passed / 50 files (was 734 / 50). Client 42. tsc 26 unchanged.

## Job scheduling: double-booking, and a second cross-tenant leak (2026-10-03)

### The leak is worse than the financials one

`job.routes.ts` read its tenant like this, with only `authenticate` on the router:

```ts
const businessId = req.body?.businessId || req.query?.businessId;
```

So any logged-in user could read another business's job schedule — client names, service
**addresses**, appointment times — and create jobs in it. Jobs carry physical addresses, so
this leaks more sensitive material than the revenue leak did.

Worse, `checkInJob`, `checkOutJob` and `handleNoShow` took **no tenant at all**:
`findUnique({ where: { id: jobId } })`. Anyone could check in, complete, or mark missed any
job in the platform. `checkOutJob` also calls `invoiceGenerationService`, so it was a
money-path write too.

It also used the wrong id space (`CrmJob.businessId` → legacy `CrmBusiness`), so these reads
matched nothing for a correctly enrolled business — the same bug that hid the reports leak.

Fixed the same way: `resolveCrmBusiness` + `requireCrmContext`, everything scoped on
`serviceBusinessId`, state transitions failing closed. Every handler also stopped flattening
errors to 500, so a 404 or a 409 finally reaches the client as itself.

### Why double-booking was invisible

**Nothing stopped an employee being booked twice.** But the deeper problem is that
`createJobHandler` destructured a fixed field list and **never forwarded `employeeId`** — so
every job created through `POST /api/v1/crm/jobs` had *no employee at all*. Double-booking was
impossible only because nobody was ever assigned; the assignment control did nothing, stored
jobs had `employeeId: null` and no assignment row, and any conflict check gated on
`employeeId` could never fire.

This is the same shape as the deal work: the *symptom* (no conflicts) and the *cause* (a field
dropped at the controller boundary) looked like different problems.

### Assignment lives in two places

`CrmJobAssignment` (written by `crm.service`) and `CrmJob.employeeId` (written by
`job.service`). Neither writes the other. So:

- `crm.service.getJobs` reads `assignments` → assigned.
- `job.service.getJobs` reads `employee` → **always null**, because that column is never
  written by the CRM path.

A conflict check looking at only one is bypassed by choosing the other endpoint, so
`findJobConflicts` matches both. There is a test for each direction.

`assignEmployee` now also keeps `CrmJob.employeeId` in step, so both read paths agree.

### Rules chosen, and why

- **Half-open window `[start, end)`.** A 09:00–10:00 job and a 10:00–11:00 job do **not**
  conflict. Back-to-back appointments are the normal case; a shared boundary would reject
  every schedule where someone works consecutively.
- **CANCELLED jobs are ignored; COMPLETED ones are not.** A cancelled booking occupies
  nobody; a completed one did occupy that window, and allowing the overlap is exactly how a
  double-booked diary happens.
- **409, not 400**, carrying the clashing job's window. A bare refusal the user cannot act on
  gets worked around. The detail survives via the global error handler, which now passes a
  `conflicts` array through when one is attached.
- **`allowConflict` overrides it.** Double-booking is sometimes correct; that decision belongs
  to the business, not to a 409.
- **A day of slack either side** of the window, because a late-evening job can run past
  midnight and an early-morning one belongs to the previous calendar day.
- **Missing duration falls back to 60 minutes, not zero.** `CrmJob` has both `duration` and
  `durationMinutes` and nothing keeps them in step; treating "unknown" as zero makes the
  window empty and silently disables the check for those rows.

### Reschedules are checked too

Booking cleanly and then dragging the job on top of another one is the easiest way to defeat a
create-time check, so `updateJob` runs the same guard. Two bugs there, both found by tests:

- It was gated on `scheduledDate` being present, so the commonest edit of all — changing only
  the **time** — skipped the check entirely.
- It read the assignee from `CrmJob.employeeId` only, so for a CRM-created job it found nobody
  and skipped the check. It now resolves both sources.

### Tests: 14, mutation-checked six ways

| mutation | result |
|---|---|
| never report a conflict | 4 failed |
| check only the `employeeId` column | 3 failed |
| treat the window as closed | 1 failed |
| count CANCELLED jobs as blockers | 1 failed |
| trust the caller's `businessId` in the route | 3 failed |
| drop the tenant check from checkIn/checkOut | 1 failed |

Also fixed in passing: `CrmJob.clientName` is a **required** column and `job.service` never
set it — only surfaced once the create was type-checked properly. It is now a denormalized
snapshot, as in `crm.service`, so a later client rename cannot rewrite job history.

Server 751 passed / 51 files (was 737 / 50). Client 42. **Server tsc 26 → 23** — the tenant
fixes cleared three pre-existing type errors. Client build exit 0.

### Still open (not done in this pass)

- `job.service.handleNoShow` has **zero callers** and is now dead code. Left in place rather
  than deleted; it is tenant-scoped so it is no longer a hazard.
- `jobLifecycleService.handleNoShow` is a fourth no-show implementation used by the cron. It
  is cron-internal and the ids come from the cron's own query, so it is acceptable, but the
  duplication is real.
- `/api/v1/dashboard/*` and `/api/v1/onboarding/*` still 404 behind routed pages.
- Partial payments / split tender not started.

## The business dashboard API (2026-10-03)

`/api/v1/dashboard/*` and `/api/v1/onboarding/*` both 404'd behind routed pages. They are not
equivalent problems, so they were treated separately.

### Dashboard: had to be implemented, not de-routed

`/dashboard` is the **primary navigation target** for a business owner — the AppShell logo, the
breadcrumb root, the command palette and the avatar menu in `Layout` all point at it. Every
screen behind it fetched six endpoints that did not exist:

```
GET  /api/v1/dashboard/:businessId/today
GET  /api/v1/dashboard/:businessId/calendar
GET  /api/v1/dashboard/:businessId/customers
GET  /api/v1/dashboard/:businessId/employees
GET  /api/v1/dashboard/:businessId/money
POST /api/v1/dashboard/:businessId/expense
```

The registration pointed at `dashboard.routes.ts`, which was never on disk, so every request
500'd with "Route module failed to load". An earlier pass removed the registration — correctly
turning a mysterious 500 into a visible 404 — but de-routing was not an option here, because
that would break navigation for every business owner. So the six endpoints are now written in
`dashboard.routes.ts` against data that already exists: `CrmJob`, `CrmClient`, `CrmEmployee`,
`Invoice`, `CrmExpense`.

### The `:businessId` path parameter is ignored — deliberately

Every route is declared `/:businessId/...` purely so the client's existing URLs resolve, and
the parameter is **never read**. The tenant comes from `resolveCrmBusiness`, which pairs a
requested id with `ownerId: userId`.

This is the whole point. Two cross-tenant leaks in this codebase came from reading a
caller-supplied `businessId` out of a path or query: reports leaked revenue, jobs leaked
client **addresses**. Honouring it here would reintroduce both — on the one screen every
business owner lands on. The path segment is kept only as a shape the client already sends.

### PayLio: no fabricated balance

The dashboard shows a "PayLio Balance" card. PayLio has create-payment, payment-status and
webhook endpoints — and **no balance endpoint**. So there is nothing truthful to return.

The client renders the value with `.toFixed(2)`, so it has to be a number, but returning `0`
alone would assert the business holds no money when the truth is that we do not know. It is
therefore sent as `0` **with `paylioBalanceAvailable: false`**, and the card renders "Not
connected" instead of "$0.00".

### Two client bugs fixed alongside

- **The expense POST was fire-and-forget.** No response check, and the form cleared and the
  list reloaded regardless — so a rejected expense (bad amount, missing category, no auth)
  looked exactly like a successful one and the user was told their spend was recorded when it
  was not. It now checks the response and shows the server's reason.
- **`BusinessDashboard` and `OnboardingWizard` both send no `Authorization` header** to
  onboarding. See below.

### Tests: 9, mutation-checked six ways

| mutation | result |
|---|---|
| honour the caller's `businessId` path param | 4 failed |
| drop the `serviceBusinessId` filter from customers | 1 failed |
| accept a non-numeric expense amount | 1 failed |
| claim the PayLio balance is available | 1 failed |
| drop the calendar range validation | 1 failed |
| remove the router registration again | 9 failed |

Expense validation is deliberately strict: `Number('abc')` is `NaN`, and a `NaN` reaching the
`SUM` in `/money` silently poisons the net-profit figure the user is looking at. Negative and
zero amounts are refused too — a negative expense is not a refund, it is an entry error that
would understate total spend on the same card.

Calendar ranges are validated (400 on inverted or unparseable dates) and capped at a year, so
a dashboard query cannot be turned into a data export.

Server 760 passed / 52 files (was 751 / 51). Client 42. Server tsc 23, client tsc 534, both
unchanged. Client build exit 0.

### Onboarding: still open, and it is a worse bug than the 404

`OnboardingWizard` **is** routed at `/onboarding` and POSTs `{ profile, services,
availability, employees }` to `/api/v1/onboarding/complete`, which does not exist.

Implementing it is more than adding a route, and two things need deciding first:

1. **It sends no `Authorization` header.** So even with the endpoint in place it would 401.
   That is a client bug, not a missing route.
2. **It fails silently.** `catch` only `console.error`s — no error state, no toast. The user
   completes the wizard and **nothing happens**, with no indication of why.

It also needs an owner decision: the payload includes `employees` and `availability`, which
means creating `CrmEmployee` rows and defining what "availability" means. There is **no
availability model in the schema** (the double-booking work added conflict detection, not
working-hours data), so `availability` currently has nowhere to go.

Left alone rather than stubbed: a fake `/onboarding/complete` that returns success would
report a business as onboarded when nothing was persisted — the same failure mode as the
fabricated trust-insight constants, and worse, because onboarding is what everything else
depends on.

## Availability model + the onboarding endpoint (2026-10-03)

`OnboardingWizard` is routed at `/onboarding` and POSTs
`{ profile, services, availability, employees }` to `/api/v1/onboarding/complete`. That endpoint
did not exist, and the `availability` half of the payload had **nowhere to go** — there was no
availability model anywhere in the schema.

The double-booking work added conflict *detection*: it stops one employee being booked twice.
It says nothing about whether a job is inside the hours the business is open, because nothing
recorded those hours. Those are different questions and conflating them would make availability
look like it was doing conflict detection while quietly not doing it.

### The model: business-level recurring weekly hours

```prisma
model CrmAvailability {
  serviceBusinessId String
  weekday           Int      // 0-6, 0 = Sunday
  startTime         String   // "09:00"
  endTime           String   // "17:00"
  slotMinutes       Int      @default(60)
  bufferMinutes     Int      @default(15)
  @@unique([serviceBusinessId, weekday, startTime])
}
```

**Business-level, not per-employee**, because that is the shape the wizard collects — one
weekly window applied to the whole business. Modelling it per employee would have meant
inventing per-employee semantics the product has not decided, which is how the previous wrong
turns happened.

`weekday` is 0-6 with 0 = Sunday, matching both `getUTCDay()` and the wizard's own day keys. An
off-by-one here silently opens the wrong day, so it is stated in three places: the model, the
SQL, and the check.

A row means "open between these times on this weekday". There is deliberately **no `available`
boolean**: a row that exists and a row that does not is a distinction the database already
makes correctly, and a boolean lets the two disagree.

`setAvailability` is delete-then-insert, not an upsert. The wizard *toggles days off*, and an
upsert keyed on (business, weekday) would keep the removed window forever.

### Two defaults worth arguing for

- **No hours recorded means no restriction.** Defaulting to "closed" would silently break
  scheduling for every existing tenant the moment this shipped. A business that has not opted
  into hours keeps the behaviour it had before the table existed.
- **A job is checked on its whole window, not its start.** A 16:30 job for 60 minutes runs
  past a 17:00 close even though it *starts* in hours. Checking only the start is the bug that
  assertion exists for.

Overnight windows (`22:00`–`02:00`) are supported, including a job at 01:00 tested against
*yesterday's* window. `endTime <= startTime` is therefore not an error, and treating it as
same-day would produce an empty window that silently blocks every booking.

### Onboarding is all-or-nothing, and validates first

Employees are validated *before* the transaction — including a duplicate-name check, because
`CrmEmployee` has no uniqueness and two crew members with the same name appear identically in
every list and assignment dropdown. The crew is **replaced, not appended**: re-opening the
wizard would otherwise double the roster each time.

`claimSlug` sanitises the requested name and appends a suffix on collision, so two businesses
cannot share a public handle. The `slug` lives on `CrmServiceBusiness` because the legacy
`AbodeManager.slug` belongs to the orphaned Abode-era model nothing writes to — which is what
the wizard has always been calling a slug while waiting for somewhere to put one.

**Services are stored as JSON, deliberately and temporarily.** `CrmServiceBusiness.serviceCatalog`
holds them because no model exists for a service catalogue and nothing else in the platform
references one. A table would be an unused relation plus a second tenant-anchor decision; the
JSON is lossless so the wizard's input is not dropped. Promote it to `CrmServiceOffering` when
something actually reads it.

### Two client bugs, both of which made this worse than a 404

- **No `Authorization` header.** Even with the endpoint in place the wizard would have 401'd.
  That was a client bug, not a missing route.
- **It failed silently.** A non-success response fell through the `if` and did *nothing* — no
  error, no navigation, no state change. The user clicked Complete and the wizard sat there,
  with the reason only ever reaching the console. There is now a visible `role="alert"` banner
  carrying the server's reason.

### Tests: 10, mutation-checked six ways

| mutation | result |
|---|---|
| check only the start time, ignore the end | 1 failed |
| default to closed when no hours exist | 2 failed |
| ignore the tenant when reading hours | 1 failed |
| allow a duplicate slug | 1 failed |
| append the crew instead of replacing it | 1 failed |
| accept malformed hours | 1 failed |

One pre-existing suite (`crm-lifecycle.test.ts`) broke, because its hand-built prisma mock had
no `crmAvailability` and `createJob` now reads it. The mock was extended with an empty result
— the "no hours" case, i.e. no restriction — so that suite still asserts job creation rather
than quietly inheriting opening-hours behaviour.

### Migration note

`db push` warns that a unique constraint on `slug` "might cause data loss". It is benign:
every existing row has `slug IS NULL`, and Postgres does not treat NULLs as conflicting in a
unique index. No backfill, nothing dropped.

Server 770 passed / 53 files (was 760 / 52). Client 42. Server tsc 23, client tsc 534, both
unchanged. Client build exit 0.

## /trust-passport/me was unreachable behind its own catch-all (2026-10-03)

Reported as: clicking CRM redirects to the landing page, with three 404s in the console
(`/rewards/me`, `/bookings/me`, `/trust-passport/me`) after a *successful* mode toggle.

### What the 404s actually were

| endpoint | verdict | detail |
|---|---|---|
| `/api/v1/trust-passport/me` | **shadowed — fixed** | the handler existed but was unreachable |
| `/api/v1/bookings/me` | **wrong path** | the real endpoint is `/bookings/my-bookings` |
| `/api/v1/rewards/me` | **never built** | `partnerRewards.routes.ts` has `/rewards`, `/stats`, `/offers/*` — no `/me` |

### The real bug: declaration order

```ts
router.get('/:handle', ...)         // declared FIRST — public passport lookup
router.get('/me', authenticate)     // declared after, therefore unreachable
router.get('/user/:userId', ...)
```

Express matches in declaration order, so `/me` was captured as a passport whose handle is
literally the string `"me"`. `trustPassportService.getPublic('me')` threw and its catch turned
that into a 404. **The caller's own passport has never been reachable**; only the public handle
lookup worked. Every literal path is now declared before the catch-all, with a comment saying
why — adding another one below it will look correct and 404 identically.

`/bookings/me` is the same shape of mistake: `/:id` is declared after `/my-bookings`, so
`/my-bookings` is fine but `/me` falls into `/:id` and looks up a booking with the id `"me"`.
The client was calling the wrong name; both call sites now use `/bookings/my-bookings`, whose
response is already `{ success, data: bookings }` — the shape the client expected.

### Why an HTTP test cannot catch this, and what does

A 404 from `/me` is indistinguishable from a 404 for a handle that genuinely does not exist.
That is exactly why this survived. The only place the difference is visible is the order of the
declarations, so `tests/trust-passport-routing.test.ts` reads the source and asserts:

1. every literal path precedes `/:handle`;
2. no route is declared twice — the reorder initially produced duplicate handlers, which
   TypeScript accepted and which would have run only the second;
3. the reorder did not swap middleware between them, since `/:handle` is public and `/me` is
   authenticated.

Mutation-checked both ways: moving `/me` back below `/:handle` fails, stripping `authenticate`
from `/me` fails.

Production after deploy: `/trust-passport/me` 404 → **401**, i.e. the handler is reached and the
401 is the expected unauthenticated response.

### The redirect is NOT caused by the 404s

This is the part worth being direct about, because the reported theory was that a failing data
fetch bounces the user to `/`. It does not:

- `BusinessGuard` sends an unauthenticated user to `/login`; an authenticated user in personal
  mode gets `<BusinessModeGate />`, an inline panel — the `<Navigate to="/" replace />` that used
  to do this was removed in earlier work and its absence is documented at `RouteGuards.tsx:18`.
- `PersonalGuard` sends to `/login` or `/dashboard`, never `/`.
- `NotFoundPage` does not redirect.
- `PersonalDashboardPage` already guards every read with `if (res.ok)`, so a 404 leaves the
  state null and renders `—`. The three fetches it makes cannot cause a redirect.

So the landing-page bounce is a separate symptom, and reproducing it needs the exact URL and the
guard that fires. **Still open, and not fixed here.**

`/rewards/me` is deliberately still 404. The personal dashboard and rewards page degrade to an
empty state, which is honest. Building it is a feature (a personal rewards balance), not a fix,
and it is listed below rather than stubbed.

### Still open

- **The landing-page redirect itself.** Needs the exact route clicked and the URL landed on.
- `/rewards/me` is not built. `partnerRewards.routes.ts` exposes partner offers, redemptions and
  `/stats`, but nothing for a personal customer's own rewards balance.
- `docs/crm-enhancement-plan.md` still describes a ~3,000-line in-memory client-only CRM that
  nothing imports. It makes tags, notes, CSV import and a discount engine look shipped.
- The Abode-era `Deal` / `AbodeManager` schema is dead weight and should not be deleted casually.

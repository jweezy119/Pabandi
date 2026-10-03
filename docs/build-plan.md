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

### 3.2 Fix the intermittent test flake · **quality**
`pab-supply.test.ts` fails ~1 run in 4 on Prisma client resolution. Never a false pass, but a
red suite invites "my change broke it" — which cost real time twice today.

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
- **3.2** `pab-supply.test.ts` flakes ~1 run in 4 on Prisma client resolution.
  Pre-existing, never a false pass, but it invites "my change broke it".
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

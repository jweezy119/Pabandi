# Production readiness — what is actually switched on

Written after the smoke test started reporting provider configuration. The short
version: two of the three paid paths are **not configured in production**, and one of
them is what a blocked customer is told to buy.

Evidence: `GET /health` → `smsConfigured: false`, `whopConfigured: false`,
`emailConfigured: true` (but delivery is failing — see below).

## What works

| Capability | State |
|---|---|
| Tier limits enforced | **yes** — free capped at 50 clients, 100 invoices/mo |
| Fee engine | **yes** — 3.5%, assessed on all four money paths |
| Square / PayPal payment | **yes** — forged webhooks rejected 401 |
| CRM read/write | **yes** — both CRMs' data visible |
| Delivery scores | **yes** — were inert, now move |
| Email-code login | **code fixed, delivery failing** |
| Site deploy | **yes** — CI-published, smoke-tested |

## What is not switched on

### 1. Whop billing — `whopConfigured: false`

**This is the urgent one.** The current state, end to end:

1. A free merchant reaches 50 clients. Writes are **refused** (402). Working as built.
2. `/pricing` publicly advertises Pro $49 and Business $149.
3. They tap upgrade. `POST /checkout` returns **503** — "Subscriptions are not
   available right now."

So a customer is **blocked**, shown a price, and told the purchase is impossible.
That is a paying-intent dead end, and the three pieces were built in separate sessions
without anyone checking they were connected.

Options, in the order I would take them:

- **(a) Set `WHOP_API_KEY` and the two plan ids.** The code is written, tested and
  mounted. This is configuration, not development. ~20 minutes.
- **(b) Hide the tiers until billing exists.** One flag: `/pricing` advertises only
  what can be bought. Honest immediately, removes the dead end, reversible.
- **(c) A waitlist.** "Pro is coming — leave your email." Captures the intent instead
  of discarding it.

**(a) if the keys exist, (b) if they don't.** Either way the current state is wrong
and should not ship as-is.

### 2. SMS — `smsConfigured: false`

`smsReminders: true` is advertised on Pro at $49/mo, and `sms.service.ts` has Twilio
wired. Without `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` / `PHONE_NUMBER` it silently does
nothing.

**Either** set the keys **or** remove it from the Pro feature list. A paid feature that
silently no-ops is the same class of bug as the email OTP: it looks correct and does
nothing.

### 3. Email delivery — configured, not working

`RESEND_API_KEY` is set, so `/health` says configured. `POST /auth/request-code`
returns **500** — Resend rejects the send. Almost certainly an unverified `from`
domain.

This blocks **password reset**, which is how a locked-out customer recovers. It needs
the Resend dashboard — I cannot diagnose it from here.

The smoke test deliberately reports this as a **warning**, not a pass: `emailConfigured:
true` has been true the entire time delivery has been failing, and reporting a key's
presence as readiness is what let it stay invisible.

## The uncomfortable pattern

Three features are advertised and not delivered. All three looked fine in review:

- the code exists
- the endpoints exist
- the config check passes

None of them had been **exercised**. The smoke test now reports each provider's real
configuration, and `deploy-site.yml` runs it after every publish — so the next one
cannot ship silently.

## Priority

1. **Whop keys, or hide the tiers.** A blocked customer is the worst state we can be in.
2. **SMS keys, or remove it from Pro.** Silence about a paid feature is not acceptable.
3. **Resend `from` domain.** Unblocks email-code login and password reset.
4. **Confirm the database is not on Render's free tier.** Free Postgres is deleted 30
   days after creation with no backups. See `docs/infrastructure.md`.

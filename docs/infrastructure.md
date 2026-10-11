# Infrastructure: what we're paying, and whether to move

Measured against Render's published pricing, not estimated. Written because "is a VPS
cheaper" is a question worth answering once with numbers instead of repeatedly with
intuition.

## What we run today

| Piece | Where | Plan | Cost |
|---|---|---|---|
| API (`server/`) | Render web service | `starter` (`render.yaml:6`) | **$7/mo** |
| Database | **Aliyun RDS, Singapore** | **confirmed 2026-10-11** | ~$15–30/mo |
| Site (`client/dist`) | Firebase Hosting | Spark | **$0** |
| CI | GitHub Actions | public repo | **$0** |

**Known floor: ~$7/mo for compute.** The database is no longer the free Render
Postgres this doc previously described — see the correction below.

## CORRECTION (2026-10-11): the database is Aliyun RDS, not Render Postgres

This document previously said the database was a Render-managed Postgres named
`pabandi-db`, and rated it "unknown — see below". That was wrong, and so was
`render.yaml`, which declared:

```yaml
- key: DATABASE_URL
  fromDatabase:
    name: pabandi-db
    property: connectionString
```

Neither matched reality. The deployed service connects to **Aliyun RDS,
Singapore**, which is also what `server/.env` and the `manual-migrate.yml`
workflow's secret pointed at.

**How it was established, rather than assumed.** It was not resolved by reading
config — both sources disagreed and neither is authoritative for what a running
process uses. It was resolved by asking the running service. `schema-check`
(reported on `/health` as `schema.ok`) verifies that the columns the deployed
code queries actually exist in the database it is attached to, including whether
`InvoiceTrustEvent.invoiceId` is nullable — a property that became true only on
Aliyun, when migration `20261010_trust_event_null_scope` ran there. The live
service returns `schema.ok: true`. A Render database would have returned false.

**Why it mattered.** `fromDatabase` makes the blueprint authoritative, so any
re-apply of `render.yaml` would have pointed the service at a database holding
none of its 338 tables — an immediate total outage rather than a slow one. The
entry is now `sync: false`, which preserves the working dashboard value and
cannot be silently overwritten.

**Two lessons worth keeping.** First, a config file is a statement of intent; a
health check is a statement of fact, and only one of them tells you what a
deployed process is really doing. Second, this ambiguity survived precisely
because the database has no invoices, no clients and no trust events in it — 352
users and 95 passports, but no traffic through the billing path. Nothing broke,
so nothing was noticed.

## ⚠️ The one thing that actually matters: is the database backed up?

*(This section used to ask whether the database was on Render's free tier, which
expires after 30 days and deletes the data. That was the right question for the
wrong database — it is Aliyun RDS now, and the expiry risk does not apply.)*

The equivalent risk here is backup, and it is **unverified**.

Aliyun RDS does automated backups, and they are not part of this repository, so
nothing here can prove they are enabled, that they are being retained, or that
anyone has ever restored one. An untested backup is a belief, not a safeguard.

**What to do this week:**

1. Confirm automated backups are enabled on the Aliyun instance, and how many
   days are retained.
2. Take a `pg_dump` and put it somewhere that is not Aliyun. The one in
   `server/backups/` was written by hand during a migration and is not on any
   schedule, so it will silently go stale.
3. Restore it somewhere and confirm the row counts. An unverified backup is
   indistinguishable from no backup until the day it is needed.

The database currently holds 352 users and 95 passports, and **no invoices** —
which is worth stating plainly here, because it means the data loss exposure
today is small and the temptation to defer this is correspondingly high. That
will not stay true.

## Is a VPS cheaper? No.

A comparable VPS:

| | Render (current) | Hetzner / DO VPS |
|---|---|---|
| Compute + disk | $7 + $0–6 | ~$4–7 |
| Postgres | included, managed, backed up | self-managed |
| TLS | managed | certbot + renewals |
| Backups | PITR on paid tiers | you write and test it |
| OS security patches | Render's problem | yours, forever |
| Monitoring | built in | yours |
| Migration | — | downtime + a `pg_dump` you have to trust |
| On failure | Render's on-call | 3am, you |

The hardware is roughly a wash. Everything that makes the managed price worth paying
is the *unglamorous* part — and this project has had a month in which the unglamorous
part already cost us: **email delivery has been broken and nobody could see it.**

A VPS is strictly more things to be responsible for at the exact moment we are trying
to get to profitability. **Recommendation: stay managed.** Revisit only if a specific
managed cost becomes the bottleneck, and name the number when it does.

## What I would actually spend money on, in order

1. **Free — the database.** Confirm the tier. If free, move it to the cheapest paid
   tier ($6/mo, 0.1 CPU / 256 MB). That buys persistence, backups and PITR. **This is
   the highest-value $6 in the stack** and the only item that risks data loss.
2. **Free — the CI added today.** Tests and site deploys now run on push.
3. **Free — the smoke test.** Catches what `/health` cannot: whether the deployed
   artifact contains the code we believe is live.
4. **$0 → maybe later — bandwidth.** Hobby includes 5 GB/mo, then $0.15/GB. Only a
   problem if the API starts serving large payloads; it is JSON.
5. **Not yet.** Horizontal scaling, Redis, read replicas. The app does not need them
   at current scale, and paying for capacity you do not use is the opposite of frugal.

## The frugal principle worth stating

The most expensive line item in this project is not infrastructure — it is
**customer-visible defects that reach production unnoticed**, and we have shipped
six. Every one cost more than a year of hosting would have.

$7/mo buys the floor. The smoke test and CI cost $0 and are worth more than any
hardware decision available to us right now.

## Also worth knowing

- **The API is the bottleneck, not the site.** The site is static on a free CDN. The
  API is a single 512 MB instance — which is why `index.ts` lazy-loads every route
  module ("Render 512MB limit"). That constraint is real and already shaping the code.
- **512 MB is tight.** If the API starts OOMing under load, the fix is `$25/mo` for
  1 CPU / 2 GB. That is the first upgrade worth making, and only when it is needed.
- **Two deploy targets, one repo.** This cost a day. `deploy-site.yml` now publishes
  the site from CI, which is what keeps them from drifting again.

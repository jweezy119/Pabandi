# Infrastructure: what we're paying, and whether to move

Measured against Render's published pricing, not estimated. Written because "is a VPS
cheaper" is a question worth answering once with numbers instead of repeatedly with
intuition.

## What we run today

| Piece | Where | Plan | Cost |
|---|---|---|---|
| API (`server/`) | Render web service | `starter` (`render.yaml:6`) | **$7/mo** |
| Database | Render Postgres `pabandi-db` | **unknown — see below** | $0–$6/mo |
| Site (`client/dist`) | Firebase Hosting | Spark | **$0** |
| CI | GitHub Actions | public repo | **$0** |

**Known floor: $7/mo.** Total is $7–13/mo depending on the database tier.

## ⚠️ The one thing that actually matters: is the database free?

Render's docs are explicit:

> **Free Render Postgres databases expire 30 days after creation.** An expired Free
> database is inaccessible unless you upgrade it to a paid compute plan. After a grace
> period of 14 days, Render **deletes the database (along with all of its data)**.

Free Postgres also has **no form of backups** and a fixed **1 GB** cap.

`render.yaml` has no `databases:` block — the database was created by hand in the
Render dashboard, so its plan is not visible from the repository.

**I cannot check this from here and it is the single highest-risk unknown in the
infrastructure.** If it is on the free tier it has either already been migrated or is
counting down. Either way: **check it this week**, and confirm a `pg_dump` exists
somewhere that is not on Render.

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

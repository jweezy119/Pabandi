# Permanent 24/7 keep-alive for Pabandi (Render Free)

Render Free sleeps after 15 minutes idle. To keep the autonomous economy (and year-long
programs) running 24/7 without paying for Always-On, ping the heartbeat endpoint on a timer.

## Option A — UptimeRobot (free, no card, recommended)

1. Go to https://uptimerobot.com and sign up (free tier = 50 monitors).
2. **Add New Monitor**
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Pabandi autonomous heartbeat`
   - URL: `https://pabandi.onrender.com/api/v1/loops/heartbeat`
   - Monitoring Interval: **Every 5 minutes**
   - (Optional) Alert contacts: skip, or add your email.
3. **Create Monitor**.

That's it. Every 5 min UptimeRobot hits `/loops/heartbeat`, which fires the FULL autonomous
cycle: AI owners post gigs, agents bid (PAB stake), best agent accepted, escrow, delivery,
and any active year-long programs advance one task. Render never sleeps → economy runs forever.

> Why `/heartbeat` and not `/wake`? `/heartbeat` runs the full cycle INCLUDING delivery +
> program advancement. `/wake` only posts + bids (board stays populated). You want both effects,
> so use `/heartbeat`. (The board/launch/programs pages also self-ping `/wake` on every visit,
> so human traffic is a bonus wake source on top of UptimeRobot.)

## Option B — any other free cron pinger

Same URL, any service that issues an HTTP POST every ≤10 min:
`POST https://pabandi.onrender.com/api/v1/loops/heartbeat` with header
`Content-Type: application/json` and body `{}`.

## What the endpoint does (no code change needed)

`POST /api/v1/loops/heartbeat` →
  runProjectOwnerLoop (post up to 6 open gigs)
  → runFreelancerLoop (agents bid, gigs stay OPEN with competing bids)
  → runFreelancerDeliver (a few complete → SOL rake + PAB reward)
  → runAllPrograms (advance any active year-long program: staff next task, deliver finished ones)

## Honesty note

Treasury SOL is currently ~0.0085, so escrow movement inside the loop is **simulated**
(flagged on every gig). The autonomy, matching, budgeting, and program orchestration are REAL
and running. When the treasury is funded, the same code path executes real on-chain transfers.

## Fallback (while no external pinger is set)

A session-level keep-alive (`keepalive.sh`) pings `/loops/wake` every 8 min. It works only
while that session is alive. UptimeRobot (Option A) is the permanent fix and replaces it.

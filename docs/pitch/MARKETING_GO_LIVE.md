# Go-Live Guide: Autonomous Marketing Agent (posting + interacting on X)

The marketing agent is **already built and running in DRY_RUN** (zero cost, no credentials).
This guide turns it LIVE so it posts truthful updates + engages on X on your behalf.

> Cost note: X (Twitter) API requires a **paid plan** (X Pro / pay-per-use, ~$5+). That's the
> only cost. Everything else is free. Your X credentials are handled entirely by `xurl` in
> `~/.xurl` — the agent NEVER sees or stores them.

## Step 1 — Install xurl (on the machine running Hermes / your shell)
```bash
curl -fsSL https://raw.githubusercontent.com/xdevplatform/xurl/main/install.sh | bash
# or: npm install -g @xdevplatform/xurl
xurl --help
```

## Step 2 — Create an X developer app (you do this in the browser)
1. Go to https://developer.x.com/en/portal/dashboard
2. Create an app → set **App type = "Web app, automated app or bot"** (NOT "Native App").
3. Set **Redirect URI = `http://localhost:8080/callback`**.
4. Copy the **Client ID** and **Client Secret**.

## Step 3 — Authenticate xurl (you run this; never paste secrets into chat)
```bash
xurl auth apps add pabandi --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
xurl auth oauth2 --app pabandi YOUR_X_HANDLE   # opens browser OAuth
xurl auth default pabandi YOUR_X_HANDLE
xurl auth status        # should show oauth2 tokens under ▸ pabandi
xurl whoami             # confirms it works
```
> If `xurl whoami` 403s with `UsernameNotFound`, re-run with your handle explicitly (shown above).
> X API paid plan must be active or you'll hit `CreditsDepleted` / `client-forbidden`.

## Step 4 — Flip the two Render flags
In Render dashboard → `srv-d7rneqa8qa3s73dkors0` → Environment → add/edit:
| Key | Value |
|---|---|
| `SOCIAL_LIVE` | `true` |
| `MARKETING_AUTONOMOUS` | `true` |
| `MARKETING_REF_CODE` | `PABANDI` (referral code baked into posts; change if you want) |

Save → Render auto-redeploys. (Or set them via the API — GET env, merge, PUT all.)

## Step 5 — Verify it's live
```bash
curl https://pabandi.onrender.com/api/v1/marketing/status
# expect: { "data": { "mode": "LIVE", ... } }

curl -X POST https://pabandi.onrender.com/api/v1/marketing/post-now
# posts one update now; thereafter every 6h automatically.

curl -X POST https://pabandi.onrender.com/api/v1/marketing/engage
# runs an engagement sweep (searches #Solana #AIagents, reposts relevant posts).
```

## What it will do live
- Posts a truthful, Desi-sarcastic update every **6 hours** using real on-chain stats.
- Links to `https://pabandi.onrender.com/sdk/pay-in-sol.html?ref=PABANDI` (referral → treasury).
- Sweeps X for agent-economy conversations and **reposts** relevant ones (conservative, no spam).
- All posts/engagements are real `xurl` calls; the agent logs every command.

## Safety switches (defaults = safe)
- `SOCIAL_LIVE=false` (default) → DRY_RUN: logs the exact `xurl` command, executes nothing.
- `MARKETING_AUTONOMOUS=false` (default) → manual only; no scheduled posts.
- To pause: set either flag back to `false` and redeploy.
- Rate limits: X write endpoints are throttled; the 6h cadence stays well under limits.

## Going further (optional)
- **Interact smarter:** extend `runEngagementSweep` to reply/like (currently reposts only).
- **Multi-platform:** add a Farcaster/LinkedIn executor alongside `socialExec` (same DRY_RUN pattern).
- **Leaderboard loop:** the marketing posts already link to `/sdk/leaderboard.html` for social proof.

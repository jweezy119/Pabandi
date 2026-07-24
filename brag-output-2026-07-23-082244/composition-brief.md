# Hyperframes Composition Brief: Pabandi Growth Partners

## Objective
Create a 22-second cinematic brag video showcasing Pabandi's Account Manager incentive program — lifetime commissions, signup bounties, and a real-time earnings dashboard.

## Output
- Composition directory: `brag-output-2026-07-23-082244/composition/`
- Rendered video: `brag-output-2026-07-23-082244/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22 seconds

## Source Material
- Project root: `/home/jay/Desktop/Pabandi/Pabandi/`
- Primary files read: `client/src/pages/AccountManagerDashboard.tsx`, `server/src/services/referral.service.ts`, `server/prisma/schema.prisma`, `client/tailwind.config.js`, `client/src/index.css`
- Product name: Pabandi Growth Partners
- Tagline / strongest claim: "Your network. Your income. Forever."
- Key UI moment to recreate: The Partner Dashboard stat cards + referral link + lead scoring + earnings ledger
- Copy that must appear verbatim:
  - "Your network. Your income. Forever."
  - "3%" / "2%" / "1% forever"
  - "Become a Growth Partner"

## Creative Direction
- Tone preset: cinematic
- Creative direction: "high-stakes recruitment pitch — the money counter never lies"
- Interpretation: Dramatic reveals, big typography, dark moody palette. Each number hit lands with weight. Restraint in animation density but maximum impact per beat. Slow reveal, then overwhelming proof.
- Angle: This is a recruitment pitch that makes the viewer feel like they're already losing money by NOT being a Growth Partner. Real commission rates, real crypto payouts, a real dashboard.
- Hook: "$0.00" counter on dark screen starts counting up rapidly — "Your referral earnings. Right now."
- Outro / punchline: Counter freezes on "$2,847.50" → "Your network. Your income. Forever." → Pabandi logo + CTA
- Avoid:
  - Generic SaaS language ("streamline", "optimize")
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #080e17 (near-black navy)
- Text: #e8edf2 (soft white)
- Primary: #3b82f6 (Pabandi blue)
- Accent: #14f195 (Solana green — money/success)
- Gold: #f0b429 (PAB token)
- Muted: #94a3b8 (slate labels)
- Surface layers: #05090f → #0b121e → #0f172a → #1e293b
- Display font: Manrope (800 weight for headlines)
- Body font: Inter (400-600 for labels)
- Card style: rounded-2xl/3xl dark surfaces (#0f172a) with glowing borders
- Visual references: stat cards, glowing-border effect (green→blue→purple gradient), PAB coin logo

## Storyboard
Use the storyboard in `brag-output-2026-07-23-082244/brag-plan.md` as the creative contract.

Scene summary:
1. The Counter Hook — 3s — "$0.00" counting up rapidly on dark screen
2. The Commission Tiers — 5s — Three tier cards (3% / 2% / 1% forever) slamming in
3. The Bounty Stack — 4s — Split: business signup bounty + customer booking commission → wallet
4. The Live Dashboard — 6s — Full Partner Dashboard recreation with stat cards + lead scoring
5. The Punchline & CTA — 4s — "Your network. Your income. Forever." + Pabandi logo

## Audio
- Audio role: cinematic support — building energy, climactic reveal
- Audio arc: minimal bass pulse → building through impacts → full energy at dashboard → resolution at outro
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady/clean, 109.96 BPM, best for cinematic)
- Music treatment: starts at 0.25 volume, builds to 0.35 at tiers, peaks at 0.4 during dashboard, gentle fade under outro
- Music cue guidance: bundled preset at `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`; strong cues at 8.74s (commission tiers slam), 13.11s (bounty hits), 17.47s (dashboard peak), 22.93s (logo hit)
- Audio-reactive treatment: subtle; use bass energy to pulse glow on stat cards and counter
- Audio-coupled moments:
  - Scene 1 counter start — chips-stack cascading ticks as numbers climb
  - Scene 2 tier cards — impactSoft_medium on each card landing
  - Scene 3 bounty hits — interface/click for cursor tap, casino/chips-collide for bounty +$5
  - Scene 4 stat cards — interface/drop_001 per card arrival
  - Scene 5 logo — impactBell_heavy_000 final hit
- SFX selection guidance: cinematic tone = 2-3 big impact moments + sparse accents. Match physical weight to visual motion.
- SFX analysis guidance: `skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copied into `composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, and `hyperframes-cli`. /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow.

Requirements:
- Show the actual Partner Dashboard UI from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer.
- Use beat-lock at ~8.74s for commission tier reveal, ~17.47s for dashboard, ~22.93s for logo.
- Run `hyperframes check` before render.

# Hyperframes Composition Brief: Pabandi V2

## Objective
Create a short launch-style brag video for Pabandi V2.

## Output
- Composition directory: `brag-output-2026-07-26-164500/composition/`
- Rendered video: `brag-output-2026-07-26-164500/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `/home/jay/Desktop/Pabandi/Pabandi`
- Primary files read: `client/src/index.css`, `client/tailwind.config.js`
- Product name: Pabandi V2
- Tagline / strongest claim: "Your new liquidity dashboard is your chat app."
- Key UI or visual moment to recreate: A mockup of the WhatsApp/Telegram chat interface receiving an intent and replying "ACCEPT".
- Copy that must appear verbatim:
  - "Dashboards are dead."
  - "Meet the Zero-UI Terminal."
  - "🚨 New Trade Request 🚨"
  - "ACCEPT"
  - "$500k+ Settled"
  - "Instant SLA enforcement. Built-in Mudarabah yield."

## Creative Direction
- Tone preset: cinematic
- Creative direction: Premium fintech promo (dark mode, sleek gradients, sharp cuts).
- Interpretation: Deep space background, sharp glowing neon cyan and purple accents, high-contrast, serious typography.
- Angle: Emphasize the lack of a traditional dashboard. The product *is* the chat interface.
- Hook: Pitch black, a single blinking cyan cursor, leading into the statement "Dashboards are dead."
- Outro / punchline: Pabandi logo and "pabandi.com".
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: `#02040a`
- Text: `#e8edf2`
- Accent: `#00f0ff` (Primary Cyan), `#a855f7` (Secondary Purple)
- Display font: `Outfit`
- Body font: `Plus Jakarta Sans`
- Visual references from the project: Glowing glassmorphism (`.glass-panel`), glowing neon borders.

## Storyboard
Use the storyboard in `brag-plan.md` as the creative contract.

Scene summary:
1. The Hook — 4s — Blinking cursor and "Dashboards are dead."
2. The Reveal — 4s — Glassmorphic panel slides up with "Meet the Zero-UI Terminal."
3. The Flow — 6s — Chat bubbles pop in (Trade Request + ACCEPT).
4. The Flex — 3s — Particles, "$500k+ Settled", "Instant SLA enforcement..."
5. Outro — 3s — Pabandi logo, pabandi.com.

## Audio
- Audio role: cinematic support
- Audio arc: Building tension in Hook, sub-bass drop on Reveal, ticking tension in Flow, epic swell on Flex.
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: Standard volume, slight fade out at the very end.
- Music cue guidance: detect at composition via `hyperframes beats`
- Audio-reactive treatment: subtle glow pulsing on the cyan/purple glassmorphism panels reacting to RMS energy.
- Audio-coupled moments:
  - The Hook — text reveals
  - The Reveal — panel slide up
  - The Flow — chat bubbles popping in
- SFX selection guidance: Deep swooshes for the panel, crisp digital ticks for chat bubbles, soft ding for ACCEPT.
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills...
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Run `hyperframes check` before render.

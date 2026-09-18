---
version: alpha
name: Pabandi Mudarabah — Frame (video / frame layer)
description: >
  Video-first design spec for Pabandi's Sharia-compliant Mudarabah profit-sharing pools launch video.
  Blends Pabandi's dark finance aesthetic (indigo/emerald/teal) with luminous 3D glowing motion.
  The unit is the frame (1920×1080). Atoms: deep space bg, emerald-teal glow system, Inter/Display serif typography,
  glass-morphism cards, radial glows, orbit rings, particle trails. Composition + frame scale rewritten for video.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script · light is the protagonist

colors:
  # Deep space base — Pabandi brand foundation
  space-900: "#020617"      # Pure background (tokens.color.background)
  space-800: "#0a0f1f"      # Elevated surface
  space-700: "#0f172a"      # Card surface (tokens.color.surface)
  space-600: "#1e293b"      # Border/container (tokens.color.surfaceContainer)
  space-400: "#64748b"      # Muted text (tokens.color.textDim)
  space-200: "#94a3b8"      # Secondary text (tokens.color.textMuted)
  space-50:  "#e2e8f0"      # Primary text (tokens.color.text)

  # Luminous accent system — the glow protagonist
  emerald-500: "#22c55e"    # Success/growth (tokens.color.success)
  emerald-400: "#4ade80"    # Glow highlight
  emerald-300: "#86efac"    # Soft glow
  teal-500:   "#14b8a6"     # Teal accent (brand gradient)
  teal-400:   "#2dd4bf"     # Teal glow
  indigo-500: "#6366f1"     # Primary brand (tokens.color.primary)
  indigo-400: "#818cf8"     # Primary glow (tokens.color.primary)
  indigo-300: "#a5b4fc"     # Soft indigo
  purple-500: "#a855f7"     # Secondary brand (tokens.color.secondary)
  amber-500:  "#fbbf24"     # Warning/gold (tokens.color.warning)
  gold-400:   "#fde047"     # Wealth/profit glow
  white:      "#ffffff"     # Pure highlight

  # Semantic aliases
  bg:           "{colors.space-900}"
  bg-elevated:  "{colors.space-800}"
  surface:      "{colors.space-700}"
  surface-high: "{colors.space-600}"
  border:       "rgba(255,255,255,0.08)"
  border-glow:  "rgba(34,197,94,0.3)"
  text:         "{colors.space-50}"
  text-muted:   "{colors.space-200}"
  text-dim:     "{colors.space-400}"
  accent:       "{colors.emerald-500}"
  accent-glow:  "{colors.emerald-400}"
  accent-soft:  "{colors.emerald-300}"
  brand:        "{colors.indigo-500}"
  brand-glow:   "{colors.indigo-400}"
  brand-soft:   "{colors.indigo-300}"
  secondary:    "{colors.purple-500}"
  gold:         "{colors.gold-400}"
  teal:         "{colors.teal-500}"
  teal-glow:    "{colors.teal-400}"

typography:
  # Display ramp — Space Grotesk for tech/finance authority
  hero:       { fontFamily: "Space Grotesk", cqw: 8.5, weight: 700, lineHeight: 1.0, tracking: "-0.02em", color: "text" }
  hero-glow:  { fontFamily: "Space Grotesk", cqw: 8.5, weight: 700, lineHeight: 1.0, tracking: "-0.02em", color: "accent-glow" }
  section:    { fontFamily: "Space Grotesk", cqw: 4.2, weight: 600, lineHeight: 1.1, tracking: "-0.01em", color: "text" }
  stat-big:   { fontFamily: "Space Grotesk", cqw: 14.0, weight: 700, lineHeight: 0.9, tracking: "-0.03em", color: "gold" }
  stat-label: { fontFamily: "Space Grotesk", cqw: 1.1, weight: 500, lineHeight: 1.3, tracking: "0.08em", upper: true, color: "text-muted" }

  # Reading ramp — Inter for clarity
  body:       { fontFamily: "Inter", cqw: 1.05, weight: 400, lineHeight: 1.6, color: "text" }
  body-bold:  { fontFamily: "Inter", cqw: 1.05, weight: 600, lineHeight: 1.5, color: "text" }
  label:      { fontFamily: "Inter", cqw: 0.85, weight: 500, lineHeight: 1.4, tracking: "0.05em", upper: true, color: "accent" }
  caption:    { fontFamily: "Inter", cqw: 0.75, weight: 400, lineHeight: 1.4, color: "text-dim" }
  mono:       { fontFamily: "JetBrains Mono", cqw: 0.85, weight: 500, lineHeight: 1.4, color: "brand-soft" }
  mono-big:   { fontFamily: "JetBrains Mono", cqw: 2.5, weight: 600, lineHeight: 1.2, color: "gold" }

  # Arabic/Urdu support
  arabic:     { fontFamily: "Noto Sans Arabic", cqw: 1.1, weight: 500, lineHeight: 1.7, color: "text" }
  arabic-display: { fontFamily: "Noto Kufi Arabic", cqw: 4.5, weight: 600, lineHeight: 1.2, color: "accent-glow" }

spacing:
  edge:      "4cqw"      # ~77px @ 1920
  pad-top:   "8cqw"
  pad-bottom:"8cqw"
  gap-sm:    "1.5cqw"
  gap-md:    "3cqw"
  gap-lg:    "6cqw"
  card-pad:  "3cqw"

rounded:
  none:  0
  sm:    "4px"
  md:    "12px"
  lg:    "20px"
  xl:    "28px"
  full:  "9999px"

shadow:
  sm:     "0 2px 8px rgba(2,6,23,0.5)"
  md:     "0 8px 32px rgba(2,6,23,0.6)"
  lg:     "0 24px 64px rgba(2,6,23,0.7)"
  glow-sm: "0 0 24px rgba(34,197,94,0.25)"
  glow-md: "0 0 48px rgba(34,197,94,0.35)"
  glow-lg: "0 0 96px rgba(34,197,94,0.45)"
  brand-glow: "0 0 48px rgba(99,102,241,0.3)"
  teal-glow:  "0 0 48px rgba(20,184,166,0.3)"
  inner-glow: "inset 0 0 32px rgba(34,197,94,0.1)"

motion:
  energy: high
  easing:
    entry: "expo.out"
    exit: "power3.in"
    ambient: "sine.inOut"
    elastic: "elastic.out(1, 0.5)"
    bounce: "back.out(1.7)"
  duration:
    entrance: 0.5
    hold: 2.0
    transition: 0.6
    fast: 0.25
    slow: 1.2
  atmosphere:
    - radial-glow-breath
    - orbit-ring-rotation
    - particle-drift
    - glass-shimmer
    - scanline-pulse
  transition: gravitational-lens

components:
  # Glass-morphism card with animated border glow
  glass-card:
    background: "rgba(15,23,42,0.6)"
    backdropFilter: "blur(24px)"
    border: "1px solid rgba(34,197,94,0.15)"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.card-pad}"
    boxShadow: "{shadow.md}, {shadow.glow-sm}"
    hover: "border-color: {colors.accent-glow}; box-shadow: {shadow.lg}, {shadow.glow-md}"
    description: "Translucent card with emerald border glow — primary content container"

  # Stat card with animated counter
  stat-card:
    background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(20,184,166,0.05) 100%)"
    border: "1px solid {colors.border-glow}"
    borderRadius: "{rounded.xl}"
    padding: "{spacing.gap-lg}"
    boxShadow: "{shadow.glow-md}"
    description: "Luminous stat card for key metrics — APY, TVL, investor count"

  # Radial glow background element
  radial-glow:
    background: "radial-gradient(ellipse at center, {colors.accent} 0%, transparent 70%)"
    opacity: 0.15
    blur: "80px"
    animation: "breathe 4s ease-in-out infinite"
    description: "Breathing radial glow — primary ambient atmosphere"

  # Orbit ring for 3D depth
  orbit-ring:
    border: "1px solid {colors.brand-glow}"
    borderRadius: "50%"
    opacity: 0.2
    animation: "orbit 20s linear infinite"
    description: "Slowly rotating orbit ring — 3D depth cue"

  # Particle trail for rapid movement
  particle-trail:
    background: "radial-gradient(circle, {colors.accent-glow} 0%, transparent 60%)"
    size: "4px"
    borderRadius: "50%"
    opacity: 0.8
    animation: "trail 0.8s ease-out forwards"
    description: "Rapid particle burst — energy and speed"

  # Glowing divider/rule
  glow-rule:
    height: "2px"
    background: "linear-gradient(90deg, transparent, {colors.accent-glow}, {colors.brand-glow}, transparent)"
    boxShadow: "0 0 16px {colors.accent-glow}"
    animation: "pulse-width 3s ease-in-out infinite"
    description: "Animated glowing divider — section separator with energy"

  # Profit share visualization
  profit-split:
    layout: "flex-row"
    gap: "{spacing.gap-md}"
    investor-bar:
      background: "linear-gradient(90deg, {colors.emerald-500}, {colors.teal-500})"
      height: "12px"
      borderRadius: "{rounded.full}"
      boxShadow: "0 0 24px {colors.emerald-400}"
    business-bar:
      background: "linear-gradient(90deg, {colors.indigo-500}, {colors.purple-500})"
      height: "12px"
      borderRadius: "{rounded.full}"
      boxShadow: "0 0 24px {colors.indigo-400}"
    description: "Animated profit split bars — investor (emerald) vs business (indigo)"

  # Sharia compliance badge
  sharia-badge:
    display: "inline-flex"
    alignItems: "center"
    gap: "0.5cqw"
    padding: "0.8cqw 1.5cqw"
    background: "rgba(34,197,94,0.12)"
    border: "1px solid {colors.accent-glow}"
    borderRadius: "{rounded.full}"
    color: "{colors.accent-glow}"
    fontFamily: "Space Grotesk"
    fontSize: "0.9cqw"
    fontWeight: 600
    tracking: "0.05em"
    upper: true
    boxShadow: "0 0 16px rgba(34,197,94,0.2)"
    animation: "badge-pulse 2.5s ease-in-out infinite"
    description: "Pulsing Sharia compliance indicator — trust signal"

  # 3D perspective card wrapper
  perspective-card:
    transformPerspective: "1200px"
    transformStyle: "preserve-3d"
    transition: "transform 0.6s cubic-bezier(0.34,1.56,0.64,1)"
    hover: "rotateY(-6deg) rotateX(4deg) translateZ(40px)"
    description: "3D perspective tilt on hover/interaction — depth through motion"

  # Holographic text effect
  holo-text:
    background: "linear-gradient(135deg, {colors.text} 0%, {colors.accent-glow} 50%, {colors.brand-glow} 100%)"
    backgroundClip: "text"
    webkitBackgroundClip: "text"
    color: "transparent"
    textShadow: "0 0 32px {colors.accent-glow}, 0 0 64px {colors.brand-glow}"
    animation: "holo-shift 4s ease-in-out infinite"
    description: "Holographic gradient text with animated glow shift"

glass-morphism:
  base:
    background: "rgba(15,23,42,0.5)"
    backdropFilter: "blur(20px) saturate(180%)"
    border: "1px solid rgba(255,255,255,0.06)"
  elevated:
    background: "rgba(15,23,42,0.7)"
    backdropFilter: "blur(32px) saturate(200%)"
    border: "1px solid {colors.border-glow}"
    boxShadow: "{shadow.lg}, {shadow.glow-md}"

# Aspect-ratio behavior
aspectRatio:
  16:9:
    heroScale: 1.0
    statScale: 1.0
    cardCols: 3
  9:16:
    heroScale: 0.85
    statScale: 0.9
    cardCols: 1
  1:1:
    heroScale: 0.9
    statScale: 0.95
    cardCols: 2

# Do's and Don'ts
dos:
  - "Emerald/teal glow is the PROTAGONIST — every scene has breathing radial glows"
  - "3D perspective on cards (rotateY/X) — depth through motion, not shadows"
  - "Rapid particle trails for transitions — 'light glowing rapid 3d movements'"
  - "Space Grotesk for display (tech authority), Inter for reading (clarity)"
  - "Stat numerals at 14cqw — fill the frame, make numbers tangible"
  - "Profit split bars animate ON — investor emerald grows, business indigo follows"
  - "Sharia badge pulses gently — constant trust reinforcement"
  - "Orbit rings rotate slowly — perpetual 3D depth in background"
  - "Glass-morphism with emerald border glow — not flat cards"
  - "Holographic text on hero moments — gradient + animated glow"

donts:
  - "No flat solid backgrounds — always radial glows + orbit rings + particles"
  - "No standard drop shadows — only glow shadows (box-shadow with colored blur)"
  - "No static elements — everything breathes, drifts, pulses, or orbits"
  - "No second accent hue beyond emerald/teal/indigo/purple family"
  - "No web-sized type — video scale (64px+ headlines, 28px+ body)"
  - "No centered-only layouts — anchor left/right, split frames, zones"
  - "No generic particle systems — particles are TRAILS with direction/purpose"
  - "No equalizer bars or waveform displays — content drives visuals, audio drives behavior"
  - "Don't crowd the frame — silence/negative space lets glows breathe"
  - "Don't use generic transitions — gravitational-lens or custom shader for hero moments"

# Known gaps
knownGaps:
  - "Motion specified in composition HTML — frame.md is composition only"
  - "Custom GLSL shaders for 'gravitational-lens' and 'particle-burst' transitions"
  - "Arabic script rendering requires Noto Kufi Arabic / Noto Sans Arabic fonts"
  - "Sharia board endorsement section — placeholder until fatwa published"
  - "Live pool data — render slots as {metric} until script supplies real figures"
---
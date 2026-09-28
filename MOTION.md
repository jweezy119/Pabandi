# MOTION.md — PabandiOS Animation System

> "Nothing loops. Motion only on entrance and interaction." — Phase 2 brief

## Easing Curves

All motion uses three easing curves defined as CSS custom properties in `warm-clay.css`:

| Variable | Curve | Use |
|---|---|---|
| `--ease-clay` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | Buttons, toggles — springy, physical press |
| `--ease-smooth` | `cubic-bezier(0.25, 0.9, 0.35, 1)` | Cards, navigation — calm, deliberate |
| `--ease-entrance` | `cubic-bezier(0.22, 1.0, 0.36, 1)` | Page/element entrances — steady settle |

All durations are in milliseconds. Default transition base: 250ms.

---

## Entrance Animations

### Page entrance (`.clay-fade` + DashboardLayout)

- **What**: Entire page content fades in and rises 4px
- **Duration**: 400ms
- **Easing**: `--ease-entrance`
- **Element**: `<motion.div>` in DashboardLayout wrapping `{children}`
- **Initial state**: `opacity: 0, y: 4`
- **Animated state**: `opacity: 1, y: 0`
- **Before**: Nothing rendered (blank atmosphere background)

### Primary action card delay

- **What**: Primary CTA card fades in after page settles
- **Duration**: 400ms
- **Delay**: 100ms after page entrance begins
- **Class**: `clay-fade clay-delay-1` (or inline `animationDelay: 100ms`)

### Stat cards stagger

- **What**: Each stat card rises from 12px below, fades in
- **Duration**: 400ms per card
- **Delay**: 80ms between each card
- **Class**: `clay-rise` + inline `style={{ animationDelay: \`${index * 80}ms\` }}`
- **Keyframes**: `clay-rise` — `opacity: 0; transform: translateY(12px)` → `opacity: 1; transform: translateY(0)`

### Feed items / list rows stagger

- **What**: List items slide up and fade in sequentially
- **Duration**: 400ms per item
- **Delay**: 60ms between items
- **Class**: `clay-rise` + inline `style={{ animationDelay: \`${index * 60}ms\` }}`
- **Used on**: Client table rows, activity timeline items, deal cards, invoice rows

### Modals & drawers

- **Backdrop**: Fades in 200ms (`opacity: 0` → `opacity: 1`, `ease: 0.2`)
- **Content**: Scales from 0.92 → 1.0 with spring easing, 300ms (`cubic-bezier(0.34, 1.4, 0.64, 1)`)
- **Enter**: `initial={{ opacity: 0, scale: 0.92, y: 12 }}` → `animate={{ opacity: 1, scale: 1, y: 0 }}`
- **Exit (reverse)**: Same curve, `exit={{ opacity: 0, scale: 0.92, y: 12 }}`
- **Esc key**: Triggers `onClose()`, AnimatePresence handles reverse exit automatically
- **Modal component**: `ClayModal` (primitives/Modal.tsx) — Framer Motion `AnimatePresence`
- **Drawer component**: `ClayDrawer` (primitives/ClayDrawer.tsx) — CSS transition `transform 300ms var(--ease-smooth)`; slides from right (default) or left; backdrop fade + Esc close

### Sidebar active indicator

- **What**: Colored indicator dot slides between nav items
- **Mechanism**: Framer Motion `layoutId="nav-indicator"` on the dot element
- **Spring**: `stiffness: 380, damping: 30`
- **Desktop sidebar**: Dot is `absolute left-0 w-1 h-5 rounded-r-full` inside active nav item
- **Mobile bottom tabs**: `layoutId="mobile-tab-indicator"` — `w-8 h-0.5 rounded-full` below active label

### Collapsible groups

- **Chevron rotation**: 250ms, `--ease-clay`
- **Content slide**: `max-height` or `translate-y` transition, 250ms `--ease-smooth`
- **Status**: Built in DashboardLayout sidebar groups

### Tabs indicator

- **Active indicator slide**: Framer Motion `layoutId` across tab buttons
- **Content crossfade**: 200ms opacity transition between tab panels
- **Status**: Not yet built. Client detail uses ClayTabs (unstyled header tabs) currently.

---

## Interaction Animations

### Button press

- **Hover**: `translateY(-1px)`, 150ms `--ease-clay`
- **Active**: `scale(0.97) translateY(1px)`, 80ms ease-out
- **Primary variant**: Background shifts clay → terracotta on hover
- **Loading state**: Spinner replaces content, background dims to soft-stone, box-shadow removed
- **Component**: `Button` (primitives/Button.tsx) — inline styles for variant, CSS for press

### Card hover (interactive)

- **Hover**: `translateY(-2px)`, box-shadow → `--shadow-lift`, 250ms `--ease-smooth`
- **Active**: `scale(0.995)` + `--shadow-pressed`, 80ms ease-out
- **Class**: `clay-card--interactive` on card wrapper
- **Inner glow**: `::before` pseudo-element — 1px top edge gradient (white 80% → transparent 40%) for directional light
- **Component**: `Card` (primitives/Card.tsx) — CSS class `.clay-card` + `.clay-card--interactive`

### Table row hover

- **Hover**: Background → `rgba(232, 217, 197, 0.3)` (warm sand tint)
- **Duration**: 150ms ease
- **Class**: `clay-table-row` or `clay-table-row-clay`
- **Sortable header**: Hover → text darkens to warm-ink, 150ms

### Filter chip toggle

- **Active**: Background → warm-ink, text → white, box-shadow → `--shadow-btn`
- **Inactive**: White background, soft-stone text, border `rgba(191,179,163,0.25)`
- **Hover (inactive)**: Background → `rgba(232,217,197,0.5)`, border → `rgba(201,123,90,0.3)`
- **Duration**: 200ms `--ease-clay`
- **Class**: `clay-filter-chip--active` / `clay-filter-chip--inactive`

### Toggle switch

- **Track**: 250ms `--ease-clay` background transition
- **Thumb**: 250ms `--ease-clay` transform transition
- **Off**: Track `bg-[var(--soft-stone)]/30`, thumb `translate-x-0`
- **On**: Track `bg-[var(--clay)]`, thumb `translate-x-6`
- **Classes**: `clay-toggle-track`, `clay-toggle-thumb`

### Stat icon hover

- **Hover**: `scale(1.05)`, box-shadow intensifies
- **Duration**: 200ms `--ease-clay`
- **Class**: `clay-stat-icon`

### Card inner highlight

- **Always on**: `::before` pseudo-element — 1px top border gradient
- **Gradient**: `rgba(255,255,255,0.8) 0%` → `transparent 40%`
- **Radius**: Matches card top corners only
- **Purpose**: Simulates directional light from upper-left — gives cards physical depth

---

## Atmosphere & Background

### Page background

- **Gradient**: `radial-gradient(ellipse at top left, #F5EFE6 0%, #F0E8DC 60%, #EBE1D2 100%)`
- **Variable**: `--atmosphere`
- **Applied to**: Root layout container (DashboardLayout `<div>`)
- **Effect**: Soft warm light source from upper-left — gives the page a lit, physical feel

### Sidebar shadow (lift from content)

- **Shadow**: `2px 0 16px rgba(180, 130, 90, 0.08)` — `--shadow-sidebar`
- **Direction**: Right-side only (sidebar is left of content)
- **Color**: Warm-tinted, never black

### Modal shadow

- **Shadow**: `0 24px 80px rgba(42,37,32,0.18), 0 8px 24px rgba(180,130,90,0.12)` — `--shadow-modal`
- **Layered**: Dark ink shadow for depth + warm tint for clay identity

---

## Reduced Motion

- **Query**: `@media (prefers-reduced-motion: reduce)`
- **Effect**: All animations → 0.01ms duration, iteration count 1, transitions → 0.01ms
- **Scope**: `*, *::before, *::after`
- **Enforcement**: No exceptions. Static render only when user prefers reduced motion.

---

## Component Reference

| Component | File | Animation |
|---|---|---|
| `Card` | primitives/Card.tsx | Hover lift + press (CSS), entrance (class) |
| `Button` | primitives/Button.tsx | Press (CSS), loading spinner (CSS animate-spin) |
| `Modal` | primitives/Modal.tsx | Backdrop fade + content scale (Framer Motion) |
| `Drawer` | primitives/ClayDrawer.tsx | Slide from edge + backdrop fade (CSS) |
| `Stat` | primitives/Stat.tsx | Entrance stagger (class `clay-rise`) |
| `ClayTable` | primitives/ClayTable.tsx | Row stagger (inline delay), header sort icon |
| `ClayTabs` | primitives/ClayTabs.tsx | Tab border indicator transition (200ms) |
| `ClaySelect` | primitives/ClaySelect.tsx | Menu rise (class `clay-dropdown-menu`), trigger border |
| `ClayToast` | primitives/ClayToast.tsx | Rise entrance (class `clay-toast`), hover shadow |
| `ClaySkeleton` | primitives/ClaySkeleton.tsx | Pulse via `clay-skeleton-pulse` keyframes |
| `ClayBadge` | primitives/ClayBadge.tsx | None (static label) |
| `StatusChip` | primitives/StatusChip.tsx | None (static label) |
| `ClayDropdown` | primitives/ClayDropdown.tsx | Menu rise (class `clay-dropdown-menu-clay`) |
| `ModuleSwitcher` | ModuleSwitcher.tsx | Dropdown fade + upward slide, stagger children (60ms) |
| `NotificationBell` | NotificationBell.tsx | Drawer slide from right, list stagger |

---

## Shock Faithful (Reference)

These are the original motion principles from the brief that we preserve:

1. Everything fades up and in on entrance — nothing pops or jolts
2. Stagger is always sequential, never random — each item waits for the previous
3. Interaction is tactile — buttons feel pressable, cards feel liftable
4. No looping animations anywhere — motion is a response, not a decoration
5. Shadows are warm-tinted (rgba(180, 130, 90, ...)) — never pure black
6. `prefers-reduced-motion` shuts everything down — no exceptions

---

## NEW MORPHS (Part C — UI Morphs)

### 1. Sidebar Item Toggle (Settings → Modules)

- **Trigger**: User toggles a module on/off in `/contact/settings/modules`
- **On Enable**: Item slides into sidebar with spring (300ms `cubic-bezier(0.34, 1.4, 0.64, 1)`)
- **On Disable**: Item fades + slides out, remaining items shift up smoothly (Framer Motion `layout`)
- **Stagger**: 60ms delay between each nav item
- **Files**: `ModulesSettingsPage.tsx`, `DashboardLayout.tsx`
- **Component**: `MorphItem`, `StaggerContainer`, `StaggerItem` in `MorphAnimations.tsx`

### 2. Pipeline Stages (Settings → Pipeline)

- **Drag to reorder**: Other stages animate to new positions (Framer Motion `layout`)
- **Add stage**: New column slides in from right with spring (300ms)
- **Delete stage**: Column collapses width to 0, others shift left (300ms `AnimatePresence mode="popLayout"`)
- **Rename**: Label crossfades (implicit via `layout`)
- **While dragging**: Item scales to 1.02, lifts with `--shadow-lift`
- **Files**: `PipelineSettingsPage.tsx`

### 3. Custom Fields (Settings → Custom Fields)

- **Add field**: New row fades in from top with slight scale (300ms spring)
- **Delete field**: Row collapses height to 0 (300ms `AnimatePresence mode="popLayout"`)
- **Reorder**: Items morph to new positions (Framer Motion `layout`)
- **Files**: `CustomFieldsPage.tsx`

### 4. Widget Grid (Dashboard)

- **Add widget**: Grid reflows with Framer Motion `layout` (spring 300ms)
- **Remove widget**: Grid closes the gap smoothly (300ms `AnimatePresence`)
- **Resize widget**: Neighbors slide to accommodate (layout animations)
- **Files**: `DashboardLayout.tsx` (sidebar nav items use `layout` for reflow)

### 5. Vertical Preset Application (Onboarding)

- **When user picks a vertical**: Sidebar items fade in one by one (staggered 60ms) with small spring
- **Trigger**: Module selection changes `enabledFeatures` → `navItems` array updates
- **Mechanism**: DashboardLayout `navItemsMounted` state + Framer Motion `staggerChildren: 0.06`
- **Files**: `DashboardLayout.tsx`

### 6. Module Switcher

- **Dropdown opens**: Fade + slight upward slide (200ms `cubic-bezier(0.25, 0.9, 0.35, 1)`)
- **Selection**: Smooth page transition (existing) + sidebar items stagger in (60ms)
- **Chevron rotation**: 200ms `--ease-smooth`
- **Files**: `ModuleSwitcher.tsx`

---

## General Rules for New Morphs

- Every morph uses the clay easing:
  - Entrances: `cubic-bezier(0.25, 0.9, 0.35, 1)` (`--ease-smooth`)
  - Springs: `cubic-bezier(0.34, 1.4, 0.64, 1)` (`--ease-clay`)
- Durations: 200-400ms max
- Nothing loops
- Respects `prefers-reduced-motion`
- Every morph must feel tactile, not mechanical
- Use Framer Motion `layout` for shared layout animations (reordering, add/remove)
- Use `AnimatePresence mode="popLayout"` for exit animations that affect sibling positions

---

## TODO

- [ ] Tab content crossfade (200ms) — when ClayTabs gets panel content
- [ ] Count-up animation on stat numbers (800ms on load) — for dashboard stats
- [ ] Feed items slide-from-left variant (currently use clay-rise; could add clay-slide-left)
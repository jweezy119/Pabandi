# Pabandi — Onboarding AHA Flow Spec
For devs / designers. Ordered by screen, goal, data requirement, and interaction.

## North Star
Get the user from open → first real nearby result → understood value in under 10 seconds. No tutorial, no walls of text. Just immediate usefulness.

## Screen 1 — Permissions & First Value
**Show immediately on first launch, no splash needed.**

Header: small logo + tagline: "Pabandi: Commitment, secured."

Body copy (short):
> We use your location to show real nearby businesses and protect your bookings.

Buttons:
- Primary: "Use my location"
- Secondary: "Browse without location"

**If user grants location:**
- Immediately fetch public businesses with user lat/lng
- Sort by proximity/rating/reliability
- Transition directly to Home map/list populated

**If user declines:**
- Show Home with generic curated list
- Keep "Near Me" button visible as persistent retry

## Screen 2 — Zero-State Map / List (First 10s)
**Goal: show value before they type anything.**

- Map renders centered on user location
- Drop up to 8 markers for truly nearby businesses
- List below shows same businesses with:
  - distance (km)
  - rating
  - reliability score badge
- If nearby results are sparse due to DB coverage:
  - Show OSM/Overpass results clearly marked "Importing from public maps"
  - Never show fake coordinates or stale fallback locations

## Screen 3 — One-Tap Booking Value Layer
**Goal: prove protection and reward before first payment.**

When user taps a business card or map marker:
- Show mini sheet with 3 bullets:
  1. "This business honored 94% of bookings this month"
  2. "$X held in escrow until you confirm service"
  3. "Earn ~Y $PAB for showing up"
- Big CTA: "Reserve — funds held safely"

Do not route to business detail page first. The booking CTA must be one tap from map/list.

## Screen 4 — Post-Booking Reputation Lock
**Goal: make the aha permanent.**

After first completed booking:
- Single full-screen success state
- One stat: "Your Trust Score entry is now verifiable on-chain. This stays with you across every city, platform, and service type."
- One CTA: "Explore more nearby"

No modals, no multiple CTAs, no surveys.

## Repeat Usage — "Near Me" Default
Every subsequent launch:
- If permission retained, auto-load nearby
- If permission lost, show retry prompt inline
- Search bar reads: "Search a city, venue or address..."

## Data Requirements
- Frontend: geolocation prompt, react-query cache keyed on `["businesses", category, userLoc, search]`
- Backend: businesses route must honor `latitude`/`longitude` and sort by haversine; never inject fallback coordinates for missing locations
- Backend: allow cache window of 60s for location-based queries to keep it fast
- If Overpass/LocationIQ fails, show "No exact matches found" with retry — do not show random distant businesses

## Non-Negotiables
- No walls of text
- No "please complete your profile" gates before value
- No empty state on first load when location is granted
- No fake or hard-coded nearby results

## Copy Notes
- Use $PAB, not Points
- US-first English
- "Commitments, secured." as closing line only — not in every screen
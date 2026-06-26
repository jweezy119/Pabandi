# Dashboard Missing Functionality Audit
# Dashboard Missing Functionality Audit

## Current state
- `dashboard` is included in `docker-compose.yml` and is referenced from the client shell (`/dashboard`).
- `dashboard/src/App.tsx` is present and renders tabs (`overview`, `network`, `integration`).
- `dashboard` standalone app builds with explicit `npm run build` triggers from `dashboard/package.json`.
- The current dashboard root is mocked: screens render sample charts and local state.

## Confirmed gaps / blockers
1. Dashboard build is currently blocked by TypeScript unused-variable errors in:
   - `src/App.tsx`
   - `src/screens/OverviewScreen.tsx`
   - `src/screens/NetworkScreen.tsx`
   - `src/screens/IntegrationScreen.tsx`
2. Dashboard has no real data binding yet:
   - `OverviewScreen` uses hardcoded weekly stats and does not call server APIs.
   - `NetworkScreen` simulates live hashes and has no API fetch.
   - `IntegrationScreen` returns static strings instead of user-specific credentials.
3. Dashboard is not wired into client navigation. The canonical authenticated app lives in `client/src/App.tsx`; `dashboard/` is currently a side app.

## Recommended build order
1. Unblock dashboard build by fixing TypeScript unused imports/exports in the four files above.
2. Replace stub data with derived service calls to `server/src/routes/*` equivalents.
3. Decide whether to embed dashboard inside `client` or keep it as a neighboring app, then align with `docker-compose` and routing.

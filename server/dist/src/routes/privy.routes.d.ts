/**
 * privy.routes.ts — Privy webhook and organization wallet endpoints
 *
 * Routes:
 *   POST /api/v1/privy/webhook   — Privy webhook receiver (no auth, signature verified)
 *   POST /api/v1/privy/onboard   — Create org wallet (auth: ADMIN)
 *   GET  /api/v1/privy/wallet/:id — Get wallet info (auth: ADMIN)
 *   POST /api/v1/privy/spons     — Sponsor gas (auth: ADMIN)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=privy.routes.d.ts.map
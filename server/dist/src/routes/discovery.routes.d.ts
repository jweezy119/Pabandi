/**
 * Agent discovery files, served by the API itself.
 *
 * These are the files an agent actually fetches when it lands on the host:
 * llms.txt, robots.txt, and the OpenAPI spec. They used to be copied into the
 * client bundle by hand, which meant the served copy silently drifted from the
 * real one (stale tool list, a dead api.pabandi.com base URL, /openapi.yaml
 * returning index.html because the SPA fallback answered it).
 *
 * Now they are read from the canonical files in this repo at request time, so
 * the served bytes cannot disagree with what we generate.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=discovery.routes.d.ts.map
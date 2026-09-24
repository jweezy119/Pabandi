declare const router: import("express-serve-static-core").Router;
declare const OFFLINE_BUSINESSES: any[];
export { OFFLINE_BUSINESSES };
/** Idempotently insert the offline business seed. Returns number inserted. */
export declare function seedOfflineBusinesses(): Promise<number>;
export default router;
//# sourceMappingURL=seed.routes.d.ts.map
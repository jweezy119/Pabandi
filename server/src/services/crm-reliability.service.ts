/**
 * crm-reliability.service.ts — compatibility shim. The maths moved.
 *
 * WHY THIS FILE IS NOW EMPTY
 *
 * This was one of three concurrent implementations of the same scoring (the
 * others being `reliability.service.ts` and `trust-core.service.ts`), and the
 * three had drifted: different default penalties, different stage precedence. A
 * client's score therefore depended on which code path happened to ask. That
 * history is recorded in git; there is no reason to keep a fourth path open.
 *
 * It is now a pure re-export so the existing import sites
 * (`revenue.controller`, `crm.service`) keep working without a second source of
 * truth. Nothing here computes or persists anything.
 *
 * If you are here to change how a score is calculated: the implementation is in
 * `trust-core.service.ts`, the weights are in `config/trust-weights.ts`, and the
 * single write path is `writeReliabilityScore`. There is nowhere else it lives,
 * by design — see the header of `trust-core.service.ts`.
 */
export {
  getClientStage,
  refreshClientTrust,
  recomputeClientScore,
} from './trust-core.service';
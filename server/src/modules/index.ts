/**
 * Module catalogue.
 *
 * Importing this file is what installs every layer into the registry. Following
 * the same convention as `pabandiToolsRegistry` and the Express route map: one
 * import gives you the whole system, and `index.ts` only has to know about this.
 */

import './adapters/booking-property.modules';
import './adapters/capital-trust.modules';
import './adapters/crm-payments-core.modules';

export { moduleRegistry, ModuleRegistry } from './contract';
export type {
  ModuleFacts,
  ModuleHealth,
  ModuleId,
  ModuleMoney,
  ModuleResult,
  ModuleScope,
  ModuleTimelineEntry,
  PabandiModule,
} from './contract';

import { moduleRegistry } from './contract';

// Fail fast at boot rather than on the first dashboard request that happens to
// need the broken module.
moduleRegistry.assertSatisfiable();
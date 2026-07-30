import { OpenWAService } from './openwa.service';
import { WhatsAppProvider } from './whatsapp.provider';
import { EvolutionProvider } from './evolution.service';
import { logger } from '../utils/logger';

const providerType = process.env.WA_PROVIDER || 'openwa';
const enableShadowSend = process.env.WA_SHADOW_SEND === 'true';

let primaryProvider: WhatsAppProvider;
let shadowProvider: WhatsAppProvider | null = null;

if (providerType === 'evolution') {
  primaryProvider = new EvolutionProvider();
  if (enableShadowSend) shadowProvider = new OpenWAService();
} else {
  primaryProvider = new OpenWAService();
  if (enableShadowSend) shadowProvider = new EvolutionProvider();
}

/**
 * Proxy handler to support Shadow-Sending.
 * It routes all method calls to the primary provider, and asynchronously mirrors
 * the call to the shadow provider (if enabled) without blocking or crashing.
 */
export const openwaService: WhatsAppProvider = new Proxy(primaryProvider, {
  get(target, propKey, receiver) {
    const origMethod = (target as any)[propKey];
    if (typeof origMethod === 'function') {
      return function (...args: any[]) {
        const result = origMethod.apply(target, args);
        
        const isActionMethod = String(propKey).startsWith('send') || String(propKey).startsWith('assign') || String(propKey).startsWith('create') || String(propKey).startsWith('reply');
        if (isActionMethod && shadowProvider && typeof (shadowProvider as any)[propKey] === 'function') {
          // Fire and forget on the shadow provider
          try {
            const shadowMethod = (shadowProvider as any)[propKey];
            const shadowPromise = shadowMethod.apply(shadowProvider, args);
            if (shadowPromise instanceof Promise) {
              shadowPromise.catch((err: any) => {
                logger.warn(`[ShadowSend] ${String(propKey)} failed on shadow provider: ${err?.message}`);
              });
            }
          } catch (err) {
            logger.warn(`[ShadowSend] Error invoking ${String(propKey)} on shadow provider.`);
          }
        }
        
        return result;
      };
    }
    return Reflect.get(target, propKey, receiver);
  }
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openwaService = void 0;
const openwa_service_1 = require("./openwa.service");
const evolution_service_1 = require("./evolution.service");
const logger_1 = require("../utils/logger");
const providerType = process.env.WA_PROVIDER || 'openwa';
const enableShadowSend = process.env.WA_SHADOW_SEND === 'true';
let primaryProvider;
let shadowProvider = null;
if (providerType === 'evolution') {
    primaryProvider = new evolution_service_1.EvolutionProvider();
    if (enableShadowSend)
        shadowProvider = new openwa_service_1.OpenWAService();
}
else {
    primaryProvider = new openwa_service_1.OpenWAService();
    if (enableShadowSend)
        shadowProvider = new evolution_service_1.EvolutionProvider();
}
/**
 * Proxy handler to support Shadow-Sending.
 * It routes all method calls to the primary provider, and asynchronously mirrors
 * the call to the shadow provider (if enabled) without blocking or crashing.
 */
exports.openwaService = new Proxy(primaryProvider, {
    get(target, propKey, receiver) {
        const origMethod = target[propKey];
        if (typeof origMethod === 'function') {
            return function (...args) {
                const result = origMethod.apply(target, args);
                const isActionMethod = String(propKey).startsWith('send') || String(propKey).startsWith('assign') || String(propKey).startsWith('create') || String(propKey).startsWith('reply');
                if (isActionMethod && shadowProvider && typeof shadowProvider[propKey] === 'function') {
                    // Fire and forget on the shadow provider
                    try {
                        const shadowMethod = shadowProvider[propKey];
                        const shadowPromise = shadowMethod.apply(shadowProvider, args);
                        if (shadowPromise instanceof Promise) {
                            shadowPromise.catch((err) => {
                                logger_1.logger.warn(`[ShadowSend] ${String(propKey)} failed on shadow provider: ${err?.message}`);
                            });
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn(`[ShadowSend] Error invoking ${String(propKey)} on shadow provider.`);
                    }
                }
                return result;
            };
        }
        return Reflect.get(target, propKey, receiver);
    }
});
//# sourceMappingURL=whatsapp.service.js.map
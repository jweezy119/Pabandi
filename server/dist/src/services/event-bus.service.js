"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
const logger_1 = require("../utils/logger");
class EventBus {
    constructor() {
        this.handlers = new Map();
    }
    subscribe(type, handler) {
        const existing = this.handlers.get(type) || [];
        this.handlers.set(type, [...existing, handler]);
        return () => {
            const current = this.handlers.get(type) || [];
            this.handlers.set(type, current.filter(h => h !== handler));
        };
    }
    publish(event) {
        const typeHandlers = this.handlers.get(event.type) || [];
        const allHandlers = this.handlers.get('*') || [];
        [...typeHandlers, ...allHandlers].forEach(handler => {
            try {
                handler(event);
            }
            catch (err) {
                logger_1.logger.error(`[EventBus] Handler error: ${err.message}`);
            }
        });
        logger_1.logger.info(`[EventBus] ${event.type}`, event.data);
    }
    emitEvent(type, data) {
        this.publish({ type: type, data, timestamp: new Date() });
    }
}
exports.eventBus = new EventBus();
//# sourceMappingURL=event-bus.service.js.map
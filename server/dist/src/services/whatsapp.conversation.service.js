"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveConversationSignal = void 0;
const memory = new Map();
const saveConversationSignal = async (phone, businessId, userMessage, agentReply, traceId) => {
    const key = `${phone}:${businessId}`;
    const history = memory.get(key) || [];
    history.push({ phone, businessId, userMessage, agentReply, traceId, createdAt: new Date() });
    memory.set(key, history.slice(-20));
};
exports.saveConversationSignal = saveConversationSignal;
//# sourceMappingURL=whatsapp.conversation.service.js.map
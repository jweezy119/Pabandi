"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openwaChatFlowService = exports.OpenWAChatFlowService = void 0;
const whatsapp_service_1 = require("./whatsapp.service");
const openwa_plugins_service_1 = require("./openwa.plugins.service");
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID || process.env.OPENWA_SESSION || 'default';
const FLOW_TTL_MS = 15 * 60 * 1000;
class OpenWAChatFlowService {
    async resolveSessionId() {
        try {
            return await whatsapp_service_1.openwaService.resolveSessionId();
        }
        catch {
            return OPENWA_SESSION_ID;
        }
    }
    async getInstalledPlugins(sessionId) {
        try {
            const audit = await whatsapp_service_1.openwaService.getAudit({ action: 'plugin_installed', sessionId });
            if (Array.isArray(audit))
                return audit;
        }
        catch {
            // OpenWA may not expose plugin audit in this version; degrade gracefully.
        }
        const catalog = (0, openwa_plugins_service_1.getPluginCatalog)();
        const matched = (0, openwa_plugins_service_1.findPluginsByKeywords)(['chat', 'flow', 'menu', 'auto-reply'], catalog);
        return matched.map(plugin => ({ id: plugin.id }));
    }
    isChatFlowLikelyAvailable() {
        return this.getInstalledPluginsSync().some(plugin => plugin.id === 'chat-flow');
    }
    getInstalledPluginsSync() {
        const catalog = (0, openwa_plugins_service_1.getPluginCatalog)();
        const matched = (0, openwa_plugins_service_1.findPluginsByKeywords)(['chat', 'flow', 'menu', 'auto-reply'], catalog);
        return matched.map(plugin => ({ id: plugin.id }));
    }
    async sendOutreachFlow(toPhone, context = {}) {
        if (!this.isChatFlowLikelyAvailable()) {
            return {
                sent: false,
                pluginDetected: false,
                status: 'skipped',
            };
        }
        const greeting = [
            `Pabandi outreach for${context.businessName ? ` *${context.businessName}*` : ' your business'}.`,
            ``,
            `1) Claim profile`,
            `2) View bookings`,
            `3) Enable escrow + $PAB rewards`,
        ]
            .filter(Boolean)
            .join('\n');
        const sessionId = await this.resolveSessionId();
        try {
            const result = await whatsapp_service_1.openwaService.sendText(toPhone, greeting, {
                sessionId,
                pluginContext: 'pabandi:chat-flow',
            });
            return {
                sent: true,
                pluginDetected: true,
                engine: result.engine,
                messageId: result.messageId,
                status: result.status === 'failed' ? 'failed' : 'queued',
            };
        }
        catch (error) {
            return {
                sent: false,
                pluginDetected: true,
                status: `error:${error?.message || error}`,
            };
        }
    }
    async sendBulkOutreachFlow(toPhones, context = {}) {
        if (!this.isChatFlowLikelyAvailable() || !toPhones.length) {
            return { sent: false, status: 'skipped' };
        }
        const greeting = context.campaignCopy || [
            `Pabandi outreach for${context.businessName ? ` *${context.businessName}*` : ' your business'}.`,
            ``,
            `1) Claim profile`,
            `2) View bookings`,
            `3) Enable escrow + $PAB rewards`,
        ].filter(Boolean).join('\n');
        const sessionId = await this.resolveSessionId();
        // Enforce daily cap for AI campaigns
        let targetPhones = toPhones;
        if (context.dailyCap && context.dailyCap > 0 && targetPhones.length > context.dailyCap) {
            targetPhones = targetPhones.slice(0, context.dailyCap);
            console.log(`[Campaign] Capped bulk send to ${context.dailyCap} contacts (original: ${toPhones.length})`);
        }
        const messages = targetPhones.map(phone => ({
            chatId: `${String(phone).replace(/[^\d]/g, '')}@c.us`,
            text: greeting
        }));
        try {
            const result = await whatsapp_service_1.openwaService.sendBulk(messages, {
                sessionId,
                delayBetweenMessages: context.delayBetweenMessages || 3000
            });
            return {
                sent: true,
                batchId: result.batchId,
                status: result.status,
                totalMessages: result.totalMessages
            };
        }
        catch (error) {
            return { sent: false, status: `error:${error?.message || error}` };
        }
    }
    evaluateMenuByText(flow, currentState, messageBody) {
        const input = messageBody.trim().toLowerCase();
        const shouldRestart = ['menu', 'help', 'start'].includes(input);
        if (shouldRestart) {
            return {
                reply: flow.greeting,
                nextState: { path: [], lastActive: Date.now() },
            };
        }
        const normalized = ['1', '2', '3'].includes(input) ? input : input;
        const currentRoot = currentState?.path && currentState.path.length > 0
            ? this.resolveOptionsAtPath(flow.options, currentState.path)
            : flow.options;
        const hasOption = typeof currentRoot === 'object' &&
            currentRoot !== null &&
            Object.prototype.hasOwnProperty.call(currentRoot, normalized);
        if (!hasOption || typeof currentRoot !== 'object' || currentRoot === null) {
            return {
                reply: `Invalid option. Please choose one of the available options:\n\n${flow.greeting}`,
                nextState: currentState || { path: [], lastActive: Date.now() },
            };
        }
        const node = currentRoot[normalized];
        const nextPath = currentState?.path ? [...currentState.path, (node && node.key) || normalized] : [normalized];
        if ((node && node.options && Object.keys(node.options).length > 0) || false) {
            return {
                reply: node ? node.text || flow.greeting : flow.greeting,
                nextState: { path: nextPath, lastActive: Date.now() },
            };
        }
        return { reply: node ? node.text || flow.greeting : flow.greeting, nextState: null };
    }
    isExpired(state) {
        if (!state)
            return true;
        return Date.now() - state.lastActive > FLOW_TTL_MS;
    }
    resolveOptionsAtPath(root, path) {
        let node = { key: '', text: '', options: root };
        for (let index = 0; index < path.length; index += 1) {
            const key = path[index];
            const options = node ? node.options : undefined;
            let next;
            if (options && Object.prototype.hasOwnProperty.call(options, key)) {
                next = options[key];
            }
            node = next;
        }
        return node ? node.options : undefined;
    }
}
exports.OpenWAChatFlowService = OpenWAChatFlowService;
exports.openwaChatFlowService = new OpenWAChatFlowService();
//# sourceMappingURL=openwa.chat-flow.service.js.map
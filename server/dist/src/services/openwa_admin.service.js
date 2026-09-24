"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectivePluginConfigs = exports.updateAdminPlugin = exports.getAdminPlugin = exports.listAdminPlugins = void 0;
const fs_1 = require("fs");
const openwa_plugins_service_1 = require("./openwa.plugins.service");
const CONFIG_PATH = process.env.PABANDI_PLUGIN_CONFIG_PATH || './.openwa-plugin-configs.json';
const memoryStore = {};
function loadStore() {
    try {
        if ((0, fs_1.existsSync)(CONFIG_PATH)) {
            const raw = (0, fs_1.readFileSync)(CONFIG_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                Object.assign(memoryStore, parsed);
            }
        }
    }
    catch {
        // ignore malformed config file and fall back to memory defaults
    }
    return memoryStore;
}
function persistStore() {
    try {
        (0, fs_1.writeFileSync)(CONFIG_PATH, JSON.stringify(memoryStore, null, 2));
    }
    catch {
        // ignore disk write failures; in-memory state still works for current process
    }
}
function getRecord(pluginId) {
    return memoryStore[pluginId] || {
        pluginId,
        enabled: true,
        config: {},
        updatedAt: new Date().toISOString(),
    };
}
const listAdminPlugins = () => {
    const catalog = (0, openwa_plugins_service_1.getPluginCatalog)();
    const store = loadStore();
    return catalog.plugins.map(plugin => {
        const record = store[plugin.id] || {
            pluginId: plugin.id,
            enabled: true,
            config: {},
            updatedAt: new Date().toISOString(),
        };
        return {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            status: plugin.status,
            description: plugin.description,
            keywords: plugin.keywords,
            homepage: plugin.homepage,
            repoPath: plugin.repoPath,
            enabled: record.enabled,
            updatedAt: record.updatedAt,
        };
    });
};
exports.listAdminPlugins = listAdminPlugins;
const getAdminPlugin = (pluginId) => {
    const catalog = (0, openwa_plugins_service_1.getPluginCatalog)();
    const plugin = catalog.plugins.find(item => item.id === pluginId);
    const record = getRecord(pluginId);
    if (!plugin) {
        return null;
    }
    return {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        status: plugin.status,
        description: plugin.description,
        keywords: plugin.keywords,
        homepage: plugin.homepage,
        repoPath: plugin.repoPath,
        config: record.config,
        enabled: record.enabled,
        updatedAt: record.updatedAt,
    };
};
exports.getAdminPlugin = getAdminPlugin;
const updateAdminPlugin = (pluginId, payload = {}) => {
    const record = getRecord(pluginId);
    const previousEnabled = record.enabled;
    if (payload.enabled !== undefined) {
        record.enabled = Boolean(payload.enabled);
    }
    if (payload.config) {
        record.config = payload.config;
    }
    record.updatedAt = new Date().toISOString();
    memoryStore[pluginId] = record;
    persistStore();
    const changed = previousEnabled !== undefined && previousEnabled !== record.enabled;
    return {
        record,
        changed,
        effect: changed
            ? record.enabled
                ? 'plugin_enabled'
                : 'plugin_disabled'
            : 'config_updated',
    };
};
exports.updateAdminPlugin = updateAdminPlugin;
const getEffectivePluginConfigs = () => {
    const store = loadStore();
    const response = {};
    for (const plugin of (0, openwa_plugins_service_1.getPluginCatalog)().plugins) {
        const record = store[plugin.id];
        response[plugin.id] = {
            enabled: record ? record.enabled : true,
            config: record ? record.config : {},
        };
    }
    return response;
};
exports.getEffectivePluginConfigs = getEffectivePluginConfigs;
//# sourceMappingURL=openwa_admin.service.js.map
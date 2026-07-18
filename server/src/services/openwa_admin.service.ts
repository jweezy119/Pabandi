import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getPluginCatalog, findPluginsByKeywords } from './openwa.plugins.service';

const CONFIG_PATH = process.env.PABANDI_PLUGIN_CONFIG_PATH || './.openwa-plugin-configs.json';

export interface PluginConfigRecord {
  pluginId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedAt: string;
}

type PluginConfigStore = Record<string, PluginConfigRecord>;

const memoryStore: PluginConfigStore = {};

function loadStore(): PluginConfigStore {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(memoryStore, parsed as PluginConfigStore);
      }
    }
  } catch {
    // ignore malformed config file and fall back to memory defaults
  }
  return memoryStore;
}

function persistStore() {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(memoryStore, null, 2));
  } catch {
    // ignore disk write failures; in-memory state still works for current process
  }
}

function getRecord(pluginId: string): PluginConfigRecord {
  return memoryStore[pluginId] || {
    pluginId,
    enabled: true,
    config: {},
    updatedAt: new Date().toISOString(),
  };
}

export const listAdminPlugins = () => {
  const catalog = getPluginCatalog();
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

export const getAdminPlugin = (pluginId: string) => {
  const catalog = getPluginCatalog();
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

export const updateAdminPlugin = (pluginId: string, payload: { enabled?: boolean; config?: Record<string, unknown> } = {}) => {
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

export const getEffectivePluginConfigs = () => {
  const store = loadStore();
  const response: Record<string, { enabled: boolean; config: Record<string, unknown> }> = {};

  for (const plugin of getPluginCatalog().plugins) {
    const record = store[plugin.id];
    response[plugin.id] = {
      enabled: record ? record.enabled : true,
      config: record ? record.config : {},
    };
  }

  return response;
};

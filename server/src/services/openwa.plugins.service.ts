import fs from 'fs';
import path from 'path';

export interface OutreachCatalogPlugin {
  id: string;
  name: string;
  version?: string;
  status?: string;
  description?: string;
  keywords?: string[];
  homepage?: string;
  repoPath?: string;
}

export interface OutreachCatalog {
  plugins: OutreachCatalogPlugin[];
  loadedFrom?: string;
}

export interface OutreachContext {
  baseMessage: string;
  businessName: string;
  reservationDate?: string;
  reservationTime?: string;
  guests?: number;
  claimUrl?: string;
}

let cachedCatalog: OutreachCatalog | null = null;

export const getPluginCatalog = (): OutreachCatalog => {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const candidates = [
    path.resolve(process.cwd(), 'OpenWA-plugins', 'plugins.json'),
    path.resolve(process.cwd(), 'OpenWA', 'plugins.json'),
    path.resolve(__dirname, '../../../../OpenWA-plugins/plugins.json'),
    path.resolve(__dirname, '../../../OpenWA-plugins/plugins.json'),
  ];

  let loadedFrom: string | undefined;
  let plugins: OutreachCatalogPlugin[] = [];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw) as OutreachCatalogPlugin[];
        if (Array.isArray(parsed)) {
          plugins = parsed.filter(Boolean);
          loadedFrom = candidate;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  cachedCatalog = { plugins, loadedFrom };
  return cachedCatalog;
};

export const clearPluginCatalogCache = () => {
  cachedCatalog = null;
};

export const findPluginsByKeywords = (keywords: string[], catalog?: OutreachCatalog) => {
  const source = catalog || getPluginCatalog();
  const matched: OutreachCatalogPlugin[] = [];
  const hay = new Set(keywords.map(k => k.toLowerCase()));

  for (const plugin of source.plugins) {
    const values = [
      plugin.id,
      plugin.name,
      plugin.description,
      ...(plugin.keywords || []),
      plugin.homepage,
      plugin.repoPath,
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase());

    const score = values.reduce((count, value) => count + [...hay].filter(term => value.includes(term)).length, 0);
    if (score > 0) {
      matched.push(plugin);
    }
  }

  return matched.slice(0, 5);
};

export const buildPluginFooters = (plugins: OutreachCatalogPlugin[]) => {
  if (!plugins.length) {
    return '';
  }

  const lines = ['', 'Suggested OpenWA plugins for this booking context:'];
  for (const plugin of plugins) {
    const name = plugin.name || plugin.id;
    const label = plugin.version ? `${name} v${plugin.version}` : name;
    lines.push(`- ${label}: ${plugin.homepage || plugin.repoPath || plugin.id}`);
  }

  return lines.join('\n');
};

export const buildOutreachMessageFromCatalog = (context: OutreachContext): string => {
  const catalog = getPluginCatalog();
  const keywordHints = ['booking', 'outreach', 'claim', 'reservation', 'after-hours', 'chat', 'automation'];

  const matched = findPluginsByKeywords(keywordHints, catalog);
  const footer = buildPluginFooters(matched);

  const trimmedBase = context.baseMessage.trim();
  const candidate = footer ? `${trimmedBase}\n\n${footer}` : trimmedBase;

  if (candidate.length <= 4096) {
    return candidate;
  }

  return trimmedBase;
};

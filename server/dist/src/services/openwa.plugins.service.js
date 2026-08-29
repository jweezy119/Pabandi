"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOutreachMessageFromCatalog = exports.buildPluginFooters = exports.buildPluginSummary = exports.findPluginsByKeywords = exports.selectPlugins = exports.scorePlugin = exports.getPluginCatalog = exports.clearPluginCatalogCache = exports.loadPluginCatalog = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let cachedCatalog = null;
const loadPluginCatalog = () => {
    if (cachedCatalog) {
        return cachedCatalog;
    }
    const packageJsonPath = path_1.default.resolve(process.cwd(), 'PluginCatalog.json');
    if (fs_1.default.existsSync(packageJsonPath)) {
        try {
            const raw = fs_1.default.readFileSync(packageJsonPath, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                cachedCatalog = { plugins: parsed.filter(Boolean) };
                return cachedCatalog;
            }
        }
        catch {
            // ignore parse errors and fall back to default catalog
        }
    }
    cachedCatalog = { plugins: defaultPlugins };
    return cachedCatalog;
};
exports.loadPluginCatalog = loadPluginCatalog;
const clearPluginCatalogCache = () => {
    cachedCatalog = null;
};
exports.clearPluginCatalogCache = clearPluginCatalogCache;
const getPluginCatalog = () => (0, exports.loadPluginCatalog)();
exports.getPluginCatalog = getPluginCatalog;
const scorePlugin = (plugin, keywords, context) => {
    const text = [
        plugin.id,
        plugin.name,
        plugin.description,
        ...(plugin.keywords || []),
        plugin.homepage,
        plugin.repoPath,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    const normalizedKeywords = keywords.map(keyword => keyword.toLowerCase());
    const contextText = context
        ? Object.values(context).filter(Boolean).join(' ').toLowerCase()
        : '';
    let score = 0;
    for (const keyword of normalizedKeywords) {
        if (text.includes(keyword)) {
            score += 3;
        }
        if (keyword.length > 3 && contextText.includes(keyword)) {
            score += 1;
        }
    }
    return {
        id: plugin.id,
        name: plugin.name || plugin.id,
        version: plugin.version,
        description: plugin.description || '',
        homepage: plugin.homepage || plugin.repoPath || plugin.id,
        score,
    };
};
exports.scorePlugin = scorePlugin;
const selectPlugins = (keywords, context, limit = 3) => {
    const catalog = (0, exports.loadPluginCatalog)();
    const scored = catalog.plugins
        .map(plugin => (0, exports.scorePlugin)(plugin, keywords, context))
        .filter(plugin => plugin.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    return scored;
};
exports.selectPlugins = selectPlugins;
const findPluginsByKeywords = (keywords, catalog) => {
    const source = catalog || (0, exports.loadPluginCatalog)();
    return source.plugins
        .filter(plugin => {
        const text = [
            plugin.id,
            plugin.name,
            plugin.description,
            ...(plugin.keywords || []),
            plugin.homepage,
            plugin.repoPath,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return keywords.some(keyword => keyword.length > 2 && text.includes(keyword.toLowerCase()));
    })
        .slice(0, 5);
};
exports.findPluginsByKeywords = findPluginsByKeywords;
const buildPluginSummary = (plugins) => {
    if (!plugins.length) {
        return '';
    }
    const lines = [
        '',
        'Plugins that match your workflow:',
        ...plugins.map(plugin => `• ${plugin.name}: ${plugin.homepage}`),
    ];
    return lines.join('\n');
};
exports.buildPluginSummary = buildPluginSummary;
const buildPluginFooters = (plugins) => {
    const items = plugins
        .map(plugin => {
        const name = plugin.name || plugin.id;
        const label = plugin.version ? `${name} v${plugin.version}` : name;
        return `- ${label}: ${plugin.homepage || plugin.repoPath || plugin.id}`;
    });
    if (!items.length) {
        return '';
    }
    return ['', 'Suggested OpenWA plugins for this booking context:', ...items].join('\n');
};
exports.buildPluginFooters = buildPluginFooters;
const buildOutreachMessageFromCatalog = (context) => {
    const catalog = (0, exports.getPluginCatalog)();
    const keywordHints = [
        context.reservationTime ? 'reservation' : 'booking',
        'outreach',
        'claim',
        context.reservationTime ? 'reservation' : 'booking',
        'chat',
        'automation',
    ];
    const matched = (0, exports.findPluginsByKeywords)(keywordHints, catalog);
    const footer = (0, exports.buildPluginFooters)(matched);
    const trimmedBase = context.baseMessage.trim();
    const candidate = footer ? `${trimmedBase}\n\n${footer}` : trimmedBase;
    if (candidate.length <= 4096) {
        return candidate;
    }
    return trimmedBase;
};
exports.buildOutreachMessageFromCatalog = buildOutreachMessageFromCatalog;
const defaultPlugins = [
    {
        id: 'pabandi-trust-oracle',
        name: 'Pabandi Trust Oracle',
        version: '1.3.0',
        status: 'stable',
        description: 'Zero-knowledge trust and reliability scoring for bookings.',
        keywords: ['trust', 'reliability', 'booking', 'passport', 'zk'],
        homepage: 'https://pabandi.com/docs/trust-oracle',
    },
    {
        id: 'pabandi-whatsapp-hub',
        name: 'WhatsApp Hub',
        version: '2.1.0',
        status: 'stable',
        description: 'Business WhatsApp automation with booking reminders.',
        keywords: ['whatsapp', 'outreach', 'reminder', 'booking'],
        homepage: 'https://pabandi.com/docs/whatsapp-hub',
    },
    {
        id: 'pabandi-chat-flow',
        name: 'Chat Flow',
        version: '1.0.4',
        status: 'stable',
        description: 'Guided reply flows for customer support menus.',
        keywords: ['chat', 'flow', 'menu', 'auto-reply', 'support'],
        homepage: 'https://pabandi.com/docs/chat-flow',
    },
    {
        id: 'pabandi-after-hours',
        name: 'After Hours',
        version: '0.9.2',
        status: 'beta',
        description: 'Away message automation for offline hours.',
        keywords: ['after-hours', 'away', 'offline', 'schedule'],
        homepage: 'https://pabandi.com/docs/after-hours',
    },
    {
        id: 'pabandi-checkout',
        name: 'Checkout Connector',
        version: '1.2.0',
        status: 'stable',
        description: 'Payment webhook routing and deposit capture.',
        keywords: ['checkout', 'payment', 'deposit', 'webhook'],
        homepage: 'https://pabandi.com/docs/checkout-connector',
    },
    {
        id: 'pabandi-openwa-bridge',
        name: 'OpenWA Bridge',
        version: '1.4.1',
        status: 'stable',
        description: 'Local WhatsApp gateway integration and template delivery.',
        keywords: ['whatsapp', 'gateway', 'template', 'openwa'],
        homepage: 'https://pabandi.com/docs/openwa-bridge',
    },
    {
        id: 'pabandi-faq-bot',
        name: 'FAQ Bot',
        version: '0.8.5',
        status: 'beta',
        description: 'Auto answers for common booking questions.',
        keywords: ['faq', 'bot', 'support', 'automation'],
        homepage: 'https://pabandi.com/docs/faq-bot',
    },
];
//# sourceMappingURL=openwa.plugins.service.js.map
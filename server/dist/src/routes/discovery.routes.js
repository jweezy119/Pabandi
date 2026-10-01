"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const logger_1 = require("../utils/logger");
/**
 * Agent discovery files, served by the API itself.
 *
 * These are the files an agent actually fetches when it lands on the host:
 * llms.txt, robots.txt, and the OpenAPI spec. They used to be copied into the
 * client bundle by hand, which meant the served copy silently drifted from the
 * real one (stale tool list, a dead api.pabandi.com base URL, /openapi.yaml
 * returning index.html because the SPA fallback answered it).
 *
 * Now they are read from the canonical files in this repo at request time, so
 * the served bytes cannot disagree with what we generate.
 */
const router = express_1.default.Router();
// The build stages these into src/public, so the served bytes are the bytes we
// generate — in source mode and in the image alike (the repo root is not copied
// into the image, so reading it at request time only worked locally).
const PUBLIC_ROOT = path_1.default.join(__dirname, '..', 'public');
const SERVER_ROOT = path_1.default.join(__dirname, '..', '..', '..');
const REPO_ROOT = path_1.default.join(SERVER_ROOT, '..');
const CONTENT_TYPES = {
    '.txt': 'text/plain; charset=utf-8',
    '.yaml': 'application/yaml; charset=utf-8',
    '.yml': 'application/yaml; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
};
// Ordered by preference: the repo root is canonical, the server's public dir is
// the fallback for deployments that only ship server/.
const CANDIDATES = {
    'llms.txt': [path_1.default.join(PUBLIC_ROOT, 'llms.txt'), path_1.default.join(REPO_ROOT, 'llms.txt')],
    'robots.txt': [path_1.default.join(PUBLIC_ROOT, 'robots.txt'), path_1.default.join(REPO_ROOT, 'robots.txt')],
    'openapi.yaml': [
        path_1.default.join(PUBLIC_ROOT, 'openapi.yaml'),
        path_1.default.join(SERVER_ROOT, 'openapi.yaml'),
    ],
};
function resolveFile(name) {
    for (const candidate of CANDIDATES[name] ?? []) {
        if (fs_1.default.existsSync(candidate))
            return candidate;
    }
    return null;
}
function serve(req, res, name) {
    const file = resolveFile(name);
    if (!file) {
        logger_1.logger.warn(`[discovery] ${name} not found in any known location`);
        return res.status(404).json({ success: false, error: `${name} not available` });
    }
    const ext = path_1.default.extname(file);
    res.setHeader('Content-Type', CONTENT_TYPES[ext] ?? 'text/plain; charset=utf-8');
    // Discovery files change on every deploy that touches the tool surface, and an
    // agent caching a stale tool list is worse than one extra request.
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(file);
}
router.get('/llms.txt', (req, res) => serve(req, res, 'llms.txt'));
router.get('/robots.txt', (req, res) => serve(req, res, 'robots.txt'));
router.get('/openapi.yaml', (req, res) => serve(req, res, 'openapi.yaml'));
/** Tells a crawler whether this host is the API or the marketing front end. */
router.get('/.well-known/api-host', (_req, res) => {
    res.json({
        success: true,
        data: {
            apiBaseUrl: process.env.PUBLIC_API_URL || `https://${process.env.RENDER_HOST || 'pabandi.onrender.com'}`,
            mcpEndpoint: `${process.env.PUBLIC_API_URL || `https://${process.env.RENDER_HOST || 'pabandi.onrender.com'}`}/mcp`,
            discovery: {
                llms: '/llms.txt',
                robots: '/robots.txt',
                openapi: '/openapi.yaml',
                tools: `/api/${process.env.API_VERSION || 'v1'}/pabandi/tools`,
                agentRegistry: '/.well-known/agent-registry.json',
                capabilityManifest: '/.well-known/agents.json',
                ptp: '/.well-known/ptp.json',
            },
            signup: `/api/${process.env.API_VERSION || 'v1'}/agents/register`,
        },
    });
});
exports.default = router;
//# sourceMappingURL=discovery.routes.js.map
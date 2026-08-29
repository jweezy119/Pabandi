"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWAMCPClient = void 0;
exports.createOpenWAMCPClient = createOpenWAMCPClient;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const OPENWA_MCP_URL = (process.env.OPENWA_API_URL || 'http://localhost:2785/api').replace(/\/api$/, '/mcp');
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || '';
class OpenWAMCPClient {
    constructor(sessionId) {
        this.sessionId = sessionId;
    }
    /**
     * Helper to make HTTP POST requests to OpenWA's MCP HTTP transport endpoint.
     */
    async request(method, params) {
        const headers = {
            'Content-Type': 'application/json',
            'X-Session-Id': this.sessionId,
        };
        if (OPENWA_API_KEY) {
            headers['X-API-Key'] = OPENWA_API_KEY;
        }
        const payload = {
            jsonrpc: '2.0',
            id: Date.now().toString(),
            method,
            params,
        };
        try {
            const response = await axios_1.default.post(OPENWA_MCP_URL, payload, { headers });
            if (response.data.error) {
                throw new Error(response.data.error.message || JSON.stringify(response.data.error));
            }
            return response.data.result;
        }
        catch (error) {
            logger_1.logger.error(`[MCPClient] Request failed: ${error?.message || error}`);
            throw error;
        }
    }
    /**
     * Initialize the MCP session with OpenWA.
     */
    async initialize() {
        return this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'Pabandi-AI-Agent',
                version: '1.0.0',
            },
        });
    }
    /**
     * List all available tools exposed by OpenWA.
     */
    async listTools() {
        return this.request('tools/list', {});
    }
    /**
     * Call a specific tool with arguments.
     */
    async callTool(call) {
        try {
            const result = await this.request('tools/call', {
                name: call.name,
                arguments: call.arguments,
            });
            // Map MCP text/content array to a simple toolResult
            if (result.content && Array.isArray(result.content)) {
                const textContent = result.content
                    .filter((c) => c.type === 'text')
                    .map((c) => c.text)
                    .join('\n');
                // Try to parse as JSON if it looks like JSON
                try {
                    return { toolResult: JSON.parse(textContent) };
                }
                catch {
                    return { toolResult: textContent };
                }
            }
            return { toolResult: result };
        }
        catch (error) {
            return { toolResult: null, error: error.message };
        }
    }
}
exports.OpenWAMCPClient = OpenWAMCPClient;
/**
 * Creates a new session-scoped MCP client for OpenWA.
 */
function createOpenWAMCPClient(sessionId) {
    return new OpenWAMCPClient(sessionId);
}
//# sourceMappingURL=openwa.mcp-client.service.js.map
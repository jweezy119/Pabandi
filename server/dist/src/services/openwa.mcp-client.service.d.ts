export interface MCPToolCall {
    name: string;
    arguments: Record<string, unknown>;
}
export interface MCPToolResult {
    toolResult: unknown;
    error?: string;
}
export interface MCPTool {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
    };
}
export declare class OpenWAMCPClient {
    private sessionId;
    constructor(sessionId: string);
    /**
     * Helper to make HTTP POST requests to OpenWA's MCP HTTP transport endpoint.
     */
    private request;
    /**
     * Initialize the MCP session with OpenWA.
     */
    initialize(): Promise<{
        serverInfo: any;
        capabilities: any;
    }>;
    /**
     * List all available tools exposed by OpenWA.
     */
    listTools(): Promise<{
        tools: MCPTool[];
    }>;
    /**
     * Call a specific tool with arguments.
     */
    callTool(call: MCPToolCall): Promise<MCPToolResult>;
}
/**
 * Creates a new session-scoped MCP client for OpenWA.
 */
export declare function createOpenWAMCPClient(sessionId: string): OpenWAMCPClient;
//# sourceMappingURL=openwa.mcp-client.service.d.ts.map
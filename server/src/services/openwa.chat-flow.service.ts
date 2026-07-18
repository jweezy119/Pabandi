import { openwaService } from './openwa.service';
import { getPluginCatalog, findPluginsByKeywords } from './openwa.plugins.service';

const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID || process.env.OPENWA_SESSION || 'default';
const FLOW_TTL_MS = 15 * 60 * 1000;

export interface ChatFlowNode {
  key: string;
  text: string;
  options?: Record<string, ChatFlowNode>;
}

export interface ChatFlowConfig {
  trigger: string;
  greeting: string;
  options: Record<string, ChatFlowNode>;
  respondInGroups?: boolean;
}

export interface ChatFlowState {
  path: string[];
  lastActive: number;
}

export class OpenWAChatFlowService {
  async resolveSessionId(): Promise<string> {
    try {
      return await openwaService.resolveSessionId();
    } catch {
      return OPENWA_SESSION_ID;
    }
  }

  async getInstalledPlugins(sessionId?: string): Promise<{ id?: string }[]> {
    try {
      const audit = await openwaService.getAudit({ action: 'plugin_installed', sessionId });
      if (Array.isArray(audit)) return audit as { id?: string }[];
    } catch {
      // OpenWA may not expose plugin audit in this version; degrade gracefully.
    }
    const catalog = getPluginCatalog();
    const matched = findPluginsByKeywords(['chat', 'flow', 'menu', 'auto-reply'], catalog);
    return matched.map(plugin => ({ id: plugin.id }));
  }

  isChatFlowLikelyAvailable(): boolean {
    return this.getInstalledPluginsSync().some(plugin => plugin.id === 'chat-flow');
  }

  getInstalledPluginsSync(): { id?: string }[] {
    const catalog = getPluginCatalog();
    const matched = findPluginsByKeywords(['chat', 'flow', 'menu', 'auto-reply'], catalog);
    return matched.map(plugin => ({ id: plugin.id }));
  }

  async sendOutreachFlow(
    toPhone: string,
    context: { businessName?: string; claimUrl?: string } = {}
  ): Promise<{
    sent: boolean;
    pluginDetected: boolean;
    engine?: string;
    messageId?: string;
    status: string;
  }> {
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
      const result = await openwaService.sendText(toPhone, greeting, {
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
    } catch (error: any) {
      return {
        sent: false,
        pluginDetected: true,
        status: `error:${error?.message || error}`,
      };
    }
  }

  evaluateMenuByText(flow: ChatFlowConfig, currentState: ChatFlowState | null, messageBody: string): {
    reply: string;
    nextState: ChatFlowState | null;
  } {
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

    const hasOption =
      typeof currentRoot === 'object' &&
      currentRoot !== null &&
      Object.prototype.hasOwnProperty.call(currentRoot, normalized);

    if (!hasOption || typeof currentRoot !== 'object' || currentRoot === null) {
      return {
        reply: `Invalid option. Please choose one of the available options:\n\n${flow.greeting}`,
        nextState: currentState || { path: [], lastActive: Date.now() },
      };
    }

    const node = currentRoot[normalized] as ChatFlowNode | undefined;
    const nextPath = currentState?.path ? [...currentState.path, (node && node.key) || normalized] : [normalized];

    if ((node && node.options && Object.keys(node.options).length > 0) || false) {
      return {
        reply: node ? node.text || flow.greeting : flow.greeting,
        nextState: { path: nextPath, lastActive: Date.now() },
      };
    }

    return { reply: node ? node.text || flow.greeting : flow.greeting, nextState: null };
  }

  isExpired(state: ChatFlowState | null): boolean {
    if (!state) return true;
    return Date.now() - state.lastActive > FLOW_TTL_MS;
  }

  private resolveOptionsAtPath(root: Record<string, ChatFlowNode>, path: string[]): Record<string, ChatFlowNode> | undefined {
    let node: ChatFlowNode | undefined = { key: '', text: '', options: root };

    for (let index = 0; index < path.length; index += 1) {
      const key = path[index];
      const options: Record<string, ChatFlowNode> | undefined = node ? node.options : undefined;
      let next: ChatFlowNode | undefined;
      if (options && Object.prototype.hasOwnProperty.call(options, key)) {
        next = options[key];
      }
      node = next;
    }

    return node ? node.options : undefined;
  }
}

export const openwaChatFlowService = new OpenWAChatFlowService();

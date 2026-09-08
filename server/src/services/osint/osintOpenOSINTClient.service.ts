import { logger } from '../../utils/logger';
import { prisma } from '../../utils/database';
import { runInvestigation, OPENOSINT_TOOLS, type OsintReport, type OsintFinding } from './openosint.service';

export class OpenOSINTMCPClient {
  /**
   * Query any OpenOSINT investigation tool by name.
   */
  public async queryTool(toolName: string, args: Record<string, any>): Promise<any> {
    const tool = OPENOSINT_TOOLS.find(t => t.name === toolName);
    if (!tool) {
      return { error: `Unknown OpenOSINT tool: ${toolName}` };
    }

    try {
      switch (toolName) {
        case 'openosint_investigate':
          return await runInvestigation(args.target, args.targetType);
        case 'openosint_username_search': {
          const { toolGitHubSearch } = await import('./openosint.service');
          return await toolGitHubSearch(args.username);
        }
        case 'openosint_phone_intel': {
          const { toolPhoneIntelligence } = await import('./openosint.service');
          return await toolPhoneIntelligence(args.phone);
        }
        case 'openosint_domain_intel': {
          const { toolDomainIntel } = await import('./openosint.service');
          return await toolDomainIntel(args.domain);
        }
        case 'openosint_ip_analysis': {
          const { toolIpAnalysis } = await import('./openosint.service');
          return await toolIpAnalysis(args.ip);
        }
        case 'openosint_breach_check': {
          const { toolBreachCheck } = await import('./openosint.service');
          return await toolBreachCheck(args.email);
        }
        case 'openosint_contradiction_detect': {
          const { detectContradictions } = await import('./openosint.service');
          return detectContradictions(args.findings || []);
        }
        case 'openosint_attribution_assess': {
          const { computeOsintRisk, buildAttribution } = await import('./openosint.service');
          const findings = args.findings || [];
          const contradictions: any[] = [];
          const summary = computeOsintRisk(findings, contradictions);
          const attribution = buildAttribution(findings, contradictions);
          return { summary, attribution };
        }
        default:
          return { error: `Tool ${toolName} not implemented` };
      }
    } catch (e: any) {
      logger.error(`[OpenOSINT MCP] Tool ${toolName} failed`, e);
      return { error: e.message || 'Tool execution failed' };
    }
  }

  /**
   * List all available OpenOSINT tools.
   */
  public listTools() {
    return OPENOSINT_TOOLS;
  }
}

export const openOSINTMCPClient = new OpenOSINTMCPClient();

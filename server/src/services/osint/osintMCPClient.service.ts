import { logger } from '../../utils/logger';
import { prisma } from '../../utils/database';

export interface MaigretMCPResult {
  isSuspicious: boolean;
  findings: any[];
}

export interface RegistryMCPResult {
  isSuspicious: boolean;
  findings: any[];
}

export interface InfrastructureMCPResult {
  isSuspicious: boolean;
  findings: any[];
}

export interface OsintReport {
  target: string;
  targetType: 'username' | 'email' | 'phone' | 'domain' | 'ip' | 'image' | 'business';
  generatedAt: string;
  summary: {
    riskScore: number;
    suspiciousCount: number;
    cleanCount: number;
    contradictionCount: number;
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
  };
  findings: any[];
  contradictions: any[];
  attribution: {
    observedActions: string[];
    infrastructure: string[];
    selfIdentifiedClaims: string[];
    independentCorroboration: string[];
    attributionConfidence: 'unattributed' | 'possible' | 'likely' | 'confirmed';
  };
}

export class OsintMCPClient {
  public async queryMaigretMCP(username: string): Promise<MaigretMCPResult> {
    try {
      logger.info(`[OSINT MCP] Querying Maigret for username: ${username}`);
      const { openOSINTMCPClient } = await import('./osintOpenOSINTClient.service');
      const findings = await openOSINTMCPClient.queryTool('openosint_username_search', { username });
      const suspicious = (findings || []).some((f: any) => f.value?.toLowerCase().includes('scam') || f.value?.toLowerCase().includes('fraud'));
      return {
        isSuspicious: suspicious,
        findings: Array.isArray(findings) ? findings : [],
      };
    } catch (e) {
      logger.error('[OSINT MCP] Maigret query failed', e);
      return { isSuspicious: false, findings: [] };
    }
  }

  public async queryOpenRegistryMCP(businessName: string): Promise<RegistryMCPResult> {
    try {
      logger.info(`[OSINT MCP] Querying OpenRegistry for: ${businessName}`);
      const { openOSINTMCPClient } = await import('./osintOpenOSINTClient.service');
      const domain = businessName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '.com';
      const findings = await openOSINTMCPClient.queryTool('openosint_domain_intel', { domain });
      const suspicious = (findings || []).some((f: any) => f.isSuspicious || f.label?.toLowerCase().includes('malicious') || f.label?.toLowerCase().includes('young domain'));
      return {
        isSuspicious: suspicious,
        findings: Array.isArray(findings) ? findings : [],
      };
    } catch (e) {
      logger.error('[OSINT MCP] OpenRegistry query failed', e);
      return { isSuspicious: false, findings: [] };
    }
  }

  public async queryInfrastructurePipeline(website: string): Promise<InfrastructureMCPResult[]> {
    try {
      logger.info(`[OSINT MCP] Running infrastructure pipeline for: ${website}`);
      const { openOSINTMCPClient } = await import('./osintOpenOSINTClient.service');
      const findings = await openOSINTMCPClient.queryTool('openosint_domain_intel', { domain: website });
      const suspicious = (findings || []).some((f: any) => f.isSuspicious || f.label?.toLowerCase().includes('malicious') || f.label?.toLowerCase().includes('vulnerability'));
      return [
        {
          isSuspicious: suspicious,
          findings: Array.isArray(findings) ? findings : [],
        },
      ];
    } catch (e) {
      logger.error('[OSINT MCP] Infrastructure pipeline failed', e);
      return [{ isSuspicious: false, findings: [] }];
    }
  }

  public async runOpenOSINTInvestigation(target: string, targetType: any): Promise<OsintReport> {
    try {
      logger.info(`[OSINT MCP] Full investigation: ${targetType} => ${target}`);
      const { openOSINTMCPClient } = await import('./osintOpenOSINTClient.service');
      const report = await openOSINTMCPClient.queryTool('openosint_investigate', { target, targetType });
      return report as OsintReport;
    } catch (e) {
      logger.error('[OSINT MCP] Full investigation failed', e);
      return {
        target,
        targetType: targetType as any,
        generatedAt: new Date().toISOString(),
        summary: { riskScore: 0, suspiciousCount: 0, cleanCount: 0, contradictionCount: 0, overallRisk: 'low' },
        findings: [],
        contradictions: [],
        attribution: { observedActions: [], infrastructure: [], selfIdentifiedClaims: [], independentCorroboration: [], attributionConfidence: 'unattributed' },
      };
    }
  }

  public async detectContradictions(findings: any[]): Promise<any[]> {
    try {
      const { openOSINTMCPClient } = await import('./osintOpenOSINTClient.service');
      const result = await openOSINTMCPClient.queryTool('openosint_contradiction_detect', { findings });
      return Array.isArray(result) ? result : [];
    } catch (e) {
      logger.error('[OSINT MCP] Contradiction detection failed', e);
      return [];
    }
  }
}

export const osintMCPClient = new OsintMCPClient();

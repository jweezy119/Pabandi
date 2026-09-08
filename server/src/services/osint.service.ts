import { logger } from '../../utils/logger';
import { prisma } from '../../utils/database';
import { trustScoreService } from '../trustScore.service';
import { osintMCPClient } from './osintMCPClient.service';
import { openOSINTMCPClient } from './osintOpenOSINTClient.service';
import { runInvestigation, type OsintReport } from './openosint.service';

export class OsintService {
  public async runSherlock(username: string): Promise<any[]> {
    logger.info(`[OSINT] Running OpenOSINT Sherlock for: ${username}`);
    try {
      const report = await runInvestigation(username, 'username');
      return report.findings.map(f => ({
        site: f.source,
        urlUser: f.value,
        isClaimed: true,
        isSuspicious: f.confidence === 'high' && (f.label?.toLowerCase().includes('risk') || f.label?.toLowerCase().includes('breach')),
      }));
    } catch (e) {
      logger.error('[OSINT] Sherlock failed', e);
      return [];
    }
  }

  public async validatePhone(phone: string): Promise<any> {
    logger.info(`[OSINT] Running OpenOSINT phone analysis for: ${phone}`);
    try {
      const findings = await openOSINTMCPClient.queryTool('openosint_phone_intel', { phone });
      const suspicious = (findings || []).some((f: any) => f.value?.toLowerCase().includes('voip') || f.value?.toLowerCase().includes('temp'));
      const voipFinding = (findings || []).find((f: any) => f.label?.toLowerCase().includes('voip'));
      return {
        phone,
        isValid: true,
        type: voipFinding ? 'voip' : 'mobile',
        countryCode: phone.startsWith('+') ? phone.substring(0, 3) : 'unknown',
        isSuspicious: suspicious,
        riskDelta: suspicious ? 15 : 0,
      };
    } catch (e) {
      logger.error('[OSINT] Phone analysis failed', e);
      return {
        phone,
        isValid: true,
        type: 'unknown',
        countryCode: 'unknown',
        isSuspicious: false,
        riskDelta: 0,
      };
    }
  }

  public async verifyBusinessDomain(domain: string): Promise<any> {
    logger.info(`[OSINT] Running OpenOSINT domain intel for: ${domain}`);
    try {
      const findings = await openOSINTMCPClient.queryTool('openosint_domain_intel', { domain });
      const suspicious = (findings || []).some((f: any) => f.isSuspicious || f.label?.toLowerCase().includes('malicious') || f.label?.toLowerCase().includes('young domain'));
      const ageFinding = (findings || []).find((f: any) => f.label === 'Domain age');
      const registrarFinding = (findings || []).find((f: any) => f.label === 'Registrar');
      return {
        domain,
        domainAgeDays: ageFinding ? parseInt(ageFinding.value) || 365 : 365,
        registrar: registrarFinding?.value || 'unknown',
        isSuspicious: suspicious,
        riskDelta: suspicious ? 20 : 0,
      };
    } catch (e) {
      logger.error('[OSINT] Domain intel failed', e);
      return {
        domain,
        domainAgeDays: 365,
        registrar: 'unknown',
        isSuspicious: false,
        riskDelta: 0,
      };
    }
  }

  public hasSuspiciousFootprint(sherlockResults: any[]): boolean {
    return sherlockResults.some((r: any) => r.isSuspicious);
  }

  public async verifyImageTineye(imageUrl: string): Promise<{ isSuspicious: boolean; matches: number }> {
    logger.info(`[OSINT] Running OpenOSINT image analysis for: ${imageUrl}`);
    try {
      const findings = await openOSINTMCPClient.queryTool('openosint_reverse_image', { imageUrl });
      const suspicious = (findings || []).some((f: any) => f.value?.toLowerCase().includes('stock') || f.value?.toLowerCase().includes('fake') || f.isSuspicious);
      return { isSuspicious: suspicious, matches: suspicious ? 15 : 0 };
    } catch (e) {
      logger.error('[OSINT] Image analysis failed', e);
      return { isSuspicious: false, matches: 0 };
    }
  }

  public async clusterIdentity(userId: string, reqIp: string, reqDeviceStr: string) {
    const deviceHash = Buffer.from(reqDeviceStr).toString('base64');
    const ipHash = Buffer.from(reqIp).toString('base64');

    let cluster = await prisma.identityCluster.findFirst({
      where: {
        OR: [
          { deviceHash },
          { ipHash }
        ]
      }
    });

    if (cluster) {
      if (!cluster.userIds.includes(userId)) {
        await prisma.identityCluster.update({
          where: { id: cluster.id },
          data: {
            userIds: { push: userId },
            riskScore: cluster.riskScore + 20
          }
        });
      }
    } else {
      cluster = await prisma.identityCluster.create({
        data: {
          deviceHash,
          ipHash,
          userIds: [userId],
          riskScore: 0
        }
      });
    }

    return cluster;
  }

  public async queueOSINTChecks(userId: string, businessId?: string) {
    try {
      logger.info(`[OSINT Queue] Starting OpenOSINT checks for User ${userId}`);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;

      const username = user.email.split('@')[0];
      const userReport = await osintMCPClient.runOpenOSINTInvestigation(username, 'username');

      if (userReport.summary.overallRisk === 'high' || userReport.summary.overallRisk === 'critical') {
        await trustScoreService.processEvent(userId, {
          component: 'OSINT',
          reason: `OpenOSINT: ${userReport.summary.overallRisk} risk detected for user`,
          severity: 'negative',
          osintData: userReport.findings,
        });
      } else if (userReport.summary.contradictionCount > 0) {
        await trustScoreService.processEvent(userId, {
          component: 'OSINT',
          reason: `OpenOSINT: ${userReport.summary.contradictionCount} contradictions found`,
          severity: 'neutral',
          osintData: { findings: userReport.findings, contradictions: userReport.contradictions },
        });
      } else {
        await trustScoreService.processEvent(userId, {
          component: 'OSINT',
          reason: 'OpenOSINT: Clean social footprint',
          severity: 'positive',
          osintData: userReport.findings,
        });
      }

      if (businessId) {
        const business = await prisma.business.findUnique({ where: { id: businessId } });
        if (business) {
          const domain = business.website ? new URL(business.website).hostname : business.name;
          const bizReport = await osintMCPClient.runOpenOSINTInvestigation(domain, 'business');

          if (bizReport.summary.overallRisk === 'high' || bizReport.summary.overallRisk === 'critical') {
            await trustScoreService.processEvent(userId, {
              component: 'OSINT',
              reason: `OpenOSINT Business: ${bizReport.summary.overallRisk} risk for ${business.name}`,
              severity: 'negative',
              osintData: bizReport.findings,
            });
          } else {
            await trustScoreService.processEvent(userId, {
              component: 'OSINT',
              reason: `OpenOSINT Business: Clean infrastructure for ${business.name}`,
              severity: 'positive',
              osintData: bizReport.findings,
            });
          }
        }
      }

      logger.info(`[OSINT Queue] Finished OpenOSINT checks for User ${userId}. Events sent to TrustScoreService.`);
    } catch (e) {
      logger.error(`[OSINT Queue] Failed for User ${userId}`, e);
    }
  }
}

export const osintService = new OsintService();

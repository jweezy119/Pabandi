import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { trustScoreService } from './trustScore.service';

export interface SherlockResult {
  site: string;
  urlUser: string;
  isClaimed: boolean;
  isSuspicious: boolean;
}

export interface PhoneValidationResult {
  phone: string;
  isValid: boolean;
  type: 'fixed_line' | 'mobile' | 'voip' | 'unknown';
  countryCode: string;
  isSuspicious: boolean;
  riskDelta: number;
}

export interface DomainWhoisResult {
  domain: string;
  domainAgeDays: number;
  registrar: string;
  isSuspicious: boolean;
  riskDelta: number;
}

const SUSPICIOUS_PLATFORMS = ['fraudreport.com', 'scamalerts.com', 'ripoffreport.com'];

export class OsintService {
  /**
   * Run a mock Sherlock username correlation check.
   * In production, this would `exec` the sherlock CLI or call a managed OSINT API.
   */
  public async runSherlock(username: string): Promise<SherlockResult[]> {
    logger.info(`[OSINT] Running Sherlock username correlation for: ${username}`);
    
    // MOCK: Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 800));

    // MOCK: Simple heuristic for demonstration. 
    // If username contains "scam" or "fraud", simulate finding it on a suspicious site.
    if (username.toLowerCase().includes('scammer') || username.toLowerCase().includes('fraud')) {
      return [
        { site: 'fraudreport.com', urlUser: `https://fraudreport.com/user/${username}`, isClaimed: true, isSuspicious: true },
        { site: 'twitter', urlUser: `https://twitter.com/${username}`, isClaimed: true, isSuspicious: false }
      ];
    }

    return [
      { site: 'twitter', urlUser: `https://twitter.com/${username}`, isClaimed: true, isSuspicious: false },
      { site: 'instagram', urlUser: `https://instagram.com/${username}`, isClaimed: true, isSuspicious: false }
    ];
  }

  /**
   * Validate phone number intelligence (AbstractAPI / PhoneInfoga stub).
   * Checks HLR, VOIP status, and geographic mismatch.
   */
  public async validatePhone(phone: string): Promise<PhoneValidationResult> {
    logger.info(`[OSINT] Running AbstractAPI phone validation for: ${phone}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));

    let riskDelta = 0;
    let type: 'fixed_line' | 'mobile' | 'voip' | 'unknown' = 'mobile';
    let isSuspicious = false;

    // MOCK Logic: 
    // If phone starts with +1 (US) but user is claiming Pakistan (+92), that's a risk.
    // We will simulate a VOIP detection if the phone ends with "0000"
    if (phone.endsWith('0000')) {
      type = 'voip';
      riskDelta += 15;
      isSuspicious = true;
    }

    return {
      phone,
      isValid: true,
      type,
      countryCode: phone.startsWith('+') ? phone.substring(0, 3) : 'unknown',
      isSuspicious,
      riskDelta
    };
  }

  /**
   * Check business domain age using WhoisXML API stub.
   * Domains < 30 days old are heavily penalized.
   */
  public async verifyBusinessDomain(domain: string): Promise<DomainWhoisResult> {
    logger.info(`[OSINT] Verifying domain WHOIS for: ${domain}`);
    
    await new Promise(resolve => setTimeout(resolve, 600));

    let riskDelta = 0;
    let isSuspicious = false;
    let domainAgeDays = 365; // Default safe age

    // MOCK Logic: If domain contains "new", simulate a young domain
    if (domain.toLowerCase().includes('new') || domain.toLowerCase().includes('temp')) {
      domainAgeDays = 12; // Very young domain
      riskDelta += 20;
      isSuspicious = true;
    }

    return {
      domain,
      domainAgeDays,
      registrar: 'Namecheap',
      isSuspicious,
      riskDelta
    };
  }

  /**
   * Check if sherlock results hit known fraud platforms.
   */
  public hasSuspiciousFootprint(sherlockResults: SherlockResult[]): boolean {
    return sherlockResults.some(r => r.isSuspicious && SUSPICIOUS_PLATFORMS.includes(r.site));
  }

  /**
   * TinEye Reverse Image Search Stub
   * Checks if a logo or license is a known stock photo or scam image.
   */
  public async verifyImageTineye(imageUrl: string): Promise<{ isSuspicious: boolean, matches: number }> {
    logger.info(`[OSINT] Running TinEye reverse image search for: ${imageUrl}`);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // MOCK: if the image URL contains "stock" or "fake", flag it
    if (imageUrl.toLowerCase().includes('stock') || imageUrl.toLowerCase().includes('fake')) {
      return { isSuspicious: true, matches: 15 };
    }
    return { isSuspicious: false, matches: 0 };
  }

  /**
   * Identity Clustering Stub
   * Mocks client-side fingerprinting and hashes to catch fraud rings.
   */
  public async clusterIdentity(userId: string, reqIp: string, reqDeviceStr: string) {
    const deviceHash = Buffer.from(reqDeviceStr).toString('base64');
    const ipHash = Buffer.from(reqIp).toString('base64');

    // Find existing cluster
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
            riskScore: cluster.riskScore + 20 // Risk increases as more users link to the same device
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

  /**
   * ASYNC QUEUE: The main entry point for the "Verify Quietly" workflow.
   * Runs in the background (fire and forget) to evaluate a user/business without blocking signup.
   */
  public async queueOSINTChecks(userId: string, businessId?: string) {
    try {
      logger.info(`[OSINT Queue] Starting background checks for User ${userId}`);
      
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;

      // 1. Sherlock Check
      const username = user.email.split('@')[0];
      const sherlockResults = await this.runSherlock(username);
      const isSherlockSuspicious = this.hasSuspiciousFootprint(sherlockResults);
      
      if (isSherlockSuspicious) {
        await trustScoreService.processEvent(userId, {
          component: 'OSINT',
          reason: 'Suspicious footprints found across social platforms',
          severity: 'negative',
          osintData: { breachCount: 1 } // Simulated
        });
      } else {
        await trustScoreService.processEvent(userId, {
          component: 'OSINT',
          reason: 'Clean social footprint',
          severity: 'positive',
          osintData: { breachCount: 0 }
        });
      }

      // 2. Phone Check
      if (user.phone) {
        const phoneRes = await this.validatePhone(user.phone);
        if (phoneRes.isSuspicious) {
          await trustScoreService.processEvent(userId, {
            component: 'OSINT',
            reason: phoneRes.type === 'voip' ? 'VOIP phone detected' : 'Suspicious phone footprint',
            severity: 'negative',
            osintData: { voipLikelihood: phoneRes.type === 'voip' ? 1.0 : 0.5 }
          });
        }
      }

      let isBusinessSuspicious = false;
      if (businessId) {
        const business = await prisma.business.findUnique({ where: { id: businessId } });
        if (business && business.website) {
          const domainRes = await this.verifyBusinessDomain(business.website);
          isBusinessSuspicious = domainRes.isSuspicious;
          await trustScoreService.processEvent(userId, {
            component: 'OSINT',
            reason: `Domain age is ${domainRes.domainAgeDays} days`,
            severity: domainRes.isSuspicious ? 'negative' : 'neutral',
            osintData: { domainAgeDays: domainRes.domainAgeDays }
          });
        }
        if (business && business.logoUrl) {
          const imgRes = await this.verifyImageTineye(business.logoUrl);
          if (imgRes.isSuspicious) isBusinessSuspicious = true;
          // Could log image check as well
        }
      }

      logger.info(`[OSINT Queue] Finished for User ${userId}. Events sent to TrustScoreService.`);
    } catch (e) {
      logger.error(`[OSINT Queue] Failed for User ${userId}`, e);
    }
  }
}

export const osintService = new OsintService();

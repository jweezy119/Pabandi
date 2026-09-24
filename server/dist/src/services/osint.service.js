"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.osintService = exports.OsintService = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const trustScore_service_1 = require("./trustScore.service");
const osintMCPClient_service_1 = require("./osint/osintMCPClient.service");
const SUSPICIOUS_PLATFORMS = ['fraudreport.com', 'scamalerts.com', 'ripoffreport.com'];
class OsintService {
    /**
     * Run a mock Sherlock username correlation check.
     * In production, this would `exec` the sherlock CLI or call a managed OSINT API.
     */
    async runSherlock(username) {
        logger_1.logger.info(`[OSINT] Running Sherlock username correlation for: ${username}`);
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
    async validatePhone(phone) {
        logger_1.logger.info(`[OSINT] Running AbstractAPI phone validation for: ${phone}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        let riskDelta = 0;
        let type = 'mobile';
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
    async verifyBusinessDomain(domain) {
        logger_1.logger.info(`[OSINT] Verifying domain WHOIS for: ${domain}`);
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
    hasSuspiciousFootprint(sherlockResults) {
        return sherlockResults.some(r => r.isSuspicious && SUSPICIOUS_PLATFORMS.includes(r.site));
    }
    /**
     * TinEye Reverse Image Search Stub
     * Checks if a logo or license is a known stock photo or scam image.
     */
    async verifyImageTineye(imageUrl) {
        logger_1.logger.info(`[OSINT] Running TinEye reverse image search for: ${imageUrl}`);
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
    async clusterIdentity(userId, reqIp, reqDeviceStr) {
        const deviceHash = Buffer.from(reqDeviceStr).toString('base64');
        const ipHash = Buffer.from(reqIp).toString('base64');
        // Find existing cluster
        let cluster = await database_1.prisma.identityCluster.findFirst({
            where: {
                OR: [
                    { deviceHash },
                    { ipHash }
                ]
            }
        });
        if (cluster) {
            if (!cluster.userIds.includes(userId)) {
                await database_1.prisma.identityCluster.update({
                    where: { id: cluster.id },
                    data: {
                        userIds: { push: userId },
                        riskScore: cluster.riskScore + 20 // Risk increases as more users link to the same device
                    }
                });
            }
        }
        else {
            cluster = await database_1.prisma.identityCluster.create({
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
     * Runs in the background (fire and forget) to evaluate a user/business using the MCP OSINT pipeline.
     */
    async queueOSINTChecks(userId, businessId) {
        try {
            logger_1.logger.info(`[OSINT Queue] Starting MCP orchestrated checks for User ${userId}`);
            const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
            if (!user)
                return;
            // 1. Maigret MCP - Individual Identity Correlation
            const username = user.email.split('@')[0];
            const maigretResult = await osintMCPClient_service_1.osintMCPClient.queryMaigretMCP(username);
            if (maigretResult.isSuspicious) {
                await trustScore_service_1.trustScoreService.processEvent(userId, {
                    component: 'OSINT',
                    reason: 'Maigret MCP: Suspicious footprints found across social platforms',
                    severity: 'negative',
                    osintData: maigretResult.findings
                });
            }
            else {
                await trustScore_service_1.trustScoreService.processEvent(userId, {
                    component: 'OSINT',
                    reason: 'Maigret MCP: Clean social footprint',
                    severity: 'positive',
                    osintData: maigretResult.findings
                });
            }
            // 2. OpenRegistry & Infrastructure Pipeline (If Business)
            if (businessId) {
                const business = await database_1.prisma.business.findUnique({ where: { id: businessId } });
                if (business) {
                    // A. OpenRegistry MCP
                    const registryResult = await osintMCPClient_service_1.osintMCPClient.queryOpenRegistryMCP(business.name);
                    if (registryResult.isSuspicious) {
                        await trustScore_service_1.trustScoreService.processEvent(userId, {
                            component: 'OSINT',
                            reason: 'OpenRegistry MCP: Flagged business directors or entities',
                            severity: 'negative',
                            osintData: registryResult.findings
                        });
                    }
                    // B. Infrastructure Pipeline (Shodan, WHOIS, VirusTotal)
                    if (business.website) {
                        const infraResults = await osintMCPClient_service_1.osintMCPClient.queryInfrastructurePipeline(business.website);
                        for (const result of infraResults) {
                            if (result.isSuspicious) {
                                await trustScore_service_1.trustScoreService.processEvent(userId, {
                                    component: 'OSINT',
                                    reason: `${result.source}: High risk infrastructure detected`,
                                    severity: 'negative',
                                    osintData: result.findings
                                });
                            }
                        }
                    }
                }
            }
            logger_1.logger.info(`[OSINT Queue] Finished MCP checks for User ${userId}. Events sent to TrustScoreService.`);
        }
        catch (e) {
            logger_1.logger.error(`[OSINT Queue] Failed for User ${userId}`, e);
        }
    }
}
exports.OsintService = OsintService;
exports.osintService = new OsintService();
//# sourceMappingURL=osint.service.js.map
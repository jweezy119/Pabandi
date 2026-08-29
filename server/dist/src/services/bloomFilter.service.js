"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bloomFilterService = void 0;
const bloom_filters_1 = require("bloom-filters");
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
class BloomFilterService {
    constructor() {
        this.currentFilter = null;
        this.serializedFilter = null;
        // Generate the filter on startup
        this.generateFilter();
        // Regenerate every 5 minutes to keep it fresh
        setInterval(() => this.generateFilter(), 1000 * 60 * 5);
    }
    async generateFilter() {
        try {
            // Find all hashes that have >= 1 incident
            const riskyIdentities = await prisma.hashedIdentity.findMany({
                where: {
                    totalIncidents: { gt: 0 }
                },
                select: {
                    hash: true
                }
            });
            // Initialize a new Bloom filter.
            // Sizing it for 1,000,000 items with a 1% false positive rate
            const itemCount = Math.max(riskyIdentities.length, 1000); // minimum size
            const filter = bloom_filters_1.BloomFilter.create(itemCount, 0.01);
            riskyIdentities.forEach(identity => {
                filter.add(identity.hash);
            });
            this.currentFilter = filter;
            this.serializedFilter = filter.saveAsJSON();
            logger_1.logger.info(`[BloomFilter] Regenerated filter with ${riskyIdentities.length} risky hashes.`);
        }
        catch (err) {
            logger_1.logger.error('[BloomFilter] Error generating filter:', err);
        }
    }
    /**
     * Returns the serialized JSON of the Bloom filter so the browser SDK can download it.
     */
    getSerializedFilter() {
        return this.serializedFilter;
    }
}
exports.bloomFilterService = new BloomFilterService();
//# sourceMappingURL=bloomFilter.service.js.map
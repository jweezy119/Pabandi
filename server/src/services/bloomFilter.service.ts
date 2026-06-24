import { BloomFilter } from 'bloom-filters';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

class BloomFilterService {
  private currentFilter: BloomFilter | null = null;
  private serializedFilter: any = null;

  constructor() {
    // Generate the filter on startup
    this.generateFilter();
    
    // Regenerate every 5 minutes to keep it fresh
    setInterval(() => this.generateFilter(), 1000 * 60 * 5);
  }

  private async generateFilter() {
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
      const filter = BloomFilter.create(itemCount, 0.01);

      riskyIdentities.forEach(identity => {
        filter.add(identity.hash);
      });

      this.currentFilter = filter;
      this.serializedFilter = filter.saveAsJSON();

      logger.info(`[BloomFilter] Regenerated filter with ${riskyIdentities.length} risky hashes.`);
    } catch (err) {
      logger.error('[BloomFilter] Error generating filter:', err);
    }
  }

  /**
   * Returns the serialized JSON of the Bloom filter so the browser SDK can download it.
   */
  public getSerializedFilter(): any {
    return this.serializedFilter;
  }
}

export const bloomFilterService = new BloomFilterService();

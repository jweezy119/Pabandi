import { EventEmitter } from 'events';
import { prisma } from '../../utils/database';
import { logger } from '../../utils/logger';
import { RawBusinessProfile, DataSourceAdapter, IngestionResult } from './types';
import { OpenDirectoriesAdapter } from './opendirectories.adapter';
import { ApifyAdapter } from './apify.adapter';

const adapters: Record<string, DataSourceAdapter> = {
  opendirectories: new OpenDirectoriesAdapter(),
  apify: new ApifyAdapter(),
};

export function getAdapter(adapterId: string): DataSourceAdapter | null {
  return adapters[adapterId] || null;
}

export function listAdapters(): { id: string; name: string }[] {
  return Object.values(adapters).map((a) => ({ id: a.id, name: a.id.charAt(0).toUpperCase() + a.id.slice(1) }));
}

// ── In-memory job store for tracking ingestion progress ──────────────────────

export interface IngestionJobProgress {
  jobId: string;
  adapterId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  totalFetched: number;
  totalUpserted: number;
  totalErrors: number;
  currentBusiness?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

const jobs = new Map<string, IngestionJobProgress>();
const jobEvents = new EventEmitter();

export function getJobProgress(jobId: string): IngestionJobProgress | undefined {
  return jobs.get(jobId);
}

export function onJobEvent(listener: (job: IngestionJobProgress) => void): () => void {
  jobEvents.on('progress', listener);
  return () => jobEvents.off('progress', listener);
}

function updateJob(jobId: string, patch: Partial<IngestionJobProgress>): void {
  const job = jobs.get(jobId);
  if (!job) return;
  const next = { ...job, ...patch };
  jobs.set(jobId, next);
  jobEvents.emit('progress', next);
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export async function ingestData(adapterId: string, query: any): Promise<{ jobId: string }> {
  const adapter = getAdapter(adapterId);
  if (!adapter) {
    throw new Error(`Unknown adapter: ${adapterId}`);
  }

  const jobId = `ingest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  jobs.set(jobId, {
    jobId,
    adapterId,
    status: 'running',
    totalFetched: 0,
    totalUpserted: 0,
    totalErrors: 0,
    startedAt: new Date(),
  });

  // Run ingestion in background (non-blocking)
  (async () => {
    try {
      let businesses: RawBusinessProfile[];
      try {
        businesses = await adapter.fetchBusinesses(query);
      } catch (fetchError) {
        updateJob(jobId, {
          status: 'failed',
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          completedAt: new Date(),
        });
        return;
      }

      updateJob(jobId, { totalFetched: businesses.length });

      let upserted = 0;
      let errors = 0;

      for (let i = 0; i < businesses.length; i++) {
        const b = businesses[i];
        try {
          // Deduplication: prefer sourceId+source, fall back to (name, address)
          let existing = null;
          if (b.sourceId) {
            existing = await prisma.business.findFirst({
              where: { source: b.source, externalId: b.sourceId },
            });
          }
          if (!existing) {
            existing = await prisma.business.findFirst({
              where: { name: b.name, address: b.address },
            });
          }

          if (existing) {
            await prisma.business.update({
              where: { id: existing.id },
              data: {
                city: b.city,
                state: b.state,
                country: b.country,
                postalCode: b.postalCode,
                phone: b.phone,
                email: b.email,
                website: b.website,
                latitude: b.lat,
                longitude: b.lng,
                rating: b.googleRating,
                reviewCount: b.reviewCount,
                isVerified: b.verificationStatus === 'verified',
                source: b.source,
                externalId: b.sourceId,
                updatedAt: new Date(),
              },
            });
          } else {
            await prisma.business.create({
              data: {
                name: b.name,
                address: b.address,
                city: b.city || '',
                state: b.state || '',
                country: b.country || 'United States',
                postalCode: b.postalCode,
                phone: b.phone,
                email: b.email,
                website: b.website,
                latitude: b.lat,
                longitude: b.lng,
                rating: b.googleRating,
                reviewCount: b.reviewCount || 0,
                isVerified: b.verificationStatus === 'verified',
                isActive: true,
                source: b.source,
                externalId: b.sourceId,
                trustScore: 50.0,
                karmaScore: 50.0,
                businessTier: 'STANDARD',
                currency: 'USD',
                timezone: 'America/New_York',
              },
            });
          }

          upserted++;
          updateJob(jobId, {
            totalUpserted: upserted,
            currentBusiness: b.name,
          });
        } catch (err) {
          errors++;
          updateJob(jobId, { totalErrors: errors });
          logger.error(`[Ingestion] upsert failed for "${b.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      updateJob(jobId, {
        status: 'completed',
        completedAt: new Date(),
      });
    } catch (err) {
      updateJob(jobId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      });
    }
  })();

  return { jobId };
}

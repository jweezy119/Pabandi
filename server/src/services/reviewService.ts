import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { eventBus } from './event-bus.service';

export class ReviewService {
    /**
     * Fetch and sync reviews for a business from Google
     */
    async syncBusinessReviews(businessId: string, googlePlaceId: string): Promise<void> {
        try {
            const apiKey = '' /* Google Maps removed: DB reviews only, no paid Places API */;
            
            if (!apiKey) {
                logger.warn('GOOGLE_MAPS_API_KEY not found. Skipping real API call; validation state is provisional.');
                return; // Optionally, throw an error if strictly requiring real data
            }

            logger.info(`Syncing Google reviews for business: ${businessId} via native Fetch`);

            // 1. Fetch real details from Google Places API direct via REST
            const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`;
            
            const res = await fetch(googleUrl);
            const response = (await res.json()) as any;

            if (response.status !== 'OK') {
                logger.warn(`Google Places API returned status ${response.status}: ${response.error_message || 'No error message'}. Skipping review sync to avoid crash.`);
                return;
            }

            const placeDiff = response.result;
            
            if (!placeDiff) {
                logger.warn(`No place details found for id: ${googlePlaceId}`);
                return;
            }

            const googleReviews = placeDiff.reviews || [];

            // 2. Map and Upsert Reviews
            for (const review of googleReviews) {
                const uniqueReviewId = `g_${googlePlaceId}_${review.time}_${review.author_name.replace(/[^a-zA-Z0-9]/g, '')}`;

                await prisma.googleReview.upsert({
                    where: { googleReviewId: uniqueReviewId },
                    update: {},
                    create: {
                        businessId,
                        googleReviewId: uniqueReviewId,
                        authorName: review.author_name,
                        rating: review.rating,
                        text: review.text,
                        time: new Date(review.time * 1000), // Time is in seconds from epoch
                        sentimentLabel: review.rating >= 4 ? 'positive' : (review.rating === 3 ? 'neutral' : 'negative'),
                        processed: false
                    },
                });
            }

            // 3. Update Business Overall Rating
            await prisma.business.update({
                where: { id: businessId },
                data: {
                    rating: placeDiff.rating || 0,
                    reviewCount: placeDiff.user_ratings_total || 0,
                },
            });

            await this.calculateReliabilityScore(businessId);
            
            logger.info(`Successfully synced ${googleReviews.length} reviews for business ${businessId}`);
        } catch (error: any) {
            logger.error(`Error syncing Google reviews for ${businessId}:`, error?.message || error);
            throw error;
        }
    }

    /**
     * Recompute a business's reliability score after a review sync.
     *
     * ─── WHAT THIS NO LONGER DOES ─────────────────────────────────────────────
     *
     * It used to compute `(googleRating × 0.4) + (completionRate × 0.6)`, with
     * both operands on 0–5, and write that straight into `Business.reliabilityScore`
     * — a column every other writer treated as 0–100.
     *
     * The result was that a business with a flawless 5.0 Google rating and a
     * perfect booking record stored `5.0`, which every 0–100 threshold in the
     * system read as catastrophically unreliable. It is the same incoherence as
     * the 750-at-signup problem, in the other direction: there, an average user
     * looked excellent; here, an excellent one looked terrible. Neither was ever
     * a real score.
     *
     * ─── WHAT IT DOES INSTEAD ─────────────────────────────────────────────────
     *
     * It emits `business.reviews_synced` and lets `trust-core.service.ts` — the
     * single writer of `reliabilityScore` — do the scoring. Google reviews are
     * a SIGNAL consumed by trust-core, not a number that overwrites the field.
     *
     * This is the architectural fix, not a rescale. Rescaling the blend would
     * have kept a second writer with its own formula on the same column, and the
     * next divergence between the two would have been just as invisible.
     *
     * @returns the signals observed, so a caller can log or display them. The
     * score itself is written by trust-core; this function no longer returns it,
     * because returning a number nothing persisted is how two truths form.
     */
    async calculateReliabilityScore(businessId: string): Promise<{
        googleRating: number;
        completionRate: number;
        observed: boolean;
    }> {
        const business = await prisma.business.findUnique({
            where: { id: businessId },
            select: { rating: true },
        });

        const [total, completed] = await Promise.all([
            prisma.reservation.count({
                where: {
                    businessId,
                    status: { in: ['COMPLETED', 'NO_SHOW'] },
                },
            }),
            prisma.reservation.count({
                where: { businessId, status: 'COMPLETED' },
            }),
        ]);

        // Both kept on 0–5 here, matching the shape of the source data. The
        // conversion to the canonical 0–100 scale is trust-core's job, and it
        // does that explicitly at the point of use rather than by writing a
        // pre-scaled number into a column three other modules also write.
        const completionRate = total > 0 ? (completed / total) * 5 : 0;
        const googleRating = business?.rating ?? 0;

        eventBus.emitEvent(
            'business.reviews_synced',
            {
                businessId,
                data: {
                    businessId,
                    googleRating,
                    completionRate,
                    hasHistory: total > 0,
                },
            },
            'booking',
        );

        return { googleRating, completionRate, observed: total > 0 };
    }
}

export const reviewService = new ReviewService();

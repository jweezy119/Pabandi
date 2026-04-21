import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class ReviewService {
    /**
     * Fetch and sync reviews for a business from Google
     */
    async syncBusinessReviews(businessId: string, googlePlaceId: string): Promise<void> {
        try {
            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            
            if (!apiKey) {
                logger.warn('GOOGLE_MAPS_API_KEY not found. Skipping real API call, using mock validation state.');
                return; // Optionally, throw an error if strictly requiring real data
            }

            logger.info(`Syncing Google reviews for business: ${businessId} via native Fetch`);

            // 1. Fetch real details from Google Places API direct via REST
            const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`;
            
            const res = await fetch(googleUrl);
            const response = (await res.json()) as any;

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
     * Calculate reliability score for a business
     * (googleRating * 0.4) + (bookingCompletionRate * 0.6)
     */
    async calculateReliabilityScore(businessId: string): Promise<number> {
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

        const completionRate = total > 0 ? (completed / total) * 5 : 4; // Scale 0-5
        const googleRating = business?.rating || 4;

        const reliabilityScore = (googleRating * 0.4) + (completionRate * 0.6);

        await prisma.business.update({
            where: { id: businessId },
            data: { reliabilityScore },
        });

        return reliabilityScore;
    }
}

export const reviewService = new ReviewService();

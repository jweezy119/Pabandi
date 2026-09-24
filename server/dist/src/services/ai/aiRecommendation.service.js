"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRecommendationService = exports.AIRecommendationService = void 0;
const database_1 = require("../../utils/database");
const logger_1 = require("../../utils/logger");
const aiRouter_service_1 = require("./aiRouter.service");
class AIRecommendationService {
    /**
     * Generate embeddings for a property and store them
     */
    async embedProperty(propertyId) {
        try {
            const property = await database_1.prisma.propertyManagerProperty.findUnique({
                where: { id: propertyId },
                include: {
                    photos: { take: 1 },
                    amenities: { include: { amenity: true } },
                    ratePlans: { where: { isActive: true } },
                },
            });
            if (!property) {
                throw new Error(`Property ${propertyId} not found`);
            }
            // Build searchable text representation
            const amenityNames = property.amenities.map(a => a.amenity.name).join(', ');
            const ratePlanNames = property.ratePlans.map(r => r.name).join(', ');
            const text = `${property.title} ${property.address || ''} ${property.city || ''} ${property.state || ''} ${amenityNames} ${ratePlanNames} ${property.bedrooms} bedrooms ${property.bathrooms} bathrooms`.trim();
            const result = await aiRouter_service_1.aiRouter.embed(text, 'openai');
            await database_1.prisma.aIEmbedding.upsert({
                where: { entityType_entityId_provider: { entityType: 'PROPERTY', entityId: propertyId, provider: result.provider } },
                update: { embedding: result.embedding, text, model: result.model },
                create: {
                    entityType: 'PROPERTY',
                    entityId: propertyId,
                    provider: result.provider,
                    model: result.model,
                    embedding: result.embedding,
                    text,
                },
            });
            return { propertyId, embedded: true, provider: result.provider };
        }
        catch (error) {
            logger_1.logger.error('[AI] Property embed failed:', error);
            throw error;
        }
    }
    /**
     * Find similar properties using semantic search
     */
    async findSimilarProperties(propertyId, limit = 10) {
        try {
            const targetEmbedding = await database_1.prisma.aIEmbedding.findUnique({
                where: { entityType_entityId_provider: { entityType: 'PROPERTY', entityId: propertyId, provider: 'openai' } },
            });
            if (!targetEmbedding) {
                // Auto-embed if not exists
                await this.embedProperty(propertyId);
                return this.findSimilarProperties(propertyId, limit);
            }
            // For PostgreSQL, we can use pgvector extension. For now, use a simple
            // property search fallback since we don't have pgvector installed.
            const property = await database_1.prisma.propertyManagerProperty.findUnique({
                where: { id: propertyId },
                include: { photos: { take: 1 }, amenities: { include: { amenity: true } } },
            });
            if (!property)
                return [];
            // Find properties with similar characteristics
            const similar = await database_1.prisma.propertyManagerProperty.findMany({
                where: {
                    id: { not: propertyId },
                    OR: [
                        { city: property.city },
                        { state: property.state },
                        { bedrooms: property.bedrooms },
                        { bathrooms: property.bathrooms },
                    ],
                },
                include: {
                    photos: { take: 1 },
                    amenities: { include: { amenity: true } },
                    _count: { select: { reviews: true } },
                },
                take: limit,
                orderBy: { createdAt: 'desc' },
            });
            return similar;
        }
        catch (error) {
            logger_1.logger.error('[AI] Similar properties search failed:', error);
            return [];
        }
    }
    /**
     * Batch embed all properties (for initial setup)
     */
    async batchEmbedProperties(limit = 100) {
        const properties = await database_1.prisma.propertyManagerProperty.findMany({
            take: limit,
            select: { id: true },
        });
        const results = [];
        for (const property of properties) {
            try {
                const result = await this.embedProperty(property.id);
                results.push(result);
            }
            catch (error) {
                logger_1.logger.warn(`[AI] Failed to embed property ${property.id}:`, error.message);
            }
        }
        return { embedded: results.length, total: properties.length };
    }
}
exports.AIRecommendationService = AIRecommendationService;
exports.aiRecommendationService = new AIRecommendationService();
//# sourceMappingURL=aiRecommendation.service.js.map
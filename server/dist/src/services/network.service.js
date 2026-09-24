"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkService = exports.NetworkService = void 0;
const database_1 = require("../utils/database");
const ecommerceReliabilityPredictor_1 = require("./ai/ecommerceReliabilityPredictor");
const logger_1 = require("../utils/logger");
const cache_service_1 = require("./cache.service");
class NetworkService {
    /**
     * Check a hashed phone number against the network.
     */
    async checkHash(hash) {
        try {
            // 1. Check the Edge Cache first (Latency: <1ms)
            const cachedResponse = cache_service_1.cacheService.get(hash);
            if (cachedResponse) {
                logger_1.logger.info(`[Edge Cache] Cache HIT for hash ${hash.substring(0, 8)}...`);
                return cachedResponse;
            }
            // 2. Fetch the hash and its incident history
            const identity = await database_1.prisma.hashedIdentity.findUnique({
                where: { hash },
                include: { disputes: true }
            });
            // If brand new, provide a default profile
            if (!identity) {
                const features = {
                    role: 'BUYER',
                    buyerHistory: { totalOrders: 0, cancellationRate: 0, returnRate: 0 },
                };
                const prediction = await ecommerceReliabilityPredictor_1.ecommerceReliabilityPredictor.predict(features);
                const result = {
                    status: 'NO_RECORD',
                    message: 'This hash has never been reported in the network.',
                    prediction
                };
                cache_service_1.cacheService.set(hash, result);
                return result;
            }
            // 3. Tally incidents
            const codRejections = identity.disputes.filter((d) => d.type === 'COD_REJECTION').length;
            const frauds = identity.disputes.filter((d) => d.type === 'FRAUD' || d.type === 'RETURN_FRAUD').length;
            const totalIncidents = identity.disputes.length;
            const syntheticCodRejectionRate = codRejections > 0 ? (codRejections / 5) : 0;
            const features = {
                role: 'BUYER',
                buyerHistory: {
                    totalOrders: 10,
                    cancellationRate: 0,
                    returnRate: (frauds / 5)
                },
                buyerDeliveryFactors: {
                    codRejectionRate: syntheticCodRejectionRate,
                    addressChanges: 0
                }
            };
            const prediction = await ecommerceReliabilityPredictor_1.ecommerceReliabilityPredictor.predict(features);
            const result = {
                status: 'RECORD_FOUND',
                totalIncidents,
                metrics: {
                    codRejections,
                    frauds
                },
                prediction
            };
            cache_service_1.cacheService.set(hash, result);
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Error checking hash ${hash}:`, error);
            throw error;
        }
    }
    /**
     * Report an incident (like COD Rejection) against a hashed phone number.
     */
    async reportHash(hash, type, description, apiClientId) {
        try {
            // 1. Upsert the HashedIdentity
            const identity = await database_1.prisma.hashedIdentity.upsert({
                where: { hash },
                update: {
                    totalIncidents: { increment: 1 },
                    riskScore: { decrement: type === 'COD_REJECTION' ? 10 : 25 }
                },
                create: {
                    hash,
                    totalIncidents: 1,
                    riskScore: type === 'COD_REJECTION' ? 60 : 45
                }
            });
            // 2. Create the Dispute linked to the hash
            const dispute = await database_1.prisma.dispute.create({
                data: {
                    hashedIdentityId: hash,
                    type,
                    description,
                    apiClientId,
                }
            });
            // Invalidate the cache since the data has changed
            cache_service_1.cacheService.invalidate(hash);
            return {
                success: true,
                incidentId: dispute.id,
                newRiskScore: identity.riskScore,
                totalIncidents: identity.totalIncidents
            };
        }
        catch (error) {
            logger_1.logger.error(`Error reporting hash ${hash}:`, error);
            throw error;
        }
    }
}
exports.NetworkService = NetworkService;
exports.networkService = new NetworkService();
//# sourceMappingURL=network.service.js.map
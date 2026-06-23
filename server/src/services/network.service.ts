import { prisma } from '../utils/database';
import { ecommerceReliabilityPredictor, EcommerceFeatures } from './ai/ecommerceReliabilityPredictor';
import { DisputeType } from '@prisma/client';
import { logger } from '../utils/logger';

export class NetworkService {
  
  /**
   * Check a hashed phone number against the network.
   */
  async checkHash(hash: string) {
    try {
      // 1. Fetch the hash and its incident history
      const identity = await prisma.hashedIdentity.findUnique({
        where: { hash },
        include: { disputes: true }
      });

      // If brand new, provide a default profile
      if (!identity) {
        const features: EcommerceFeatures = {
          role: 'BUYER',
          buyerHistory: { totalOrders: 0, cancellationRate: 0, returnRate: 0 },
        };
        const prediction = await ecommerceReliabilityPredictor.predict(features);
        return {
          status: 'NO_RECORD',
          message: 'This hash has never been reported in the network.',
          prediction
        };
      }

      // 2. Tally incidents
      const codRejections = identity.disputes.filter((d: any) => d.type === 'COD_REJECTION').length;
      const frauds = identity.disputes.filter((d: any) => d.type === 'FRAUD' || d.type === 'RETURN_FRAUD').length;
      
      const totalIncidents = identity.disputes.length;
      // We synthetically generate the "COD Rejection Rate" based on total incidents to feed the AI
      // In a real high-volume production system, we'd divide by total successful orders across the network.
      // For now, if they have >2 COD rejections, their rate is high.
      const syntheticCodRejectionRate = codRejections > 0 ? (codRejections / 5) : 0; 
      
      const features: EcommerceFeatures = {
        role: 'BUYER',
        buyerHistory: { 
          totalOrders: 10, // Assumed base to feed the AI
          cancellationRate: 0, 
          returnRate: (frauds / 5) 
        },
        buyerDeliveryFactors: {
          codRejectionRate: syntheticCodRejectionRate,
          addressChanges: 0
        }
      };

      const prediction = await ecommerceReliabilityPredictor.predict(features);

      return {
        status: 'RECORD_FOUND',
        totalIncidents,
        metrics: {
          codRejections,
          frauds
        },
        prediction
      };

    } catch (error) {
      logger.error(`Error checking hash ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Report an incident (like COD Rejection) against a hashed phone number.
   */
  async reportHash(hash: string, type: DisputeType, description?: string, apiClientId?: string) {
    try {
      // 1. Upsert the HashedIdentity
      const identity = await prisma.hashedIdentity.upsert({
        where: { hash },
        update: {
          totalIncidents: { increment: 1 },
          riskScore: { decrement: type === 'COD_REJECTION' ? 10 : 25 } // Arbitrary penalty rule
        },
        create: {
          hash,
          totalIncidents: 1,
          riskScore: type === 'COD_REJECTION' ? 60 : 45
        }
      });

      // 2. Create the Dispute linked to the hash
      const dispute = await prisma.dispute.create({
        data: {
          hashedIdentityId: hash,
          type,
          description,
          apiClientId,
        }
      });

      return {
        success: true,
        incidentId: dispute.id,
        newRiskScore: identity.riskScore,
        totalIncidents: identity.totalIncidents
      };

    } catch (error) {
      logger.error(`Error reporting hash ${hash}:`, error);
      throw error;
    }
  }
}

export const networkService = new NetworkService();

import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { noShowPredictor } from '../services/ai/noShowPredictor';
import { logger } from '../utils/logger';
import { reviewService } from '../services/reviewService';
import { cryptoService } from '../services/cryptoService';
import { ethers } from 'ethers';
import { reliabilityService } from '../services/reliability.service';
import { paymentRouter } from '../services/payment.router';
import { webhookService } from '../services/webhook.service';
import { notificationService } from '../services/notification.service';
import { conciergeService } from '../services/conciergeService';
import { trustSignalService } from '../services/trustSignal.service';
import { sendWhatsAppMessage } from '../services/ai.service';
import { buildOutreachMessageFromCatalog } from '../services/openwa.plugins.service';
import { openwaChatFlowService } from '../services/openwa.chat-flow.service';
import { channexService } from '../services/channex.service';
import moment from 'moment-timezone';

export const createReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      businessId,
      tableId,
      reservationDate,
      reservationTime,
      numberOfGuests,
      customerName,
      customerPhone,
      customerEmail,
      specialRequests,
      serviceIds,
      customServiceNames,
      checkOutDate,
    } = req.body;

    // Verify business exists and is active (check both id and googlePlaceId)
    let business = await prisma.business.findFirst({
      where: {
        OR: [
          { id: businessId },
          { googlePlaceId: businessId }
        ]
      },
      include: { settings: true },
    });

    // If not found in database, dynamically import from Google Places
    if (!business) {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        try {
          const axios = (await import('axios')).default;
          const googleRes = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json`, {
              params: {
                place_id: businessId,
                fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,geometry,photos',
                key: apiKey,
              }
            }
          );
          
          if (googleRes.data?.result) {
            const p = googleRes.data.result;
            
            let category: any = 'RESTAURANT';
            if (p.types) {
              if (p.types.includes('restaurant') || p.types.includes('cafe') || p.types.includes('bakery')) category = 'RESTAURANT';
              else if (p.types.includes('spa') || p.types.includes('beauty_salon') || p.types.includes('hair_care')) category = 'SPA';
              else if (p.types.includes('gym') || p.types.includes('health')) category = 'FITNESS_CENTER';
            }
            
            let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
            if (p.photos && p.photos.length > 0) {
              coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photos[0].photo_reference}&key=${apiKey}`;
            }

            business = await prisma.business.create({
              data: {
                googlePlaceId: businessId,
                name: p.name || 'Unknown Business',
                address: p.formatted_address || 'Unknown Address',
                phone: p.international_phone_number || p.formatted_phone_number || '+92 300 0000000',
                email: 'contact@pabandi.com',
                website: p.website || null,
                latitude: p.geometry?.location?.lat || 24.8607,
                longitude: p.geometry?.location?.lng || 67.0011,
                category: category,
                isClaimed: false,
                rating: p.rating || 4.5,
                reviewCount: p.user_ratings_total || 1,
                city: p.formatted_address?.split(',')[1]?.trim() || 'Karachi',
                description: `Imported Google listing for ${p.name}. Claim this profile to set up Web3 bookings.`,
                coverImageUrl,
              },
              include: { settings: true }
            });

            await prisma.businessSettings.create({
              data: {
                businessId: business.id,
              },
            });
          }
        } catch (detailsErr) {
          console.error('Failed to import dynamic place on reservation create:', detailsErr);
        }
      }
    }

    if (!business || !business.isActive) {
      throw new CustomError('Business not found or inactive', 404);
    }

    // Parse reservation date and time
    const tz = business.timezone || 'America/New_York';
    const dateTime = moment.tz(
      `${reservationDate} ${reservationTime}`,
      'YYYY-MM-DD HH:mm',
      tz
    );

    if (!dateTime.isValid() || dateTime.isBefore(moment.tz(tz))) {
      throw new CustomError('Invalid reservation date/time', 400);
    }

    // Check business hours
    const dayOfWeek = dateTime.day();
    const businessHour = await prisma.businessHours.findUnique({
      where: {
        businessId_dayOfWeek: {
          businessId: business.id,
          dayOfWeek,
        },
      },
    });

    if (business.isClaimed && (!businessHour || businessHour.isClosed)) {
      throw new CustomError('Business is closed on this day', 400);
    }

    // Trust signal evaluation (OSINT augment)
    const deviceFingerprint = (req.headers['x-device-fingerprint'] as string | undefined) || undefined;
    const trustSignals = await trustSignalService.evaluateSignals({
      email: customerEmail,
      phone: customerPhone,
      deviceFingerprint,
    });

    // Get customer history for AI prediction
    const customerHistory = req.user
      ? await noShowPredictor.getCustomerHistory(req.user.id, business.id)
      : undefined;

    const businessNoShowRate = await noShowPredictor.getBusinessNoShowRate(
      business.id
    );

    // Prepare features for AI prediction
    const features = {
      customerHistory,
      timeFactors: {
        dayOfWeek: dateTime.day(),
        hour: dateTime.hour(),
        isWeekend: [0, 6].includes(dayOfWeek), // Sunday or Saturday
        isHoliday: false, // Could be enhanced with holiday calendar
      },
      bookingFactors: {
        advanceBookingDays: dateTime.diff(moment.tz(tz), 'days'),
        isSameDay: dateTime.isSame(moment.tz(tz), 'day'),
        groupSize: numberOfGuests,
        hasSpecialRequests: !!specialRequests,
      },
      businessFactors: {
        averageNoShowRate: businessNoShowRate,
        businessRating: business.rating || undefined,
        requiresDeposit: business.requireDeposit || false,
      },
    };

    // Validate transaction hash if present and real
    if (req.body.transactionHash && !req.body.transactionHash.startsWith('pending_')) {
      const { paymentMethod, transactionHash } = req.body;
      
      try {
        if (paymentMethod === 'bsc') {
          if (!/^0x([A-Fa-f0-9]{64})$/.test(transactionHash)) throw new CustomError('Invalid BSC transaction hash format', 400);
          const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545');
          const receipt = await provider.getTransactionReceipt(transactionHash);
          if (!receipt || receipt.status !== 1) {
            throw new CustomError('Invalid or failed BSC transaction hash', 400);
          }
        } else if (paymentMethod === 'btc') {
          // BTC hashes are 64 char hex without 0x
          if (!/^[A-Fa-f0-9]{64}$/.test(transactionHash)) {
            throw new CustomError('Invalid Bitcoin transaction hash format', 400);
          }
          // Simulated mock verifier for BTC (since we don't have a live node integrated here yet)
          // In production, you'd use a service like Blockstream or Mempool.space API
          if (transactionHash === '0000000000000000000000000000000000000000000000000000000000000000') {
             throw new CustomError('Invalid or failed BTC transaction hash', 400);
          }
        } else if (paymentMethod === 'usd1') {
          if (!/^0x([A-Fa-f0-9]{64})$/.test(transactionHash)) throw new CustomError('Invalid USD1 transaction hash format', 400);
          // Assuming USD1 is on an EVM like Polygon or Ethereum
          const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
          const receipt = await provider.getTransactionReceipt(transactionHash).catch(() => null);
          // For testing environments where the tx doesn't actually exist on real polygon, 
          // we reject if we can't find it, enforcing strict checking.
          if (!receipt || receipt.status !== 1) {
            throw new CustomError('Invalid or failed USD1 transaction hash on-chain', 400);
          }
        }
      } catch (err: any) {
        if (err instanceof CustomError) throw err;
        logger.error(`Error verifying transaction hash: ${err.message}`);
        throw new CustomError(`Could not verify on-chain deposit for ${paymentMethod}`, 400);
      }
    }

    // Get AI prediction
    const prediction = await noShowPredictor.predict(features);

    // Determine if deposit is required
    const settings = business.settings;
    const requireDeposit =
      settings?.autoRequireDeposit &&
      prediction.riskScore >= (settings.aiRiskThreshold || 70);

    let depositAmount = req.body.depositAmount || null;
    if (!depositAmount && (requireDeposit || business.requireDeposit)) {
      if (business.depositPercentage) {
        // Calculate based on estimated bill (could be enhanced)
        depositAmount = 1000 * business.depositPercentage; // Placeholder
      } else if (business.depositAmount) {
        depositAmount = business.depositAmount;
      }
    }

    // Determine concierge status and initial reservation status
    const isConcierge = !business.isClaimed;
    const status = isConcierge ? 'PENDING_CONCIERGE' : (settings?.autoConfirm ? 'CONFIRMED' : 'PENDING');

    // Calculate total amount from services
    let totalAmount = 0;
    const servicesToCreate: any[] = [];
    
    if (serviceIds && Array.isArray(serviceIds)) {
      const selectedServices = await prisma.businessService.findMany({
        where: { id: { in: serviceIds }, businessId: business.id }
      });
      for (const s of selectedServices) {
        totalAmount += s.price;
        servicesToCreate.push({ serviceId: s.id, priceAtBooking: s.price });
      }
    }

    // Add custom service fallback logic if user inputs "Other" manually
    // The frontend can pass customServiceNames if they select "Other" and type a custom service
    let modifiedSpecialRequests = specialRequests;
    if (customServiceNames && Array.isArray(customServiceNames) && customServiceNames.length > 0) {
      const customString = `Custom Services requested: ${customServiceNames.join(', ')}`;
      modifiedSpecialRequests = modifiedSpecialRequests ? `${modifiedSpecialRequests}\n\n${customString}` : customString;
    }

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        businessId: business.id,
        customerId: req.user!.id,
        tableId,
        reservationDate: dateTime.toDate(),
        checkOutDate: checkOutDate ? moment.tz(checkOutDate, 'YYYY-MM-DD', tz).toDate() : null,
        reservationTime,
        numberOfGuests,
        status,
        isConcierge,
        customerName,
        customerPhone,
        customerEmail: customerEmail || req.user!.email,
        specialRequests: modifiedSpecialRequests,
        noShowProbability: prediction.probability,
        riskScore: prediction.riskScore,
        aiFactors: prediction.factors,
        trustSignals: trustSignals as any,
        depositRequired: !!depositAmount || !!req.body.transactionHash,
        depositAmount,
        depositStatus: !!req.body.transactionHash ? 'PAID' : (!!depositAmount ? 'PENDING' : 'NOT_REQUIRED'),
        cryptoDepositTxHash: req.body.transactionHash,
        source: 'web',
        totalAmount: totalAmount > 0 ? totalAmount : null,
        ...(servicesToCreate.length > 0 && {
          services: {
            create: servicesToCreate
          }
        })
      },
      include: {
        business: {
          select: { id: true, name: true, phone: true, address: true },
        },
      },
    });

    logger.info(
      `Reservation created: ${reservation.id}, Risk Score: ${prediction.riskScore}`
    );

    let checkoutUrl = null;
    if (depositAmount && (req.body.paymentMethod === 'safepay' || req.body.paymentMethod === 'paypal')) {
      const result = await paymentRouter.createCheckoutUrl(
        depositAmount,
        business.currency || 'USD',
        reservation.id
      );
      checkoutUrl = result.url;
    }

    // Trigger Webhook
    webhookService.dispatch('reservation.created', businessId, {
      reservation,
      checkoutUrl,
      prediction: {
        riskScore: prediction.riskScore,
        requiresDeposit: requireDeposit,
      },
    });

    // Send confirmation notification if not concierge (concierge sends its own once confirmed)
    if (!isConcierge) {
      await notificationService.sendConfirmation(reservation.id);
      await notificationService.sendBusinessNotification(reservation.id);
      
      // WhatsApp Integration: Send Booking Confirmation
      if (customerPhone) {
        const depositText = depositAmount || req.body.transactionHash 
          ? "✅ Deposit secured safely via Pabandi Escrow." 
          : "🌟 Booked with Zero Deposit! Your high Pabandi Trust Score waived the fee.";
          
        const body = `Hi ${customerName}! 👋\n\nYour reservation at *${business.name}* is confirmed for *${dateTime.format('MMMM Do YYYY')} at ${reservationTime}*.\n\n${depositText}\n\nNeed to cancel? Just reply to this message with *"Cancel"* to automatically cancel and refund your deposit.`;
        
        await sendWhatsAppMessage(customerPhone, body);
      }
    } else {
      if (business.phone) {
        logger.info(`[WhatsApp] Sending automated join invitation request to business at phone: ${business.phone}`);
        const outreachMessage = `Hi ${business.name}! 👋\n\nA customer just tried to book a reservation for ${numberOfGuests} guests on ${dateTime.format('MMMM Do YYYY')} at ${reservationTime} via Pabandi. \n\nClaim your business profile for free to accept this booking, manage your schedule, and set up automated escrow deposits:\nhttps://pabandi.com/business/${business.id}`;
        
        await sendWhatsAppMessage(business.phone, outreachMessage);
      }
      conciergeService.processReservation(reservation.id);

      // Advanced unclaimed outreach via OpenWA WhatsApp, plugin-aware when available
      if (business.phone) {
        try {
          const cleanPhone = business.phone.replace(/\+/g, '');
          const dateText = dateTime.format('MMMM Do YYYY');
          const baseMessage = [
            `You're missing bookings on Pabandi.`,
            ``,
            `A customer just tried to reserve ${numberOfGuests} seat${numberOfGuests === 1 ? '' : 's'} at *${business.name}* on *${dateText}* at *${reservationTime}*.`,
            ``,
            `Activate AI-backed escrow deposits, Web3 reliability scoring, and Solana $PAB rewards.`,
            ``,
            `Claim your profile free:`,
            `https://pabandi.com/business/${business.id}?claim=1`,
          ].join('\n');

          const outreachMsg = buildOutreachMessageFromCatalog({
            baseMessage,
            businessName: business.name,
            reservationDate: dateText,
            reservationTime,
            guests: numberOfGuests,
            claimUrl: `https://pabandi.com/business/${business.id}?claim=1`,
          });

          await sendWhatsAppMessage(cleanPhone, outreachMsg);
          logger.info(`[Outreach] Sent unclaimed business outreach to ${business.id} via WhatsApp`);

          try {
            const flowResult = await openwaChatFlowService.sendOutreachFlow(cleanPhone, {
              businessName: business.name,
              claimUrl: `https://pabandi.com/business/${business.id}?claim=1`,
            });

            logger.info(`[ChatFlow] Outreach flow status for ${business.id}: ${flowResult.status}`);
          } catch (flowErr) {
            logger.error(`[ChatFlow] Outreach flow failed for ${business.id}: ${(flowErr as any)?.message || flowErr}`);
          }
        } catch (outreachErr) {
          logger.error(`[Outreach] Failed to send WhatsApp outreach: ${(outreachErr as any)?.message || outreachErr}`);
        }
      }
    }

    // Attempt to push to Channex (non-blocking)
    if (!isConcierge && status === 'CONFIRMED' || (status === 'CONFIRMED' || req.body.transactionHash)) {
       channexService.pushBooking(reservation.id).catch(e => {
         logger.error(`Failed to background push to Channex: ${e.message}`);
       });
    }

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      data: {
        reservation,
        checkoutUrl,
        prediction: {
          riskScore: prediction.riskScore,
          requiresDeposit: requireDeposit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        business: true,
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        table: true,
        payments: true,
      },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Check authorization
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.customerId !== req.user!.id &&
      reservation.business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    res.json({
      success: true,
      data: { reservation },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Check authorization
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.customerId !== req.user!.id &&
      reservation.businessId !==
      (await prisma.business.findUnique({
        where: { ownerId: req.user!.id },
      }))?.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: updates,
    });

    // Trigger Webhook
    webhookService.dispatch('reservation.updated', updated.businessId, {
      reservation: updated,
    });

    res.json({
      success: true,
      message: 'Reservation updated successfully',
      data: { reservation: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Check authorization
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.customerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    // Check cancellation policy
    const business = await prisma.business.findUnique({
      where: { id: reservation.businessId },
    });

    const cancellationHours = business?.cancellationHours || 24;
    const reservationDateTime = moment.tz(
      `${reservation.reservationDate.toISOString().split('T')[0]} ${reservation.reservationTime}`,
      'YYYY-MM-DD HH:mm',
      business?.timezone || 'America/New_York'
    );

    const hoursUntilReservation = reservationDateTime.diff(moment(), 'hours');
    
    // Tiered Cancellation Rules
    let refundPercentage = 100;
    if (hoursUntilReservation < cancellationHours) {
      if (hoursUntilReservation < 2) {
        refundPercentage = 0; // Less than 2 hours: 0% refund
      } else {
        refundPercentage = 50; // Late cancel (but > 2h): 50% refund
      }
    }

    const cancelled = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    const isLateCancel = hoursUntilReservation < (cancellationHours + 12);
    await reliabilityService.updateScoreForReservationActivity(
      reservation.customerId, 
      'CANCELLED', 
      isLateCancel, 
      reservation.id, 
      reservation.depositAmount || 0
    );

    // Trigger Webhook
    webhookService.dispatch('reservation.cancelled', cancelled.businessId, {
      reservation: cancelled,
    });

    // Process refunds if deposit was paid or staked
    if (reservation.depositRequired && reservation.depositStatus === 'PAID') {
      try {
        // --- TIERED CRYPTO STAKE REFUND ---
        if (reservation.cryptoDepositTxHash?.startsWith('STAKED_')) {
          const stakedAmount = parseFloat(reservation.cryptoDepositTxHash.split('_')[1]);
          const userRefund = stakedAmount * (refundPercentage / 100);
          const businessComp = stakedAmount - userRefund;

          // Refund User
          if (userRefund > 0) {
            await prisma.wallet.upsert({
              where: { userId: reservation.customerId },
              update: { balance: { increment: userRefund } },
              create: { userId: reservation.customerId, balance: userRefund }
            });
          }

          // Compensate Business
          if (businessComp > 0 && business?.ownerId) {
            await prisma.wallet.upsert({
              where: { userId: business.ownerId },
              update: { balance: { increment: businessComp } },
              create: { userId: business.ownerId, balance: businessComp }
            });
          }

          await prisma.reservation.update({
            where: { id: reservation.id },
            data: { cryptoDepositTxHash: `CANCELLED_REFUND${refundPercentage}` }
          });
          logger.info(`Crypto tiered refund: ${refundPercentage}% to user (${userRefund} PAB), ${businessComp} to business.`);
          
          // Escrow Integration: STAKED refund is handled above in PAB
        } 
        // --- ON-CHAIN CRYPTO DEPOSIT REFUND ---
        else if (reservation.cryptoDepositTxHash && !reservation.cryptoDepositTxHash.startsWith('pending_')) {
          if (refundPercentage === 100) {
            await cryptoService.refundEscrowToCustomer(reservation.id);
            await prisma.reservation.update({
              where: { id: reservation.id },
              data: { cryptoDepositTxHash: `REFUNDED_100` }
            });
            logger.info(`Crypto on-chain refund triggered for reservation ${reservation.id}`);
          } else {
            logger.warn(`Partial refunds not supported for on-chain escrow yet (${reservation.id})`);
          }
        }
        // --- FIAT REFUND ---
        else {
          const currency = business?.currency || 'USD';
          const originalFiatAmount = reservation.depositAmount || 0;
          const fiatRefundAmount = originalFiatAmount * (refundPercentage / 100);
          
          if (fiatRefundAmount > 0) {
            await paymentRouter.refundDeposit(currency, reservation.id, fiatRefundAmount);
          }
          
          // Update payment records
          await prisma.payment.updateMany({
            where: { reservationId: reservation.id },
            data: {
              status: 'REFUNDED',
              refunded: true,
              refundedAt: new Date(),
              refundAmount: fiatRefundAmount,
            },
          });
          logger.info(`Successfully processed ${refundPercentage}% fiat refund of ${currency} ${fiatRefundAmount}`);
        }

        // Update reservation to record that deposit is no longer active
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: {
            depositPaid: false,
          },
        });
      } catch (refundError) {
        logger.error(`Error processing refund for reservation ${reservation.id}:`, refundError);
      }
    }

    res.json({
      success: true,
      message: 'Reservation cancelled successfully',
      data: { reservation: cancelled },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserReservations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const where: any = { customerId: req.user!.id };
    if (status) {
      where.status = status;
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: {
          business: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
            },
          },
        },
        orderBy: { reservationDate: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        reservations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const completeReservation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Verify ownership (only business owner or staff can complete)
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    if (reservation.status === 'COMPLETED') {
      throw new CustomError('Reservation already completed', 400);
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        depositStatus: reservation.depositRequired ? 'APPLIED_TO_SERVICE' : 'NOT_REQUIRED'
      },
    });

    // Trigger Crypto Rewards (User and Business)
    await cryptoService.rewardReservationCompletion(reservation.customerId, reservation.id);
    await cryptoService.rewardBusinessForCompletion(reservation.businessId, reservation.id);
    
    if (reservation.isConcierge) {
      await cryptoService.triggerConciergeCashback(reservation.customerId, reservation.id);
    }

    // Escrow Integration: Release funds to business
    if (reservation.depositRequired && reservation.cryptoDepositTxHash && reservation.cryptoDepositTxHash !== 'WEB3_TX_MOCK') {
      await cryptoService.releaseEscrowToBusiness(reservation.id);
    }

    // Proof of Visit SBT Minting
    try {
      const customerWallet = await prisma.wallet.findUnique({ where: { userId: reservation.customerId } });
      if (customerWallet && customerWallet.address) {
        await cryptoService.mintProofOfVisit(
          customerWallet.address,
          reservation.businessId,
          reservation.business.name
        );
      }
    } catch (e: any) {
      console.error('[POV] Failed to mint SBT:', e.message);
    }

    // Update Scores
    await reviewService.calculateReliabilityScore(reservation.businessId);
    await reliabilityService.updateScoreForReservationActivity(
      reservation.customerId, 
      'COMPLETED', 
      false, 
      reservation.id, 
      reservation.depositAmount || 0
    );

    // Ask for feedback via WhatsApp
    await notificationService.sendReviewRequest(reservation.id);

    res.json({
      success: true,
      message: 'Reservation completed and reward issued',
      data: { reservation: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const markNoShow = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!reservation) {
      throw new CustomError('Reservation not found', 404);
    }

    // Verify ownership
    if (
      req.user!.role !== 'ADMIN' &&
      reservation.business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'NO_SHOW',
        depositStatus: reservation.depositRequired ? 'REIMBURSED_TO_BUSINESS' : 'NOT_REQUIRED'
      },
    });

    // PAB reward for business when deposit protection applies
    await cryptoService.rewardBusinessNoShowProtected(reservation.businessId, reservation.id);

    // Escrow Integration: Release deposit to business
    if (reservation.depositRequired && reservation.cryptoDepositTxHash && reservation.cryptoDepositTxHash !== 'WEB3_TX_MOCK') {
      await cryptoService.releaseEscrowToBusiness(reservation.id);
    }

    // Update Scores (Business and User)
    await reviewService.calculateReliabilityScore(reservation.businessId);
    await reliabilityService.updateScoreForReservationActivity(
      reservation.customerId, 
      'NO_SHOW', 
      false, 
      reservation.id, 
      reservation.depositAmount || 0
    );

    res.json({
      success: true,
      message: 'Reservation marked as No-Show. Deposit captured and $PAB business reward issued.',
      data: { reservation: updated },
    });
  } catch (error) {
    next(error);
  }
};

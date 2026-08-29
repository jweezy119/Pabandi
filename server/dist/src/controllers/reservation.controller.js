"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbitrateFreelanceWork = exports.submitFreelanceWork = exports.markNoShow = exports.completeReservation = exports.getUserReservations = exports.cancelReservation = exports.updateReservation = exports.getReservation = exports.createReservation = void 0;
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const noShowPredictor_1 = require("../services/ai/noShowPredictor");
const pabTokenStaking_service_1 = require("../services/pabTokenStaking.service");
const pabond_service_1 = require("../services/pabond.service");
const logger_1 = require("../utils/logger");
const reviewService_1 = require("../services/reviewService");
const cryptoService_1 = require("../services/cryptoService");
const unifiedBooking_service_1 = require("../services/unifiedBooking.service");
const tokenomics_1 = require("../config/tokenomics");
const ethers_1 = require("ethers");
const reliability_service_1 = require("../services/reliability.service");
const payment_router_1 = require("../services/payment.router");
const webhook_service_1 = require("../services/webhook.service");
const notification_service_1 = require("../services/notification.service");
const conciergeService_1 = require("../services/conciergeService");
const trustSignal_service_1 = require("../services/trustSignal.service");
const ai_service_1 = require("../services/ai.service");
const openwa_plugins_service_1 = require("../services/openwa.plugins.service");
const openwa_chat_flow_service_1 = require("../services/openwa.chat-flow.service");
const channex_service_1 = require("../services/channex.service");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const referral_service_1 = require("../services/referral.service");
const env_1 = require("../utils/env");
const backgroundCheck_service_1 = require("../services/backgroundCheck.service");
const predictiveTrust_service_1 = require("../services/predictiveTrust.service");
const referralService = new referral_service_1.ReferralService();
const createReservation = async (req, res, next) => {
    try {
        const { businessId, tableId, reservationDate, reservationTime, numberOfGuests, customerName, customerPhone, customerEmail, specialRequests, serviceIds, customServiceNames, checkOutDate, } = req.body;
        // Verify business exists and is active (check both id and googlePlaceId)
        let business = await database_1.prisma.business.findFirst({
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
            const apiKey = '' /* Google Maps removed: free OSM enrichment instead */;
            if (apiKey) {
                try {
                    const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
                    const googleRes = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
                        params: {
                            place_id: businessId,
                            fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,geometry,photos',
                            key: apiKey,
                        }
                    });
                    if (googleRes.data?.result) {
                        const p = googleRes.data.result;
                        let category = 'RESTAURANT';
                        if (p.types) {
                            if (p.types.includes('restaurant') || p.types.includes('cafe') || p.types.includes('bakery'))
                                category = 'RESTAURANT';
                            else if (p.types.includes('spa') || p.types.includes('beauty_salon') || p.types.includes('hair_care'))
                                category = 'SPA';
                            else if (p.types.includes('gym') || p.types.includes('health'))
                                category = 'FITNESS_CENTER';
                        }
                        let coverImageUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200';
                        if (p.photos && p.photos.length > 0) {
                            coverImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photos[0].photo_reference}&key=${apiKey}`;
                        }
                        business = await database_1.prisma.business.create({
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
                        await database_1.prisma.businessSettings.create({
                            data: {
                                businessId: business.id,
                            },
                        });
                    }
                }
                catch (detailsErr) {
                    console.error('Failed to import dynamic place on reservation create:', detailsErr);
                }
            }
        }
        if (!business || !business.isActive) {
            throw new errorHandler_1.CustomError('Business not found or inactive', 404);
        }
        // Enforce Buyer Trust Gates
        if (req.user) {
            const customer = await database_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: { minimumSellerTrustScore: true }
            });
            if (customer && customer.minimumSellerTrustScore > 0) {
                if (business.trustScore < customer.minimumSellerTrustScore) {
                    throw new errorHandler_1.CustomError(`This business does not meet your minimum trust score requirement (${customer.minimumSellerTrustScore}).`, 403);
                }
            }
        }
        // ── HARD GATE: trust-gated escrow rails ──
        // Every booking screens the SELLER. Reuse a fresh (<=30d) completed verdict if
        // present; otherwise run one synchronously. REJECT or REVIEW blocks the booking.
        // Fails OPEN on check errors — a flaky external source must never block a legit user.
        let sellerCheck = await database_1.prisma.backgroundCheck.findFirst({
            where: {
                subjectId: business.id,
                status: 'COMPLETE',
                updatedAt: { gte: new Date(Date.now() - 30 * 86400000) },
            },
            orderBy: { updatedAt: 'desc' },
        });
        if (!sellerCheck) {
            try {
                const cid = await backgroundCheck_service_1.backgroundCheckService.createCheck({
                    subjectType: 'BUSINESS',
                    subjectName: business.name,
                    subjectId: business.id,
                    subjectWebsite: business.website || undefined,
                    requestedBy: req.user?.id,
                    trigger: 'PRE_BOOKING',
                    consent: true,
                    consentPurpose: 'Seller trust verification required to create a booking (Pabandi ToS + PECA/PDPA). Retention: 30d.',
                });
                for (let i = 0; i < 25; i++) {
                    const c = await backgroundCheck_service_1.backgroundCheckService.getCheck(cid);
                    if (c?.status === 'COMPLETE' || c?.status === 'FAILED') {
                        sellerCheck = c;
                        break;
                    }
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
            catch (e) {
                logger_1.logger.warn(`[Gate] seller background check failed, fail-open: ${e.message}`);
            }
        }
        if (sellerCheck && (sellerCheck.recommendation === 'REJECT' || sellerCheck.recommendation === 'REVIEW')) {
            throw new errorHandler_1.CustomError(`Booking blocked: seller failed background verification (band ${sellerCheck.riskBand}, ${sellerCheck.recommendation}). Resolve flags before booking.`, 403);
        }
        // Parse reservation date and time
        const tz = business.timezone || 'America/New_York';
        const dateTime = moment_timezone_1.default.tz(`${reservationDate} ${reservationTime}`, 'YYYY-MM-DD HH:mm', tz);
        if (!dateTime.isValid() || dateTime.isBefore(moment_timezone_1.default.tz(tz))) {
            throw new errorHandler_1.CustomError('Invalid reservation date/time', 400);
        }
        // Check business hours
        const dayOfWeek = dateTime.day();
        const businessHour = await database_1.prisma.businessHours.findUnique({
            where: {
                businessId_dayOfWeek: {
                    businessId: business.id,
                    dayOfWeek,
                },
            },
        });
        if (business.isClaimed && (!businessHour || businessHour.isClosed) && !req.body.isFreelanceEscrow) {
            throw new errorHandler_1.CustomError('Business is closed on this day', 400);
        }
        // Trust signal evaluation (OSINT augment)
        const deviceFingerprint = req.headers['x-device-fingerprint'] || undefined;
        const trustSignals = await trustSignal_service_1.trustSignalService.evaluateSignals({
            email: customerEmail,
            phone: customerPhone,
            deviceFingerprint,
        });
        // Get customer history for AI prediction
        const customerHistory = req.user
            ? await noShowPredictor_1.noShowPredictor.getCustomerHistory(req.user.id, business.id)
            : undefined;
        const businessNoShowRate = await noShowPredictor_1.noShowPredictor.getBusinessNoShowRate(business.id);
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
                advanceBookingDays: dateTime.diff(moment_timezone_1.default.tz(tz), 'days'),
                isSameDay: dateTime.isSame(moment_timezone_1.default.tz(tz), 'day'),
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
                    if (!/^0x([A-Fa-f0-9]{64})$/.test(transactionHash))
                        throw new errorHandler_1.CustomError('Invalid BSC transaction hash format', 400);
                    const provider = new ethers_1.ethers.JsonRpcProvider(process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545');
                    const receipt = await provider.getTransactionReceipt(transactionHash);
                    if (!receipt || receipt.status !== 1) {
                        throw new errorHandler_1.CustomError('Invalid or failed BSC transaction hash', 400);
                    }
                }
                else if (paymentMethod === 'btc') {
                    // BTC hashes are 64 char hex without 0x
                    if (!/^[A-Fa-f0-9]{64}$/.test(transactionHash)) {
                        throw new errorHandler_1.CustomError('Invalid Bitcoin transaction hash format', 400);
                    }
                    // Simulated mock verifier for BTC (since we don't have a live node integrated here yet)
                    // In production, you'd use a service like Blockstream or Mempool.space API
                    if (transactionHash === '0000000000000000000000000000000000000000000000000000000000000000') {
                        throw new errorHandler_1.CustomError('Invalid or failed BTC transaction hash', 400);
                    }
                }
                else if (paymentMethod === 'usd1') {
                    if (!/^0x([A-Fa-f0-9]{64})$/.test(transactionHash))
                        throw new errorHandler_1.CustomError('Invalid USD1 transaction hash format', 400);
                    // Assuming USD1 is on an EVM like Polygon or Ethereum
                    const provider = new ethers_1.ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
                    const receipt = await provider.getTransactionReceipt(transactionHash).catch(() => null);
                    // For testing environments where the tx doesn't actually exist on real polygon, 
                    // we reject if we can't find it, enforcing strict checking.
                    if (!receipt || receipt.status !== 1) {
                        throw new errorHandler_1.CustomError('Invalid or failed USD1 transaction hash on-chain', 400);
                    }
                }
            }
            catch (err) {
                if (err instanceof errorHandler_1.CustomError)
                    throw err;
                logger_1.logger.error(`Error verifying transaction hash: ${err.message}`);
                throw new errorHandler_1.CustomError(`Could not verify on-chain deposit for ${paymentMethod}`, 400);
            }
        }
        // Get AI prediction
        const prediction = await noShowPredictor_1.noShowPredictor.predict(features);
        // Apply $PAB staking multiplier to reduce deposit for staked users
        const { multiplier: stakeMultiplier, totalStaked } = await pabTokenStaking_service_1.pabTokenStakingService.getTrustMultiplier(req.user.id);
        // Determine if deposit is required
        const settings = business.settings;
        let requireDeposit = false;
        let depositAmount = req.body.depositAmount || null;
        let depositStatus = 'NOT_REQUIRED';
        // Determine concierge status and initial reservation status
        const isConcierge = !business.isClaimed;
        let status = isConcierge ? 'PENDING_CONCIERGE' : (settings?.autoConfirm ? 'CONFIRMED' : 'PENDING');
        if (req.body.isFreelanceEscrow) {
            requireDeposit = true;
            const subtotal = (req.body.estimatedHours || 1) * (req.body.hourlyRate || 0);
            depositAmount = subtotal * 1.05; // 5% fee
            const depositDefaultWeb3 = (0, env_1.defaultDepositModeWeb3)();
            depositStatus = depositDefaultWeb3 ? 'PENDING_WEB3' : 'PENDING';
            status = 'PENDING';
        }
        else {
            requireDeposit = Boolean(settings?.autoRequireDeposit && prediction.riskScore >= (settings.aiRiskThreshold || 70));
            if (!depositAmount && (requireDeposit || business.requireDeposit)) {
                if (business.depositPercentage) {
                    depositAmount = 1000 * business.depositPercentage;
                }
                else if (business.depositAmount) {
                    depositAmount = business.depositAmount;
                }
            }
            // Reduce deposit by staking multiplier (e.g., 2.5x staker pays 40% of deposit)
            if (depositAmount && stakeMultiplier > 1.0) {
                depositAmount = Math.round(depositAmount / stakeMultiplier);
            }
            const depositDefaultWeb3 = (0, env_1.defaultDepositModeWeb3)();
            depositStatus = !!req.body.transactionHash ? 'PAID'
                : !!depositAmount ? (depositDefaultWeb3 ? 'PENDING_WEB3' : 'PENDING')
                    : 'NOT_REQUIRED';
        }
        // Calculate total amount from services
        let totalAmount = 0;
        const servicesToCreate = [];
        if (serviceIds && Array.isArray(serviceIds)) {
            const selectedServices = await database_1.prisma.businessService.findMany({
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
        const reservation = await database_1.prisma.reservation.create({
            data: {
                businessId: business.id,
                customerId: req.user.id,
                tableId,
                reservationDate: dateTime.toDate(),
                checkOutDate: checkOutDate ? moment_timezone_1.default.tz(checkOutDate, 'YYYY-MM-DD', tz).toDate() : null,
                reservationTime,
                numberOfGuests,
                status: status,
                isConcierge,
                customerName,
                customerPhone,
                customerEmail: customerEmail || req.user.email,
                specialRequests: modifiedSpecialRequests,
                noShowProbability: prediction.probability,
                riskScore: prediction.riskScore,
                aiFactors: prediction.factors,
                trustSignals: trustSignals,
                depositRequired: !!depositAmount || !!req.body.transactionHash,
                depositAmount,
                depositStatus,
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
        logger_1.logger.info(`Reservation created: ${reservation.id}, Risk Score: ${prediction.riskScore}`);
        // Predictive Intelligence layer: blend real customer/business history into the
        // booking's aiFactors (non-destructive — augments the rule-based predictor above).
        predictiveTrust_service_1.predictiveTrustService
            .attachPredictionToReservation(reservation.id, {
            customerId: req.user.id,
            businessId: business.id,
            reservationTime,
        })
            .catch((e) => logger_1.logger.warn(`[PredictiveTrust] attach skipped: ${e.message}`));
        let checkoutUrl = null;
        let checkoutSessionId = null;
        if (depositAmount) {
            if (req.body.isFreelanceEscrow) {
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24);
                const session = await database_1.prisma.checkoutSession.create({
                    data: {
                        businessId: business.id,
                        amount: depositAmount,
                        currency: business.currency || 'USD',
                        successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
                        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}`,
                        status: 'PENDING',
                        expiresAt,
                        metadata: { source: 'freelance_escrow', reservationId: reservation.id }
                    }
                });
                checkoutSessionId = session.id;
                checkoutUrl = `/checkout/${session.id}`;
            }
            else if (req.body.paymentMethod === 'safepay' || req.body.paymentMethod === 'paypal') {
                const result = await payment_router_1.paymentRouter.createCheckoutUrl(depositAmount, business.currency || 'USD', reservation.id);
                checkoutUrl = result.url;
            }
        }
        // Trigger Webhook
        webhook_service_1.webhookService.dispatch('reservation.created', businessId, {
            reservation,
            checkoutUrl,
            prediction: {
                riskScore: prediction.riskScore,
                requiresDeposit: requireDeposit,
            },
        });
        // Send confirmation notification if not concierge (concierge sends its own once confirmed)
        if (!isConcierge) {
            await notification_service_1.notificationService.sendConfirmation(reservation.id);
            await notification_service_1.notificationService.sendBusinessNotification(reservation.id);
            // WhatsApp Integration: Send Booking Confirmation
            if (customerPhone) {
                const depositText = depositAmount || req.body.transactionHash
                    ? "✅ Deposit secured safely via Pabandi Escrow."
                    : "🌟 Booked with Zero Deposit! Your high Pabandi Trust Score waived the fee.";
                const body = `Hi ${customerName}! 👋\n\nYour reservation at *${business.name}* is confirmed for *${dateTime.format('MMMM Do YYYY')} at ${reservationTime}*.\n\n${depositText}\n\nNeed to cancel? Just reply to this message with *"Cancel"* to automatically cancel and refund your deposit.`;
                await (0, ai_service_1.sendWhatsAppMessage)(customerPhone, body);
            }
        }
        else {
            if (business.phone) {
                logger_1.logger.info(`[WhatsApp] Sending automated join invitation request to business at phone: ${business.phone}`);
                const outreachMessage = `Hi ${business.name}! 👋\n\nA customer just tried to book a reservation for ${numberOfGuests} guests on ${dateTime.format('MMMM Do YYYY')} at ${reservationTime} via Pabandi. \n\nClaim your business profile for free to accept this booking, manage your schedule, and set up automated escrow deposits:\nhttps://pabandi.com/business/${business.id}`;
                await (0, ai_service_1.sendWhatsAppMessage)(business.phone, outreachMessage);
            }
            conciergeService_1.conciergeService.processReservation(reservation.id);
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
                    const outreachMsg = (0, openwa_plugins_service_1.buildOutreachMessageFromCatalog)({
                        baseMessage,
                        businessName: business.name,
                        reservationDate: dateText,
                        reservationTime,
                        guests: numberOfGuests,
                        claimUrl: `https://pabandi.com/business/${business.id}?claim=1`,
                    });
                    await (0, ai_service_1.sendWhatsAppMessage)(cleanPhone, outreachMsg);
                    logger_1.logger.info(`[Outreach] Sent unclaimed business outreach to ${business.id} via WhatsApp`);
                    try {
                        const flowResult = await openwa_chat_flow_service_1.openwaChatFlowService.sendOutreachFlow(cleanPhone, {
                            businessName: business.name,
                            claimUrl: `https://pabandi.com/business/${business.id}?claim=1`,
                        });
                        logger_1.logger.info(`[ChatFlow] Outreach flow status for ${business.id}: ${flowResult.status}`);
                    }
                    catch (flowErr) {
                        logger_1.logger.error(`[ChatFlow] Outreach flow failed for ${business.id}: ${flowErr?.message || flowErr}`);
                    }
                }
                catch (outreachErr) {
                    logger_1.logger.error(`[Outreach] Failed to send WhatsApp outreach: ${outreachErr?.message || outreachErr}`);
                }
            }
        }
        // Attempt to push to Channex (non-blocking)
        if (!isConcierge && status === 'CONFIRMED' || (status === 'CONFIRMED' || req.body.transactionHash)) {
            channex_service_1.channexService.pushBooking(reservation.id).catch(e => {
                logger_1.logger.error(`Failed to background push to Channex: ${e.message}`);
            });
        }
        // Yield Integration: Route locked deposits to Mudarabah Yield Vault
        if (depositAmount && req.body.transactionHash && !req.body.transactionHash.startsWith('pending_')) {
            try {
                await database_1.prisma.treasuryPosition.create({
                    data: {
                        bucket: 'YIELD_REINVEST',
                        amount: depositAmount,
                        status: 'DEPLOYED',
                        meta: {
                            source: 'ESCROW_DEPOSIT_LOCK',
                            reservationId: reservation.id,
                            expectedApy: 0.045 // 4.5% simulated yield
                        }
                    }
                });
                logger_1.logger.info(`Routed ${depositAmount} to Mudarabah Yield Vault for ${reservation.id}`);
            }
            catch (err) {
                logger_1.logger.error(`Failed to log TreasuryPosition for yield: ${err}`);
            }
        }
        // ── Pabond: Mint $PAB via bonding curve for completed booking commitment ──
        // Users earn $PAB proportional to deposit amount, with velocity multiplier
        // from TrustFlux. Rising-trust users get cheaper $PAB.
        let pabondResult = null;
        if (depositAmount && req.user?.id) {
            try {
                const depositUSD = Number((depositAmount / 100).toFixed(2)); // convert cents to USD
                const mintResult = await pabond_service_1.pabondService.mint({
                    userId: req.user.id,
                    amountUSD: depositUSD,
                    source: 'BOOKING_DEPOSIT',
                    metadata: { reservationId: reservation.id, depositAmount },
                });
                if (mintResult.success) {
                    pabondResult = {
                        pabTokens: mintResult.pabTokens,
                        velocityMultiplier: mintResult.velocityMultiplier,
                    };
                    logger_1.logger.info(`[Pabond] Minted ${mintResult.pabTokens} $PAB for deposit on reservation ${reservation.id}`);
                }
            }
            catch (err) {
                logger_1.logger.error(`[Pabond] Failed to mint $PAB: ${err.message}`);
            }
        }
        // ── Reputation Insurance: Underwrite optional coverage ───────────────
        let insuranceOffer = null;
        try {
            const { reputationInsuranceService } = await Promise.resolve().then(() => __importStar(require('../services/reputationInsurance.service')));
            const underwriteResult = await reputationInsuranceService.underwrite(business.id, // provider
            req.user.id, // customer
            reservation.id, requireDeposit ? Number(depositAmount) : 0, 'NO_SHOW');
            insuranceOffer = {
                available: underwriteResult.approved,
                riskBand: underwriteResult.riskBand,
                premiumUSD: underwriteResult.premiumUSD,
                premiumPAB: underwriteResult.premiumPAB,
                coverageAmount: underwriteResult.coverageAmount,
                reason: underwriteResult.reason,
            };
        }
        catch (err) {
            logger_1.logger.error(`[Insurance] Failed to underwrite: ${err.message}`);
        }
        res.status(201).json({
            success: true,
            message: 'Reservation created successfully',
            data: {
                reservation,
                checkoutUrl,
                checkoutSessionId,
                prediction: {
                    riskScore: prediction.riskScore,
                    requiresDeposit: requireDeposit,
                    stakingMultiplier: stakeMultiplier,
                    totalStakedPab: totalStaked,
                    depositReduction: stakeMultiplier > 1.0
                        ? `${Math.round((1 - 1 / stakeMultiplier) * 100)}% via $PAB staking`
                        : undefined,
                },
                pabond: pabondResult,
                insurance: insuranceOffer,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createReservation = createReservation;
const getReservation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const reservation = await database_1.prisma.reservation.findUnique({
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
            throw new errorHandler_1.CustomError('Reservation not found', 404);
        }
        // Check authorization
        if (req.user.role !== 'ADMIN' &&
            reservation.customerId !== req.user.id &&
            reservation.business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        res.json({
            success: true,
            data: { reservation },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getReservation = getReservation;
const updateReservation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id },
        });
        if (!reservation) {
            throw new errorHandler_1.CustomError('Reservation not found', 404);
        }
        // Check authorization
        if (req.user.role !== 'ADMIN' &&
            reservation.customerId !== req.user.id &&
            reservation.businessId !==
                (await database_1.prisma.business.findUnique({
                    where: { ownerId: req.user.id },
                }))?.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        const updated = await database_1.prisma.reservation.update({
            where: { id },
            data: updates,
        });
        // Trigger Webhook
        webhook_service_1.webhookService.dispatch('reservation.updated', updated.businessId, {
            reservation: updated,
        });
        res.json({
            success: true,
            message: 'Reservation updated successfully',
            data: { reservation: updated },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateReservation = updateReservation;
const cancelReservation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id },
        });
        if (!reservation) {
            throw new errorHandler_1.CustomError('Reservation not found', 404);
        }
        // Check authorization
        if (req.user.role !== 'ADMIN' &&
            reservation.customerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        // Check cancellation policy
        const business = await database_1.prisma.business.findUnique({
            where: { id: reservation.businessId },
        });
        const cancellationHours = business?.cancellationHours || 24;
        const reservationDateTime = moment_timezone_1.default.tz(`${reservation.reservationDate.toISOString().split('T')[0]} ${reservation.reservationTime}`, 'YYYY-MM-DD HH:mm', business?.timezone || 'America/New_York');
        const hoursUntilReservation = reservationDateTime.diff((0, moment_timezone_1.default)(), 'hours');
        // Tiered Cancellation Rules
        let refundPercentage = 100;
        if (hoursUntilReservation < cancellationHours) {
            if (hoursUntilReservation < 2) {
                refundPercentage = 0; // Less than 2 hours: 0% refund
            }
            else {
                refundPercentage = 50; // Late cancel (but > 2h): 50% refund
            }
        }
        const cancelled = await database_1.prisma.reservation.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
            },
        });
        const isLateCancel = hoursUntilReservation < (cancellationHours + 12);
        await reliability_service_1.reliabilityService.updateScoreForReservationActivity(reservation.customerId, 'CANCELLED', isLateCancel, reservation.id, reservation.depositAmount || 0);
        // Trigger Webhook
        webhook_service_1.webhookService.dispatch('reservation.cancelled', cancelled.businessId, {
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
                        await database_1.prisma.wallet.upsert({
                            where: { userId: reservation.customerId },
                            update: { balance: { increment: userRefund } },
                            create: { userId: reservation.customerId, balance: userRefund }
                        });
                    }
                    // Compensate Business
                    if (businessComp > 0 && business?.ownerId) {
                        await database_1.prisma.wallet.upsert({
                            where: { userId: business.ownerId },
                            update: { balance: { increment: businessComp } },
                            create: { userId: business.ownerId, balance: businessComp }
                        });
                    }
                    await database_1.prisma.reservation.update({
                        where: { id: reservation.id },
                        data: { cryptoDepositTxHash: `CANCELLED_REFUND${refundPercentage}` }
                    });
                    logger_1.logger.info(`Crypto tiered refund: ${refundPercentage}% to user (${userRefund} PAB), ${businessComp} to business.`);
                    // Escrow Integration: STAKED refund is handled above in PAB
                }
                // --- ON-CHAIN CRYPTO DEPOSIT REFUND ---
                else if (reservation.cryptoDepositTxHash && !reservation.cryptoDepositTxHash.startsWith('pending_')) {
                    if (refundPercentage === 100) {
                        await cryptoService_1.cryptoService.refundEscrowToCustomer(reservation.id);
                        await database_1.prisma.reservation.update({
                            where: { id: reservation.id },
                            data: { cryptoDepositTxHash: `REFUNDED_100` }
                        });
                        logger_1.logger.info(`Crypto on-chain refund triggered for reservation ${reservation.id}`);
                    }
                    else {
                        logger_1.logger.warn(`Partial refunds not supported for on-chain escrow yet (${reservation.id})`);
                    }
                }
                // --- FIAT REFUND ---
                else {
                    const currency = business?.currency || 'USD';
                    const originalFiatAmount = reservation.depositAmount || 0;
                    const fiatRefundAmount = originalFiatAmount * (refundPercentage / 100);
                    if (fiatRefundAmount > 0) {
                        await payment_router_1.paymentRouter.refundDeposit(currency, reservation.id, fiatRefundAmount);
                    }
                    // Update payment records
                    await database_1.prisma.payment.updateMany({
                        where: { reservationId: reservation.id },
                        data: {
                            status: 'REFUNDED',
                            refunded: true,
                            refundedAt: new Date(),
                            refundAmount: fiatRefundAmount,
                        },
                    });
                    logger_1.logger.info(`Successfully processed ${refundPercentage}% fiat refund of ${currency} ${fiatRefundAmount}`);
                }
                // Update reservation to record that deposit is no longer active
                await database_1.prisma.reservation.update({
                    where: { id: reservation.id },
                    data: {
                        depositPaid: false,
                    },
                });
            }
            catch (refundError) {
                logger_1.logger.error(`Error processing refund for reservation ${reservation.id}:`, refundError);
            }
        }
        res.json({
            success: true,
            message: 'Reservation cancelled successfully',
            data: { reservation: cancelled },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.cancelReservation = cancelReservation;
const getUserReservations = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const where = { customerId: req.user.id };
        if (status) {
            where.status = status;
        }
        const [reservations, total] = await Promise.all([
            database_1.prisma.reservation.findMany({
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
            database_1.prisma.reservation.count({ where }),
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
    }
    catch (error) {
        next(error);
    }
};
exports.getUserReservations = getUserReservations;
const completeReservation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id },
            include: { business: true },
        });
        if (!reservation) {
            throw new errorHandler_1.CustomError('Reservation not found', 404);
        }
        // Verify ownership (only business owner or staff can complete)
        if (req.user.role !== 'ADMIN' &&
            reservation.business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        if (reservation.status === 'COMPLETED') {
            throw new errorHandler_1.CustomError('Reservation already completed', 400);
        }
        const updated = await database_1.prisma.reservation.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                depositStatus: reservation.depositRequired ? 'APPLIED_TO_SERVICE' : 'NOT_REQUIRED'
            },
        });
        // Trigger Crypto Rewards (User and Business)
        await cryptoService_1.cryptoService.rewardReservationCompletion(reservation.customerId, reservation.id);
        await cryptoService_1.cryptoService.rewardBusinessForCompletion(reservation.businessId, reservation.id);
        if (reservation.isConcierge) {
            await cryptoService_1.cryptoService.triggerConciergeCashback(reservation.customerId, reservation.id);
        }
        // ── UNIFIED SOL PLATFORM FEE (same ledger as agents) ──────────────────────
        // Fire on EVERY completed booking to maximize captured monetary value. The fee is
        // recorded in the single SOL ledger; onChain=true only when an on-chain release
        // actually executed (escrow oracle key present + real deposit tx).
        try {
            const bookingValueUsd = (reservation.totalAmount || reservation.depositAmount || 0);
            const platformFeeUsd = bookingValueUsd * 0.015; // 1.5% platform fee
            const customerWallet = await database_1.prisma.wallet.findUnique({ where: { userId: reservation.customerId } });
            // Determine if an on-chain release happened (real deposit tx + oracle key set).
            // NOTE: the SOL platform fee is collected CLIENT-SIDE at deposit time (the customer
            // signs it atomically with the deposit in client/src/utils/web3.ts). So once a real
            // deposit tx exists, the fee is on-chain regardless of the oracle release.
            let onChain = false;
            const hasRealDeposit = !!reservation.cryptoDepositTxHash && reservation.cryptoDepositTxHash !== 'WEB3_TX_MOCK';
            if (hasRealDeposit) {
                onChain = true; // SOL fee already transferred client-side in the deposit tx
                try {
                    await cryptoService_1.cryptoService.releaseEscrowToBusiness(reservation.id);
                }
                catch (relErr) {
                    logger_1.logger.warn(`[Escrow] Value release skipped/failed for ${reservation.id}: ${relErr}`);
                }
            }
            if (platformFeeUsd > 0) {
                const fee = await (0, unifiedBooking_service_1.collectPlatformFee)({
                    bookingRef: `human:${reservation.id}`,
                    usdValue: platformFeeUsd,
                    amountSol: platformFeeUsd / tokenomics_1.SOL_USD_PRICE,
                    source: 'HUMAN_BOOKING',
                    payerAddress: customerWallet?.address || undefined,
                    txHash: reservation.cryptoDepositTxHash && reservation.cryptoDepositTxHash !== 'WEB3_TX_MOCK' ? reservation.cryptoDepositTxHash : undefined,
                    onChain,
                });
                logger_1.logger.info(`[Escrow] Platform fee ${platformFeeUsd} USD (${fee.usdValue}) recorded for ${reservation.id} onChain=${onChain}`);
            }
        }
        catch (err) {
            logger_1.logger.error(`Failed to process unified platform fee: ${err}`);
        }
        // Proof of Visit SBT Minting
        try {
            const customerWallet = await database_1.prisma.wallet.findUnique({ where: { userId: reservation.customerId } });
            if (customerWallet && customerWallet.address) {
                await cryptoService_1.cryptoService.mintProofOfVisit(customerWallet.address, reservation.businessId, reservation.business.name);
            }
        }
        catch (e) {
            console.error('[POV] Failed to mint SBT:', e.message);
        }
        // Update Scores
        await reviewService_1.reviewService.calculateReliabilityScore(reservation.businessId);
        await reliability_service_1.reliabilityService.updateScoreForReservationActivity(reservation.customerId, 'COMPLETED', false, reservation.id, reservation.depositAmount || 0);
        // Ask for feedback via WhatsApp
        await notification_service_1.notificationService.sendReviewRequest(reservation.id);
        // Trigger Referral Commission & First Booking Bounty
        try {
            await referralService.processFirstBookingBounty(reservation.id);
            await referralService.calculateBookingCommission(reservation.id);
        }
        catch (e) {
            logger_1.logger.error(`[Referral] Failed to calculate commission: ${e.message}`);
        }
        res.json({
            success: true,
            message: 'Reservation completed and reward issued',
            data: { reservation: updated },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.completeReservation = completeReservation;
const markNoShow = async (req, res, next) => {
    try {
        const { id } = req.params;
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id },
            include: { business: true },
        });
        if (!reservation) {
            throw new errorHandler_1.CustomError('Reservation not found', 404);
        }
        // Verify ownership
        if (req.user.role !== 'ADMIN' &&
            reservation.business.ownerId !== req.user.id) {
            throw new errorHandler_1.CustomError('Unauthorized', 403);
        }
        const updated = await database_1.prisma.reservation.update({
            where: { id },
            data: {
                status: 'NO_SHOW',
                depositStatus: reservation.depositRequired ? 'REIMBURSED_TO_BUSINESS' : 'NOT_REQUIRED'
            },
        });
        // PAB reward for business when deposit protection applies
        await cryptoService_1.cryptoService.rewardBusinessNoShowProtected(reservation.businessId, reservation.id);
        // Escrow Integration: Release deposit to business
        if (reservation.depositRequired && reservation.cryptoDepositTxHash && reservation.cryptoDepositTxHash !== 'WEB3_TX_MOCK') {
            await cryptoService_1.cryptoService.releaseEscrowToBusiness(reservation.id);
        }
        // Update Scores (Business and User)
        await reviewService_1.reviewService.calculateReliabilityScore(reservation.businessId);
        await reliability_service_1.reliabilityService.updateScoreForReservationActivity(reservation.customerId, 'NO_SHOW', false, reservation.id, reservation.depositAmount || 0);
        res.json({
            success: true,
            message: 'Reservation marked as No-Show. Deposit captured and $PAB business reward issued.',
            data: { reservation: updated },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markNoShow = markNoShow;
/**
 * Submit freelance deliverables (Marks milestone as pending approval)
 */
const submitFreelanceWork = async (req, res) => {
    try {
        const reservationId = req.params.id;
        const { deliverables } = req.body;
        const reservation = await database_1.prisma.reservation.findUnique({ where: { id: reservationId } });
        if (!reservation) {
            res.status(404).json({ error: 'Reservation not found' });
            return;
        }
        if (req.user.role !== 'ADMIN' && req.user.id !== reservation.customerId) {
            res.status(403).json({ error: 'Unauthorized to submit work for this reservation' });
            return;
        }
        const updated = await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: {
                notes: (reservation.notes ? reservation.notes + '\n\n' : '') + `[DELIVERABLES SUBMITTED]: ${deliverables}`,
                status: 'CHECKED_IN' // We use CHECKED_IN to signify "In Progress/Delivered"
            }
        });
        res.json({ success: true, reservation: updated });
    }
    catch (error) {
        logger_1.logger.error('Error submitting work', error);
        res.status(500).json({ error: 'Failed to submit work' });
    }
};
exports.submitFreelanceWork = submitFreelanceWork;
/**
 * Request AI Arbitration for a freelance job
 */
const arbitrateFreelanceWork = async (req, res) => {
    try {
        const reservationId = req.params.id;
        const { reason } = req.body;
        const reservation = await database_1.prisma.reservation.findUnique({ where: { id: reservationId }, include: { business: true } });
        if (!reservation) {
            res.status(404).json({ error: 'Reservation not found' });
            return;
        }
        if (req.user.role !== 'ADMIN' && req.user.id !== reservation.customerId && req.user.id !== reservation.business.ownerId) {
            res.status(403).json({ error: 'Unauthorized to request arbitration for this reservation' });
            return;
        }
        const dispute = await database_1.prisma.dispute.create({
            data: {
                userId: reservation.customerId,
                reservationId: reservation.id,
                description: reason || 'Freelancer requested arbitration for unapproved deliverables',
                type: 'OTHER'
            }
        });
        res.json({ success: true, disputeId: dispute.id });
    }
    catch (error) {
        logger_1.logger.error('Error requesting arbitration', error);
        res.status(500).json({ error: 'Failed to request arbitration' });
    }
};
exports.arbitrateFreelanceWork = arbitrateFreelanceWork;
//# sourceMappingURL=reservation.controller.js.map
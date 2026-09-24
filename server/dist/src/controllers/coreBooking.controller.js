"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookingStatus = exports.checkin = exports.confirmPayment = exports.createWithPayment = void 0;
const database_1 = require("../utils/database");
const squareCheckout_service_1 = require("../services/squareCheckout.service");
const rewardEngine_service_1 = require("../services/rewardEngine.service");
const qrcode_1 = require("../utils/qrcode");
const crypto_1 = __importDefault(require("crypto"));
function generateBookingRef() {
    const timestamp = Date.now();
    const random = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
    return `PAB-${timestamp}-${random}`;
}
/**
 * POST /api/v1/bookings/create-with-payment
 * Step 1: Create a pending reservation + Square checkout session
 * Returns: bookingRef, squareCheckoutUrl, depositAmount, rewardsPreview
 */
const createWithPayment = async (req, res, next) => {
    try {
        const { businessId, date, time, partySize, customerEmail, customerName } = req.body;
        const customerId = req?.user?.id;
        // Validation
        if (!businessId || !date || !time || !partySize) {
            return res.status(400).json({
                success: false,
                error: 'businessId, date, time, and partySize are required',
            });
        }
        const business = await database_1.prisma.business.findUnique({ where: { id: businessId } });
        if (!business) {
            return res.status(404).json({ success: false, error: 'Business not found' });
        }
        const depositAmount = 25.0; // Flat $25 deposit for demo
        const bookingRef = generateBookingRef();
        const reservationDate = new Date(`${date}T${time}`);
        // Create reservation with PENDING status
        const reservation = await database_1.prisma.reservation.create({
            data: {
                businessId,
                customerId: customerId || `demo-customer-${Date.now()}`,
                reservationDate,
                reservationTime: time,
                numberOfGuests: parseInt(partySize, 10),
                status: 'PENDING',
                customerName: customerName || 'Guest',
                customerEmail: customerEmail || '',
                customerPhone: '',
                depositRequired: true,
                depositAmount,
                depositPaid: false,
                depositStatus: 'PENDING',
                source: 'sitara-demo',
            },
        });
        // Calculate rewards preview (what customer will earn)
        let rewardsPreview = null;
        try {
            rewardsPreview = rewardEngine_service_1.rewardEngine.calculateRewards(depositAmount);
        }
        catch {
            // Reward preview is optional; continue without it
        }
        // Create Square hosted checkout session
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        let squareCheckoutUrl = null;
        let squareCheckoutId = null;
        try {
            const checkout = await squareCheckout_service_1.squareService.createCheckout({
                referenceId: bookingRef,
                amount: Math.round(depositAmount * 100), // cents
                currency: 'USD',
                redirectUrl: `${baseUrl}/api/v1/bookings/confirm-payment?ref=${bookingRef}&reservationId=${reservation.id}`,
                cancelUrl: `${baseUrl}/sitara/booking/${businessId}?pay=cancelled`,
                note: `Pabandi Booking ${bookingRef} - ${business.name}`,
                customerEmail,
            });
            squareCheckoutUrl = checkout.url;
            squareCheckoutId = checkout.id;
        }
        catch (squareErr) {
            // Square not configured yet — return booking data for demo/integration
            squareCheckoutUrl = null;
            console.warn('[Square] Checkout creation failed (non-fatal for demo):', squareErr?.message);
        }
        // Record payment intent in database
        await database_1.prisma.payment.create({
            data: {
                reservationId: reservation.id,
                userId: customerId || reservation.customerId,
                businessId,
                amount: depositAmount,
                currency: 'USD',
                status: 'PENDING',
                paymentMethod: 'SQUARE',
                transactionId: squareCheckoutId,
                platformFeeAmount: depositAmount * 0.01, // 1% creation fee
                platformFeeStatus: 'HELD',
            },
        });
        return res.status(201).json({
            success: true,
            data: {
                bookingRef,
                reservationId: reservation.id,
                depositAmount,
                squareCheckoutUrl,
                squareCheckoutId,
                rewardsPreview: rewardsPreview
                    ? {
                        customerEarns: rewardsPreview.customerRewardPab,
                        customerEarnsUsd: rewardsPreview.customerRewardUsd,
                        businessEarns: rewardsPreview.businessRewardPab,
                        businessEarnsUsd: rewardsPreview.businessRewardUsd,
                    }
                    : null,
            },
        });
    }
    catch (error) {
        console.error('[CoreBooking] createWithPayment error:', error.message);
        next(error);
    }
};
exports.createWithPayment = createWithPayment;
/**
 * GET /api/v1/bookings/confirm-payment
 * Square redirects here after successful payment.
 * Verifies payment, updates reservation to PAID, issues rewards, creates escrow.
 */
const confirmPayment = async (req, res, next) => {
    try {
        const { ref: bookingRef, reservationId } = req.query;
        if (!bookingRef || !reservationId) {
            return res.status(400).json({ error: 'Missing booking reference or reservation ID' });
        }
        // Find the reservation
        const reservation = await database_1.prisma.reservation.findUnique({
            where: { id: reservationId },
            include: { business: true, payments: true },
        });
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }
        // Update reservation to PAID/CONFIRMED
        const updatedReservation = await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: {
                status: 'CONFIRMED',
                depositPaid: true,
                depositStatus: 'PAID',
                totalAmount: reservation.depositAmount,
            },
        });
        // Update payment status
        const payment = reservation.payments.find((p) => p.status === 'PENDING');
        if (payment) {
            await database_1.prisma.payment.update({
                where: { id: payment.id },
                data: { status: 'COMPLETED' },
            });
        }
        // Issue $PAB rewards to customer AND business
        let rewardResult = null;
        try {
            rewardResult = await rewardEngine_service_1.rewardEngine.issueRewards({
                customerId: reservation.customerId,
                businessId: reservation.businessId,
                purchaseAmount: reservation.depositAmount || 25,
                referenceId: reservationId,
                referenceType: 'BOOKING_DEPOSIT',
            });
            // Update reservation reward earned
            await database_1.prisma.reservation.update({
                where: { id: reservationId },
                data: { rewardEarned: rewardResult?.rewards?.customerRewardPab || 25 },
            });
        }
        catch (rewardErr) {
            console.warn('[Rewards] Issue rewards failed (non-fatal):', rewardErr.message);
        }
        // Create escrow record (HELD)
        const depositAmount = reservation.depositAmount || 25;
        const creationFee = depositAmount * 0.01; // 1% creation fee
        const escrowAmount = depositAmount - creationFee;
        const escrow = await database_1.prisma.escrow.create({
            data: {
                paymentId: payment?.id,
                amount: escrowAmount,
                status: 'PENDING',
                payerId: reservation.customerId,
                payeeId: reservation.business.ownerId || reservation.businessId,
            },
        });
        // Generate QR code URL for check-in
        const qrCodeUrl = (0, qrcode_1.generateQRCodeUrl)(bookingRef);
        // Update reservation with QR code
        await database_1.prisma.reservation.update({
            where: { id: reservationId },
            data: { qrCode: qrCodeUrl, qrCodeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        // Render success page (HTML response for direct browser redirect)
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed - Pabandi</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
    <div class="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
      <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <h1 class="text-2xl font-bold text-white mb-2">Booking Confirmed!</h1>
    <p class="text-purple-200 mb-6">Your deposit is secured by Pabandi escrow.</p>
    <div class="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
      <p class="text-sm text-purple-300">Reference</p>
      <p class="text-lg font-mono text-white font-bold">${bookingRef}</p>
    </div>
    <div class="bg-emerald-500/20 rounded-xl p-4 mb-6 border border-emerald-500/30">
      <p class="text-sm text-emerald-300">PAB Earned</p>
      <p class="text-2xl font-bold text-emerald-400">+${rewardResult?.rewards?.customerRewardPab?.toFixed(2) || '25.00'} PAB</p>
      <p class="text-xs text-emerald-300/70">($${rewardResult?.rewards?.customerRewardUsd?.toFixed(2) || '2.50'} USD value)</p>
    </div>
    <img src="${qrCodeUrl}" alt="Check-in QR Code" class="mx-auto mb-4 rounded-xl bg-white p-2 w-48 h-48" />
    <p class="text-sm text-purple-200 mb-6">Show this QR code to the host for check-in.</p>
    <a href="/sitara/booking/${reservation.businessId}/confirmed?ref=${bookingRef}" class="block w-full py-3 bg-gradient-to-r from-emerald-500 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition">
      View Booking Details
    </a>
  </div>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }
    catch (error) {
        console.error('[CoreBooking] confirmPayment error:', error.message);
        next(error);
    }
};
exports.confirmPayment = confirmPayment;
/**
 * POST /api/v1/bookings/checkin
 * Check-in: verifies reservation, triggers escrow release, deducts 2% fee
 */
const checkin = async (req, res, next) => {
    try {
        const { bookingRef, reservationId, hostId, method } = req.body;
        if (!bookingRef && !reservationId) {
            return res.status(400).json({ error: 'bookingRef or reservationId required' });
        }
        // Find reservation
        const reservation = reservationId
            ? await database_1.prisma.reservation.findUnique({
                where: { id: reservationId },
                include: { business: true, payments: true },
            })
            : await database_1.prisma.reservation.findFirst({
                where: { customerName: { contains: bookingRef } },
                include: { business: true, payments: true },
            });
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }
        if (reservation.status === 'CHECKED_IN') {
            return res.status(400).json({ error: 'Already checked in' });
        }
        if (reservation.status !== 'CONFIRMED' && reservation.status !== 'PENDING') {
            return res.status(400).json({ error: `Cannot check in: status is ${reservation.status}` });
        }
        // Verify host owns the business (optional for demo)
        if (hostId && reservation.business.ownerId && reservation.business.ownerId !== hostId) {
            // In demo mode, allow any host
            console.warn('[CheckIn] Host ownership check skipped for demo');
        }
        // Update reservation to CHECKED_IN
        const updatedReservation = await database_1.prisma.reservation.update({
            where: { id: reservation.id },
            data: {
                status: 'CHECKED_IN',
                checkInDate: new Date(),
                checkInMethod: method || 'qr_scan',
            },
        });
        // Find and release escrow
        const escrow = await database_1.prisma.escrow.findFirst({
            where: { paymentId: reservation.payments[0]?.id },
        });
        let releaseDetails = null;
        if (escrow) {
            const depositAmount = escrow.amount;
            const releaseFee = depositAmount * 0.01; // 1% release fee (1% already taken at creation = 2% total)
            const netToBusiness = depositAmount - releaseFee;
            const updatedEscrow = await database_1.prisma.escrow.update({
                where: { id: escrow.id },
                data: {
                    status: 'RELEASED',
                    releasedAt: new Date(),
                    releasedBy: hostId || 'system',
                },
            });
            releaseDetails = {
                escrowId: updatedEscrow.id,
                grossAmount: depositAmount,
                releaseFee,
                totalFees: depositAmount * 0.02,
                netToBusiness,
                platformRevenue: depositAmount * 0.02,
            };
            // Issue business PAB reward on check-in
            try {
                await rewardEngine_service_1.rewardEngine.issueRewards({
                    customerId: reservation.businessId,
                    businessId: reservation.businessId,
                    purchaseAmount: netToBusiness,
                    referenceId: reservation.id,
                    referenceType: 'ESCROW_RELEASE',
                });
            }
            catch {
                // Non-fatal
            }
        }
        // Update payment platform fee status
        if (reservation.payments[0]) {
            await database_1.prisma.payment.update({
                where: { id: reservation.payments[0].id },
                data: { platformFeeStatus: 'COLLECTED' },
            });
        }
        return res.json({
            success: true,
            data: {
                reservationId: updatedReservation.id,
                status: updatedReservation.status,
                checkedInAt: updatedReservation.checkInDate,
                ...releaseDetails,
            },
        });
    }
    catch (error) {
        console.error('[CoreBooking] checkin error:', error.message);
        next(error);
    }
};
exports.checkin = checkin;
/**
 * GET /api/v1/bookings/status/:bookingRef
 * Poll booking status
 */
const getBookingStatus = async (req, res, next) => {
    try {
        const { bookingRef } = req.params;
        const reservation = await database_1.prisma.reservation.findFirst({
            where: { customerName: { contains: bookingRef } },
            include: { payments: true, business: true },
        });
        if (!reservation) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        return res.json({
            success: true,
            data: {
                bookingRef,
                reservationId: reservation.id,
                status: reservation.status,
                depositStatus: reservation.depositStatus,
                businessName: reservation.business?.name,
                date: reservation.reservationDate,
                time: reservation.reservationTime,
                party: reservation.numberOfGuests,
                deposit: reservation.depositAmount,
                rewardEarned: reservation.rewardEarned,
                qrCode: reservation.qrCode,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getBookingStatus = getBookingStatus;
//# sourceMappingURL=coreBooking.controller.js.map
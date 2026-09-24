"use strict";
// Pabandi End-to-End Payment Flow Test
// Tests: create reservation → PayLio payment → escrow → check-in → release
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../utils/database");
const booking_service_1 = require("../services/booking.service");
const checkin_service_1 = require("../services/checkin.service");
async function runTest() {
    console.log('=== Pabandi Payment Flow Test ===\n');
    // 1. Find or create a test business
    let business = await database_1.prisma.business.findFirst({ where: { isActive: true } });
    if (!business) {
        console.log('Creating test business...');
        const owner = await database_1.prisma.user.findFirst();
        if (!owner) {
            console.error('No users found. Create a user first.');
            process.exit(1);
        }
        business = await database_1.prisma.business.create({
            data: {
                name: 'Test Restaurant',
                address: '123 Test St',
                phone: '+1 555-0100',
                email: 'test@pabandi.com',
                category: 'RESTAURANT',
                isActive: true,
                isClaimed: true,
                ownerId: owner.id,
                latitude: 40.7128,
                longitude: -74.0060,
                city: 'New York',
                timezone: 'America/New_York',
            },
        });
        await database_1.prisma.businessSettings.create({ data: { businessId: business.id } });
    }
    console.log(`✓ Business: ${business.name} (${business.id})`);
    // 2. Find or create a test customer
    let customer = await database_1.prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    if (!customer) {
        customer = await database_1.prisma.user.create({
            data: {
                email: `test-customer-${Date.now()}@pabandi.com`,
                passwordHash: 'hashed',
                firstName: 'Test',
                lastName: 'Customer',
                role: 'CUSTOMER',
            },
        });
    }
    console.log(`✓ Customer: ${customer.email} (${customer.id})`);
    // 3. Create booking with deposit
    console.log('\n--- Step 1: Create Booking ---');
    const bookingResult = await (0, booking_service_1.createBookingWithDeposit)({
        businessId: business.id,
        customerId: customer.id,
        customerName: 'Test Customer',
        customerEmail: customer.email,
        customerPhone: '+1 555-0101',
        reservationDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        reservationTime: '19:00',
        numberOfGuests: 4,
        depositAmount: 25,
        specialRequests: 'Window seat',
    });
    console.log(`  Booking Reference: ${bookingResult.bookingReference}`);
    console.log(`  Reservation ID: ${bookingResult.reservationId}`);
    console.log(`  Deposit: $${bookingResult.depositAmount}`);
    console.log(`  Payment URL: ${bookingResult.paymentUrl || '(none — API key missing)'}`);
    console.log(`  Message: ${bookingResult.message}`);
    if (!bookingResult.success || !bookingResult.reservationId) {
        console.error('✗ Booking creation failed');
        process.exit(1);
    }
    console.log('✓ Booking created');
    // 4. Simulate payment confirmation
    console.log('\n--- Step 2: Confirm Payment & Create Escrow ---');
    const confirmResult = await (0, booking_service_1.confirmPaymentAndCreateEscrow)(bookingResult.bookingReference);
    console.log(`  Escrow ID: ${confirmResult.escrowId || 'N/A'}`);
    console.log(`  Message: ${confirmResult.message}`);
    if (!confirmResult.success || !confirmResult.escrowId) {
        console.error('✗ Payment confirmation failed');
        process.exit(1);
    }
    console.log('✓ Escrow created (HELD)');
    // Verify reservation
    const reservation = await database_1.prisma.reservation.findUnique({ where: { id: bookingResult.reservationId } });
    console.log(`  Reservation status: ${reservation?.status}`);
    console.log(`  Deposit status: ${reservation?.depositStatus}`);
    // 5. Check-in
    console.log('\n--- Step 3: Check-In ---');
    const qrResult = await checkin_service_1.checkInService.generateCheckInToken(bookingResult.reservationId);
    if (qrResult.success) {
        console.log(`  QR Code generated: ${qrResult.code}`);
    }
    const checkInResult = await checkin_service_1.checkInService.verifyCheckIn({
        code: qrResult.code || 'MANUAL',
        reservationId: bookingResult.reservationId,
        lat: 40.7128,
        lng: -74.0060,
        method: 'manual',
    });
    console.log(`  Check-in: ${checkInResult.message}`);
    console.log(`  Location verified: ${checkInResult.locationVerified || false}`);
    if (!checkInResult.success) {
        console.error('✗ Check-in failed');
        process.exit(1);
    }
    console.log('✓ Checked in');
    // 6. Release escrow
    console.log('\n--- Step 4: Release Escrow to Business ---');
    const releaseResult = await (0, booking_service_1.releaseEscrowToBusiness)(confirmResult.escrowId, customer.id);
    console.log(`  Released amount: $${releaseResult.releasedAmount}`);
    console.log(`  Release fee: $${releaseResult.releaseFee}`);
    console.log(`  Net to business: $${releaseResult.netToBusiness}`);
    console.log(`  Message: ${releaseResult.message}`);
    if (!releaseResult.success) {
        console.error('✗ Escrow release failed');
        process.exit(1);
    }
    console.log('✓ Escrow released to business');
    // 7. Final state
    console.log('\n--- Final State ---');
    const finalReservation = await database_1.prisma.reservation.findUnique({ where: { id: bookingResult.reservationId } });
    console.log(`  Reservation status: ${finalReservation?.status}`);
    console.log(`  Deposit status: ${finalReservation?.depositStatus}`);
    const escrow = await database_1.prisma.escrow.findUnique({ where: { id: confirmResult.escrowId } });
    console.log(`  Escrow status: ${escrow?.status}`);
    const wallet = await database_1.prisma.wallet.findUnique({ where: { userId: business.ownerId ?? '' } });
    console.log(`  Business wallet balance: $${wallet?.usdcBalance || 0}`);
    // Fee summary
    const deposit = bookingResult.depositAmount;
    const creationFee = deposit * 0.01;
    const releaseFee = (deposit - creationFee) * 0.01;
    const totalFees = creationFee + releaseFee;
    console.log(`\n--- Fee Summary ---`);
    console.log(`  Customer paid: $${deposit}`);
    console.log(`  Creation fee (1%): $${creationFee.toFixed(2)}`);
    console.log(`  Release fee (1%): $${releaseFee.toFixed(2)}`);
    console.log(`  Total fees: $${totalFees.toFixed(2)}`);
    console.log(`  Business received: $${(deposit - totalFees).toFixed(2)}`);
    console.log('\n=== All steps passed! ===');
}
runTest()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
//# sourceMappingURL=testPaymentFlow.js.map
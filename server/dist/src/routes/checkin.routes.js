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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const auth_middleware_1 = require("../middleware/auth.middleware");
const trust_core_1 = require("../trust/trust-core");
const geo_service_1 = require("../services/geo.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// ── POST /api/v1/checkin/job/:jobId ──
// Check in to a job with geofenced verification
router.post('/job/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { lat, lng, overrideReason } = req.body;
        if (!lat || !lng) {
            return res.status(400).json({ success: false, error: 'lat and lng required' });
        }
        const job = await database_1.prisma.crmJob.findUnique({
            where: { id: jobId },
            include: { business: true, client: true, booking: true },
        });
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        if (job.status !== 'SCHEDULED' && job.status !== 'IN_PROGRESS') {
            return res.status(400).json({ success: false, error: 'Job not in check-in state' });
        }
        // Get job location (from booking or job address)
        const jobLat = job.booking?.clientLat;
        const jobLng = job.booking?.clientLng;
        if (!jobLat || !jobLng) {
            return res.status(400).json({ success: false, error: 'Job location not set' });
        }
        // Check if within geofence (0.1 miles = ~160 meters)
        const GEOFENCE_RADIUS_MILES = 0.1;
        const distanceCheck = await geo_service_1.geoService.isWithinRadius(jobLat, jobLng, lat, lng, GEOFENCE_RADIUS_MILES);
        const checkinData = {
            checkinLat: lat,
            checkinLng: lng,
            checkinDistanceM: distanceCheck.distanceMeters,
            locationVerified: distanceCheck.withinRadius,
            checkedInAt: new Date(),
            status: 'IN_PROGRESS',
        };
        // If outside radius and no override, reject
        if (!distanceCheck.withinRadius && !overrideReason) {
            return res.status(403).json({
                success: false,
                error: 'LOCATION_MISMATCH',
                message: `You appear to be ${distanceCheck.distanceMiles.toFixed(2)} miles from the job location. Are you sure you're at the right place?`,
                distanceMiles: distanceCheck.distanceMiles,
                distanceMeters: distanceCheck.distanceMeters,
                allowOverride: true,
            });
        }
        // Allow check-in
        await database_1.prisma.crmJob.update({
            where: { id: jobId },
            data: {
                ...checkinData,
                status: 'IN_PROGRESS',
            },
        });
        // Fire trust events
        if (distanceCheck.withinRadius) {
            await trust_core_1.trustCore.emit('delivery.verified_location', {
                jobId,
                businessId: job.businessId,
                clientId: job.clientId,
                distanceMeters: distanceCheck.distanceMeters,
                bonusPab: 5,
            });
            // Award PAB bonus for verified location
            await awardPabReward(job.clientId, jobId, true, distanceCheck.distanceMeters);
        }
        else {
            await trust_core_1.trustCore.emit('delivery.location_mismatch', {
                jobId,
                businessId: job.businessId,
                clientId: job.clientId,
                distanceMeters: distanceCheck.distanceMeters,
                overrideReason,
            });
        }
        res.json({
            success: true,
            data: {
                ...checkinData,
                locationVerified: distanceCheck.withinRadius,
                bonusPab: distanceCheck.withinRadius ? 5 : 0,
            },
        });
    }
    catch (e) {
        console.error('Check-in error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/checkin/job/:jobId/checkout ──
// Check out from a job
router.post('/job/:jobId/checkout', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { lat, lng, notes } = req.body;
        const job = await database_1.prisma.crmJob.findUnique({
            where: { id: jobId },
            include: { business: true, client: true, booking: true },
        });
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        if (job.status !== 'IN_PROGRESS') {
            return res.status(400).json({ success: false, error: 'Job not in progress' });
        }
        const checkoutData = {
            checkedOutAt: new Date(),
            status: 'COMPLETED',
            completedAt: new Date(),
        };
        if (lat && lng) {
            checkoutData['checkinLat'] = lat;
            checkoutData['checkinLng'] = lng;
        }
        await database_1.prisma.crmJob.update({
            where: { id: jobId },
            data: checkoutData,
        });
        // Fire trust event: booking.attended
        if (job.booking?.id) {
            await trust_core_1.trustCore.emit('booking.attended', {
                bookingId: job.booking.id,
                businessId: job.businessId,
                clientId: job.clientId,
            });
            // Award PAB for on-time completion
            if (job.booking.client?.passportId) {
                const scheduled = new Date(job.scheduledDate);
                const now = new Date();
                const diffMinutes = (now.getTime() - scheduled.getTime()) / 60000;
                const onTimeBonus = diffMinutes <= 15 ? 3 : 0;
                if (onTimeBonus > 0) {
                    await awardPabReward(job.clientId, job.booking.id, false, 0, onTimeBonus);
                }
            }
        }
        res.json({ success: true, message: 'Checked out successfully' });
    }
    catch (e) {
        console.error('Check-out error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// Helper function to award PAB rewards
async function awardPabReward(clientId, jobId, locationVerified, distanceMeters = 0, onTimeBonus = 0) {
    try {
        const baseReward = 10;
        const locationBonus = locationVerified ? 5 : 0;
        const totalReward = baseReward + locationBonus + onTimeBonus;
        const client = await database_1.prisma.user.findUnique({
            where: { id: clientId },
            select: { pabBalance: true },
        });
        if (!client)
            return;
        await database_1.prisma.user.update({
            where: { id: clientId },
            data: { pabBalance: { increment: totalReward } },
        });
        // Create reward record
        await database_1.prisma.pabReward.create({
            data: {
                userId: clientId,
                jobId,
                amount: totalReward,
                type: 'CHECKIN_REWARD',
                metadata: {
                    baseReward,
                    locationVerified,
                    locationBonus,
                    onTimeBonus,
                    distanceMeters,
                },
            },
        });
        // Create location attestation if verified
        if (locationVerified && distanceMeters > 0) {
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const geoHash = crypto.createHash('sha256')
                .update(`${jobId}${distanceMeters}${Date.now()}`)
                .digest('hex');
            await database_1.prisma.locationAttestation.create({
                data: {
                    passportId: clientId,
                    jobId,
                    geoHash,
                    lat: 0, // Will be filled from job
                    lng: 0,
                    distanceMeters,
                    verified: true,
                },
            });
            // Increment verified location count on passport
            await database_1.prisma.trustPassport.updateMany({
                where: { userId: clientId },
                data: { verifiedLocationCount: { increment: 1 } },
            });
        }
        // Fire trust event for PAB reward
        await trust_core_1.trustCore.emit('pab.rewarded', {
            userId: clientId,
            amount: totalReward,
            breakdown: { baseReward, locationBonus: locationVerified ? 5 : 0, onTimeBonus },
        });
    }
    catch (e) {
        console.error('PAB reward error:', e);
    }
}
// ── GET /api/v1/checkin/job/:jobId/map ──
// Get static map for job check-in
router.get('/job/:jobId/map', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await database_1.prisma.crmJob.findUnique({
            where: { id: jobId },
            include: { booking: true, business: true },
        });
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        const jobLat = job.booking?.clientLat;
        const jobLng = job.booking?.clientLng;
        if (!jobLat || !jobLng) {
            return res.status(400).json({ success: false, error: 'Job location not set' });
        }
        const mapUrl = await geo_service_1.geoService.getStaticMapUrl({
            center: { lat: jobLat, lng: jobLng },
            zoom: 15,
            width: 400,
            height: 300,
            markers: [
                { lat: jobLat, lng: jobLng, color: 'C97B5B', icon: 'work' },
            ],
        });
        res.json({
            success: true,
            data: {
                mapUrl,
                lat: jobLat,
                lng: jobLng,
                distance: job.booking?.distanceMiles,
                driveMinutes: job.booking?.driveMinutes,
            },
        });
    }
    catch (e) {
        console.error('Check-in map error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=checkin.routes.js.map
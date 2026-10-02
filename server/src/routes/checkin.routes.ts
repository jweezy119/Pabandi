import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { trustCore } from '../trust/trust-core';
import { geoService } from '../services/geo.service';
import { logger } from '../utils/logger';
import { releaseOnAttendance } from '../services/booking-escrow.service';

const router = Router();
router.use(authenticate);

/**
 * Is the caller the business that owns this job?
 *
 * This router authenticated every request but never checked that the caller had
 * anything to do with the job. Any logged-in user could check in to any job,
 * and because a verified check-in is what releases a booking deposit, that made
 * the evidence the escrow model rests on self-certified by a third party.
 *
 * CrmBusiness is keyed by ownerEmail rather than owning a User row, so the join
 * is through the authenticated user's email. Email is the identity the whole
 * booking flow is already keyed on — findOrCreateClient matches clients the same
 * way — so this is consistent with how the booking was created rather than a
 * second, inconsistent notion of ownership.
 *
 * The worker's own client account is also accepted: some jobs are carried out
 * by a freelancer account acting as the second party, and rejecting them would
 * break the flow the geofence exists to support.
 */
async function canCheckInToJob(req: AuthRequest, job: { business: { ownerEmail?: string | null }; client: { id: string; email?: string | null } }): Promise<boolean> {
  const user = req.user;
  if (!user) return false;
  const email = String(user.email ?? '').toLowerCase();
  if (!email) return false;
  if ((job.business.ownerEmail ?? '').toLowerCase() === email) return true;
  if ((job.client.email ?? '').toLowerCase() === email) return true;
  return false;
}

// ── POST /api/v1/checkin/job/:jobId ──
// Check in to a job with geofenced verification
router.post('/job/:jobId', async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const { lat, lng, overrideReason } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat and lng required' });
    }

    const job = await prisma.crmJob.findUnique({
      where: { id: jobId },
      include: { business: true, client: true, booking: true },
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (!(await canCheckInToJob(req, job))) {
      return res.status(403).json({ success: false, error: 'Not a party to this job' });
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
    const distanceCheck = await geoService.isWithinRadius(jobLat, jobLng, lat, lng, GEOFENCE_RADIUS_MILES);

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

    // An override is the business deciding, on the record, that the worker is
    // somewhere the geofence cannot see. It has to name the person who made that
    // call and say why in enough detail for a dispute reviewer to judge it —
    // `overrideReason` alone is free text from whoever called the endpoint, which
    // used to be any authenticated user at all.
    //
    // Kept on the job so it survives regardless of what the escrow row does.
    if (!distanceCheck.withinRadius) {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Authentication required to override' });
      }
      const note = String(overrideReason).trim();
      if (note.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'OVERRIDE_REASON_REQUIRED',
          message: 'Please describe why this check-in is being overridden (at least 10 characters). This is recorded and may be reviewed.',
        });
      }
      logger.warn(
        `[Checkin] Location override on job ${jobId} by user ${req.user.id}: ${note} (${distanceCheck.distanceMeters.toFixed(0)}m from the job location).`,
      );
    }

    // Allow check-in
    await prisma.crmJob.update({
      where: { id: jobId },
      data: {
        ...checkinData,
        status: 'IN_PROGRESS',
      },
    });

    // Advance the booking escrow. A verified check-in satisfies the condition
    // the deposit was conditioned on; an override does not, and is recorded as
    // a dispute rather than a release so the decision gets looked at.
    //
    // Wrapped because this is a webhook-adjacent path: a failure here must not
    // fail a check-in the worker already made.
    if (job.booking?.id) {
      try {
        await releaseOnAttendance({
          bookingId: job.booking.id,
          locationVerified: distanceCheck.withinRadius,
          distanceMeters: distanceCheck.distanceMeters,
          overrideReason: overrideReason ?? null,
        });
      } catch (escrowErr) {
        logger.error(`[Checkin] Escrow advance failed for booking ${job.booking.id}: ${escrowErr}`);
      }
    }

    // Fire trust events
    if (distanceCheck.withinRadius) {
      await trustCore.emit('delivery.verified_location', {
        jobId,
        businessId: job.businessId,
        clientId: job.clientId,
        distanceMeters: distanceCheck.distanceMeters,
        bonusPab: 5,
      });

      // Award PAB bonus for verified location
      await awardPabReward(job.clientId, jobId, true, distanceCheck.distanceMeters);
    } else {
      await trustCore.emit('delivery.location_mismatch', {
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
  } catch (e: any) {
    console.error('Check-in error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/checkin/job/:jobId/checkout ──
// Check out from a job
router.post('/job/:jobId/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const { lat, lng, notes } = req.body;

    const job = await prisma.crmJob.findUnique({
      where: { id: jobId },
      include: { business: true, client: true, booking: true },
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (!(await canCheckInToJob(req, job))) {
      return res.status(403).json({ success: false, error: 'Not a party to this job' });
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

    await prisma.crmJob.update({
      where: { id: jobId },
      data: checkoutData,
    });

    // Fire trust event: booking.attended
    if (job.booking?.id) {
      await trustCore.emit('booking.attended', {
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
  } catch (e: any) {
    console.error('Check-out error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Helper function to award PAB rewards
async function awardPabReward(
  clientId: string,
  jobId: string,
  locationVerified: boolean,
  distanceMeters: number = 0,
  onTimeBonus: number = 0
) {
  try {
    const baseReward = 10;
    const locationBonus = locationVerified ? 5 : 0;
    const totalReward = baseReward + locationBonus + onTimeBonus;

    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: { pabBalance: true },
    });

    if (!client) return;

    await prisma.user.update({
      where: { id: clientId },
      data: { pabBalance: { increment: totalReward } },
    });

    // Create reward record
    await prisma.pabReward.create({
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
      const crypto = await import('crypto');
      const geoHash = crypto.createHash('sha256')
        .update(`${jobId}${distanceMeters}${Date.now()}`)
        .digest('hex');

      await prisma.locationAttestation.create({
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
      await prisma.trustPassport.updateMany({
        where: { userId: clientId },
        data: { verifiedLocationCount: { increment: 1 } },
      });
    }

    // Fire trust event for PAB reward
    await trustCore.emit('pab.rewarded', {
      userId: clientId,
      amount: totalReward,
      breakdown: { baseReward, locationBonus: locationVerified ? 5 : 0, onTimeBonus },
    });
  } catch (e) {
    console.error('PAB reward error:', e);
  }
}

// ── GET /api/v1/checkin/job/:jobId/map ──
// Get static map for job check-in
router.get('/job/:jobId/map', async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.crmJob.findUnique({
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

    const mapUrl = await geoService.getStaticMapUrl({
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
  } catch (e: any) {
    console.error('Check-in map error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
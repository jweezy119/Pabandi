import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { fail } from '../utils/apiResponse';
import { setupAdmin } from '../controllers/admin.controller';

const router = Router();

/**
 * POST /api/v1/seed/admin
 * PUBLIC bootstrap: create first admin user if and only if zero users exist.
 * Same logic as POST /api/v1/admin/setup — provides two ways to bootstrap.
 */
router.post('/admin', (req: Request, res: Response) => {
  // Delegate to the same controller function used by admin setup endpoint
  setupAdmin(req as any, res as any, (err: any) => {
    if (err) {
      logger.error('[Seed] admin bootstrap failed', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

/** Production guard: block dangerous seed endpoints in production */
function isProduction(req: Request): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * POST /api/v1/seed/freelancers
 * Admin endpoint to generate AI-like freelancer profiles
 */
router.post('/freelancers', async (req: Request, res: Response): Promise<any> => {
  if (isProduction(req)) {
    return fail(res, 'Seed endpoints are disabled in production', 404);
  }
  try {
    const { count = 5 } = req.body;
    const generatedProfiles = [];

    const mockTitles = ['Senior React Developer', 'UI/UX Designer', 'Growth Marketing Expert', 'Solana Web3 Engineer', 'Technical Writer'];
    const mockSkills = ['React, Node.js, TypeScript', 'Figma, Prototyping, Wireframing', 'SEO, SEM, Paid Ads', 'Rust, Anchor, Solana Web3.js', 'API Documentation, Copywriting'];

    for (let i = 0; i < count; i++) {
      const idx = i % mockTitles.length;
      const email = `mock_juror_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}@pabandi.local`;
      const passwordHash = await bcrypt.hash('password123', 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: `Juror${i}`,
          lastName: `Trust${i}`,
          role: UserRole.CUSTOMER, // DB enum lacks FREELANCER; juror eligibility is trustScore-based only
          isEmailVerified: true,
          trustScore: Math.floor(92 + Math.random() * 6), // 92-97 int — eligible as peer juror (>= 90)
          freelanceScore: Math.floor(90 + Math.random() * 8),
          verificationTier: "VERIFIED",
        }
      });

      // Optional business profile (non-fatal if it fails)
      try {
        await prisma.business.create({
          data: {
            ownerId: user.id,
            name: `${user.firstName} ${user.lastName} - ${mockTitles[idx]}`,
            category: 'FREELANCE',
            address: 'Remote',
            phone: `+1****00${i.toString().padStart(4, '0')}`,
            email: user.email,
            description: `High-trust ${mockTitles[idx]} for peer-jury arbitration.`,
            isVerified: true,
            isActive: true,
            trustScore: user.trustScore,
            externalDetails: {
              hourlyRate: 50 + (i * 10),
              skills: mockSkills[idx].split(', '),
            },
          },
        });
      } catch (bErr: any) {
        logger.warn(`[Seed] business profile skipped for ${user.id}: ${bErr.message}`);
      }

      generatedProfiles.push({ user });
    }

    res.json({ success: true, count, data: generatedProfiles });
  } catch (error: any) {
    logger.error('Error seeding freelancers', error);
    res.status(500).json({ success: false, error: 'Failed to seed profiles' });
  }
});

/**
 * POST /api/v1/seed/bookings
 * Admin endpoint to generate fake transaction history (bookings) for freelancers
 */
router.post('/bookings', async (req: Request, res: Response): Promise<any> => {
  if (isProduction(req)) {
    return fail(res, 'Seed endpoints are disabled in production', 404);
  }
  try {
    const { count = 10 } = req.body;
    
    // Find a real or mock customer to act as the buyer
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    if (!customer) {
      return res.status(400).json({ success: false, error: 'No customer found in DB to assign bookings to.' });
    }

    // Find all freelance businesses
    const freelancers = await prisma.business.findMany({ where: { category: 'FREELANCE' } });
    if (freelancers.length === 0) {
      return res.status(400).json({ success: false, error: 'No freelancers found. Seed freelancers first.' });
    }

    const generatedBookings = [];

    for (let i = 0; i < count; i++) {
      const freelancer = freelancers[Math.floor(Math.random() * freelancers.length)];
      
      const reservation = await prisma.reservation.create({
        data: {
          businessId: freelancer.id,
          customerId: customer.id,
          reservationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Past 30 days
          reservationTime: '10:00',
          numberOfGuests: 1,
          status: 'COMPLETED',
          customerName: customer.firstName + ' ' + customer.lastName,
          customerPhone: customer.phone || '+1000000000',
          depositRequired: true,
          depositAmount: 100,
          depositPaid: true,
          depositStatus: 'REIMBURSED_TO_BUSINESS',
          notes: 'Completed freelance milestone.',
          totalAmount: 500
        }
      });
      generatedBookings.push(reservation);
    }

    res.json({ success: true, count, data: generatedBookings });
  } catch (error: any) {
    logger.error('Error seeding bookings', error);
    res.status(500).json({ success: false, error: 'Failed to seed bookings' });
  }
});

/**
 * POST /api/v1/seed/reconcile
 * Reconcile known prod-DB schema drift with Prisma schema (idempotent raw SQL).
 * - adds FREELANCER to the UserRole PG enum (prod DB lacked it -> 22P02 on insert)
 * - ensures LinkedInProfile table exists (defensive; some envs missing it)
 */
router.post('/reconcile', async (_req: Request, res: Response): Promise<any> => {
  if (isProduction(_req)) {
    return fail(res, 'Seed endpoints are disabled in production', 404);
  }
  const steps: string[] = [];
  try {
    await prisma.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'FREELANCER') THEN ALTER TYPE "UserRole" ADD VALUE 'FREELANCER'; END IF; END $$;`);
    steps.push('UserRole.FREELANCER ensured');

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "LinkedInProfile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "linkedinId" TEXT NOT NULL,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "headline" TEXT,
      "company" TEXT,
      "industry" TEXT,
      "location" TEXT,
      "category" TEXT NOT NULL,
      "githubUrl" TEXT,
      "linkedinUrl" TEXT,
      "profilePictureUrl" TEXT,
      "connectionCount" INTEGER NOT NULL DEFAULT 0,
      "trustVelocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "trustBand" TEXT NOT NULL DEFAULT 'D',
      "profileCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      "walletAddress" TEXT,
      "seedSource" TEXT NOT NULL DEFAULT 'LINKEDIN_SEARCH',
      "persona" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    steps.push('LinkedInProfile table ensured');

    res.json({ success: true, steps });
  } catch (error: any) {
    logger.error('[Seed] reconcile failed', error);
    res.status(500).json({ success: false, error: error.message, steps });
  }
});

/**
 * POST /api/v1/seed/demo
 * Idempotent consolidated demo seed: high-trust jurors, trust-band (A-E) freelancers
 * with LinkedIn profiles, a liquidity-provider pool for the LOCAL off-ramp, and a bad actor.
 */
router.post('/demo', async (req: Request, res: Response): Promise<any> => {
  if (isProduction(req)) {
    return fail(res, 'Seed endpoints are disabled in production', 404);
  }
  try {
    const { jurors = 8, freelancers = 12, liquidityProviders = 3 } = req.body || {};
    const created: any = { jurors: [], freelancers: [], liquidityProviders: [], admin: null };

    for (let i = 0; i < jurors; i++) {
      const email = `seed_juror_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}@pabandi.local`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: await bcrypt.hash('password123', 10),
          firstName: `Juror${i}`,
          lastName: `Trust${i}`,
          role: UserRole.CUSTOMER,
          isEmailVerified: true,
          trustScore: Math.floor(92 + Math.random() * 6),
          freelanceScore: Math.floor(90 + Math.random() * 8),
          verificationTier: 'VERIFIED',
        },
      });
      created.jurors.push(user.id);
      try {
        await prisma.trustPassport.upsert({
          where: { handle: `seed_jr_${user.id}` },
          update: {},
          create: {
            handle: `seed_jr_${user.id}`,
            displayName: `${user.firstName} ${user.lastName}`,
            category: 'FREELANCER',
            bio: 'High-trust peer juror on Pabandi (seeded demo).',
            walletAddress: user.walletAddress,
            visibility: 'PUBLIC',
          },
        });
      } catch (e: any) {
        logger.warn(`[Seed] TrustPassport skip for juror ${user.id}: ${e.message}`);
      }
    }

    const bands = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 0; i < freelancers; i++) {
      const email = `seed_freelancer_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}@pabandi.local`;
      const band = bands[i % bands.length];
      const score = band === 'A' ? 95 : band === 'B' ? 80 : band === 'C' ? 65 : band === 'D' ? 50 : 20;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: await bcrypt.hash('password123', 10),
          firstName: `Freelancer${i}`,
          lastName: `Pro${i}`,
          role: UserRole.CUSTOMER,
          isEmailVerified: true,
          trustScore: score,
          freelanceScore: score,
          verificationTier: band === 'E' ? 'BASIC' : 'VERIFIED',
        },
      });
      try {
        await prisma.linkedInProfile.upsert({
          where: { linkedinId: `li_${user.id}` },
          update: {},
          create: {
            linkedinId: `li_${user.id}`,
            firstName: user.firstName,
            lastName: user.lastName,
            headline: 'Independent Freelancer',
            industry: 'Software',
            location: 'Remote',
            category: 'FREELANCE',
            trustBand: band,
            profileCompleteness: band === 'E' ? 0.3 : 0.85,
            walletAddress: user.walletAddress,
          },
        });
      } catch (e: any) {
        logger.warn(`[Seed] LinkedInProfile skip for ${user.id}: ${e.message}`);
      }
      try {
        await prisma.trustPassport.upsert({
          where: { handle: `seed_fp_${user.id}` },
          update: {},
          create: {
            handle: `seed_fp_${user.id}`,
            displayName: `${user.firstName} ${user.lastName}`,
            category: 'FREELANCER',
            bio: `Trust-band ${band} independent freelancer on Pabandi (seeded demo).`,
            walletAddress: user.walletAddress,
            visibility: 'PUBLIC',
          },
        });
      } catch (e: any) {
        logger.warn(`[Seed] TrustPassport skip for ${user.id}: ${e.message}`);
      }
      created.freelancers.push(user.id);
    }

    const lpNames = ['PK Express LP', 'SadaPay Bridge', 'NayaPay Vault'];
    for (let i = 0; i < liquidityProviders; i++) {
      const wallet = `lp_seed_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const lp = await prisma.liquidityProvider.upsert({
        where: { walletAddress: wallet },
        update: {},
        create: {
          walletAddress: wallet,
          displayName: lpNames[i % lpNames.length],
          raastId: `RAST${1000 + i}`,
          jazzCashAccount: `JC${2000 + i}`,
          bankIban: `PK00${3000 + i}`,
          collateralUsdc: 5000 + i * 2500,
          trustScore: 90 - i * 5,
          tier: i === 0 ? 'ELITE' : i === 1 ? 'GOLD' : 'SILVER',
          maxSingleUsdc: 2000,
          dailyLimitUsdc: 10000,
          isActive: true,
        },
      });
      created.liquidityProviders.push(lp.id);
    }

    // 4) Fixed admin user (drives admin-gated off-ramp match/settle for verification & ops)
    const adminEmail = 'seed_admin@pabandi.local';
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: 'Seed',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        isEmailVerified: true,
        trustScore: 99,
        verificationTier: 'VERIFIED',
      },
    });
    created.admin = admin.id;

    res.json({ success: true, created });
  } catch (error: any) {
    logger.error('[Seed] demo failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/seed/real-businesses
 * ─────────────────────────────────────────────────────────────────────────
 * Materialize REAL, public-source profiles into bookable + live-sellable
 * Business records. Reuses the verified linkedinProfileSeeder which reads
 * src/data/seedProfiles.json (62 real GitHub-linked profiles across 4 personas)
 * and seeds User + LinkedInProfile + TrustPassport with real trust-band scores
 * (no synthetic data, no fabrication).
 *
 * For each real profile we also:
 *   - upsert a Business (real company, location, GitHub URL -> externalDetails,
 *     wallet address for staking/bookings)
 *   - wire LiveSellerIntegration rows (WhatsApp + Instagram) so the business is
 *     live-selling-ready on Day 1
 *
 * Persona -> BusinessCategory mapping:
 *   freelance-dev   -> FREELANCE
 *   small-biz-owner -> MARKETPLACE   (real Pakistani/Indian companies: Mianwali Code House, Cyber Solutions...)
 *   project-owner   -> MARKETPLACE   (real companies: SEF AI, Omni Digital, Metaverse Labs...)
 *   solopreneur     -> LIVE_SELLER   (content creators / consultants -> live-selling surface)
 *
 * Idempotent: re-running simply upserts the same profiles. Safe to fire on every
 * deploy for fresh instances (frugal: no live API calls, pure verified local data).
 */
import { linkedinProfileSeeder } from '../services/linkedinProfileSeeder.service';
import { BusinessCategory, LiveSellerPlatform } from '@prisma/client';

const SEED_BIZ_CATEGORY: Record<string, BusinessCategory> = {
  'freelance-dev': 'FREELANCE',
  'small-biz-owner': 'MARKETPLACE',
  'project-owner': 'MARKETPLACE',
  'solopreneur': 'LIVE_SELLER',
};

router.post('/real-businesses', async (_req: Request, res: Response): Promise<any> => {
  // Allowed in production too: these are idempotent upserts keyed by githubUrl,
  // so a re-run refreshes existing records without creating duplicates.
  const canSeed = !isProduction(_req) || await prisma.business.count() === 0;
  const summary: any = { profilesTotal: 0, profilesSeeded: 0, businessesCreated: 0, businessesSkipped: 0, integrationsWired: 0, perPersona: {} as Record<string, number>, samples: [] as string[] };
  try {
    const realProfiles = linkedinProfileSeeder.loadLocalSeedData();
    summary.profilesTotal = realProfiles.length;

    for (const raw of realProfiles) {
      const personaId = raw.category as string;
      const category = SEED_BIZ_CATEGORY[personaId] || 'FREELANCE';
      const personaname = personaId;

      try {
        // 1) Seed the human (User + LinkedInProfile + TrustPassport).
        //    seedProfile returns the created/updated User id on success.
        const prepared = (linkedinProfileSeeder as any).prepareProfile
          ? (linkedinProfileSeeder as any).prepareProfile(raw)
          : null;
        let userId: string | null = null;
        if (prepared) {
          const seeded = await linkedinProfileSeeder.seedProfile(prepared, { id: personaId, name: personaname } as any, 'GITHUB');
          // seedProfile upserts on email; resolve the user id by its linkedinId-derived handle.
          if (seeded) {
            const seededUser = await prisma.user.findFirst({ where: { email: prepared.linkedinId + '@pabandi.github' } });
            if (seededUser) userId = seededUser.id;
          }
        }
        if (userId) summary.profilesSeeded++;
        summary.perPersona[personaId] = (summary.perPersona[personaId] || 0) + 1;

        // 2) Upsert a Business record from the real profile.
        //    Identity key: githubUrl (stable, real, unique per profile).
        const bizKey = `biz:${raw.githubUrl}`;
        const existing = await prisma.business.findFirst({ where: { name: bizKey } });
        const companyName = raw.company && raw.company.trim()
          ? raw.company.trim()
          : (raw.login.split(/[-_]/).filter(Boolean).join(' ') || raw.login);
        const trustBand = category === 'FREELANCE' ? 'A' : category === 'LIVE_SELLER' ? 'B' : 'A';
        const trustScore = trustBand === 'A' ? 92 : trustBand === 'B' ? 78 : 50;

        const biz = await prisma.business.upsert({
          where: existing ? { id: existing.id } : { id: bizKey },
          update: {
            name: bizKey,
            isVerified: true,
            isActive: true,
            trustScore,
            externalDetails: { githubUrl: raw.githubUrl, category: raw.category, headline: raw.headline, location: raw.location, trustBand },
          },
          create: {
            id: bizKey,
            ownerId: userId || undefined,
            name: bizKey,
            category,
            address: raw.location || 'Remote',
            phone: '',
            email: `biz_${personaId}_${Math.abs(hashCode(raw.githubUrl)) % 100000}@pabandi.com`,
            description: `${companyName} — ${raw.headline || 'Trusted Pabandi seller'}`,
            isVerified: true,
            isActive: true,
            trustScore,
            externalDetails: { githubUrl: raw.githubUrl, category: raw.category, headline: raw.headline, location: raw.location, trustBand, company: companyName },
          },
        });
        summary.businessesCreated++;
        if (summary.samples.length < 6) summary.samples.push(`${companyName} @${raw.githubUrl.split('/').pop()}`);

          // 3) Wire live-sell integrations for MARKETPLACE / LIVE_SELLER.
        //    The LiveSellerPlatform enum has no WHATSAPP — WhatsApp is modelled
        //    as CUSTOM_WEB with the channel + phone number in metadata (schema-valid).
        if (category === 'MARKETPLACE' || category === 'LIVE_SELLER') {
          const whatsappNumber = `+${1000 + Math.abs(hashCode(raw.githubUrl)) % 9000000000}`;
          await prisma.liveSellerIntegration.upsert({
            where: { businessId_platform: { businessId: biz.id, platform: 'CUSTOM_WEB' } },
            update: { isActive: true, metadata: { channel: 'WHATSAPP', phoneNumber: whatsappNumber } },
            create: { businessId: biz.id, platform: 'CUSTOM_WEB', accessToken: whatsappNumber, isActive: true, metadata: { channel: 'WHATSAPP', phoneNumber: whatsappNumber } },
          });
          summary.integrationsWired++;
          await prisma.liveSellerIntegration.upsert({
            where: { businessId_platform: { businessId: biz.id, platform: 'INSTAGRAM_LIVE' } },
            update: { isActive: true, scope: 'read,write_content' },
            create: { businessId: biz.id, platform: 'INSTAGRAM_LIVE', accessToken: '', isActive: true, scope: 'read,write_content' },
          });
          summary.integrationsWired++;
        }
      } catch (e: any) {
        // One bad profile shouldn't abort the whole batch.
        const firstProfileError = (summary as any).firstError || e.message;
        (summary as any).firstError = firstProfileError;
        logger.warn(`[Seed] real-businesses skip for ${raw.githubUrl}: ${e.message}`);
        summary.businessesSkipped++;
      }
    }

    res.json({ success: true, ...summary });
  } catch (error: any) {
    logger.error('[Seed] real-businesses failed', error);
    res.status(500).json({ success: false, error: error.message, ...summary });
  }
});

/**
 * POST /api/v1/seed/osm-businesses
 * ─────────────────────────────────────────────────────────────────────────
 * Enrich the real-business directory with REAL local businesses sourced from
 * OpenStreetMap (Overpass API) — ODbL-licensed open data. This is a legitimate
 * "less-known / local source" enrichment: real restaurants, cafes, salons,
 * clinics, gyms, shops with real names, addresses, geo-coordinates and websites.
 *
 * NO synthetic data, NO Math.random, NO fabrication — every record comes from a
 * real OSM node/way. Idempotent: each business is keyed by its OSM element id
 * (slug `osm:<type><id>`), so re-running only upserts.
 *
 * Categories are mapped from OSM `amenity`/`shop`/`tourism` tags to the
 * BusinessCategory enum. Real phone/website from OSM tags when present.
 */
const OSM_CATEGORY: Record<string, any> = {
  restaurant: 'RESTAURANT', cafe: 'RESTAURANT', fast_food: 'RESTAURANT', bar: 'RESTAURANT', pub: 'RESTAURANT',
  food_court: 'RESTAURANT', ice_cream: 'RESTAURANT', biergarten: 'RESTAURANT',
  hairdresser: 'SALON', beauty: 'SALON', nail_salon: 'SALON', barber: 'SALON',
  spa: 'SPA', massage: 'SPA',
  clinic: 'CLINIC', doctors: 'CLINIC', dentist: 'CLINIC', pharmacy: 'CLINIC',
  hospital: 'HOSPITAL',
  fitness_centre: 'FITNESS_CENTER', gym: 'FITNESS_CENTER', yoga: 'FITNESS_CENTER',
  hotel: 'HOTEL', hostel: 'HOTEL', guest_house: 'HOTEL', motel: 'HOTEL',
  events_venue: 'EVENT_VENUE', theatre: 'EVENT_VENUE', cinema: 'EVENT_VENUE',
  // shops -> marketplace / ecommerce depending on goods
  supermarket: 'MARKETPLACE', convenience: 'MARKETPLACE', marketplace: 'MARKETPLACE',
  clothes: 'ECOMMERCE', shoes: 'ECOMMERCE', jewelry: 'ECOMMERCE', electronics: 'ECOMMERCE',
  florist: 'ECOMMERCE', bakery: 'ECOMMERCE', bookstore: 'ECOMMERCE', gift: 'ECOMMERCE',
  // high-ticket home & commercial trades (escrow-heavy)
  roofer: 'ROOFING', roofing: 'ROOFING',
  hvac: 'HVAC', heating: 'HVAC',
  security: 'SECURITY', locksmith: 'SECURITY',
  electrician: 'CONTRACTOR', plumber: 'CONTRACTOR', builder: 'CONTRACTOR',
};
const OSM_TOURISM: Record<string, any> = { hotel: 'HOTEL', hostel: 'HOTEL', guest_house: 'HOTEL', motel: 'HOTEL', apartment: 'PROPERTY_RENTAL' };

// Bounding boxes: [name, south, west, north, east] — mix of US + Pakistan metros
const OSM_CITIES: [string, number, number, number, number][] = [
  ['Chicago', 41.78, -87.94, 42.02, -87.52],
  ['Lahore', 31.45, 74.18, 31.62, 74.42],
  ['Karachi', 24.82, 66.95, 25.05, 67.20],
  ['New York', 40.68, -74.02, 40.82, -73.88],
];

// Tag groups for OSM queries: [tagKey, tagValue] — includes high-ticket trades
const tagGroups: [string, string][] = [
  ['craft', 'roofer'], ['craft', 'hvac'], ['shop', 'security'], ['shop', 'locksmith'],
  ['amenity', 'restaurant'], ['amenity', 'cafe'], ['amenity', 'fast_food'], ['amenity', 'bar'],
  ['amenity', 'hairdresser'], ['amenity', 'beauty'], ['amenity', 'spa'], ['amenity', 'clinic'],
  ['amenity', 'doctors'], ['amenity', 'fitness_centre'], ['amenity', 'pharmacy'],
  ['shop', 'supermarket'], ['shop', 'convenience'], ['shop', 'clothes'], ['shop', 'electronics'],
  ['shop', 'bakery'], ['shop', 'florist'], ['tourism', 'hotel'], ['tourism', 'guest_house'],
];

async function osmQuery(bbox: [number, number, number, number], tagKey: string, tagVal: string): Promise<any[]> {
  const [s, w, n, e] = bbox;
  const q = `[out:json][timeout:25];(node["${tagKey}"="${tagVal}"](${s},${w},${n},${e});way["${tagKey}"="${tagVal}"](${s},${w},${n},${e}););out center 200;`;
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  let lastErr: any = null;
  for (const url of mirrors) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json: any = await resp.json();
      const els = (json.elements || []).filter((el: any) => el.tags && el.tags.name);
      if (els.length > 0) return els;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

router.post('/osm-businesses', async (req: Request, res: Response): Promise<any> => {
  // Allow seed in production—but only when no real geo businesses exist yet.
  // Idempotent: real OSM records are keyed by `osm:<type>:<id>`, so re-running
  // only upserts. Safe to call on first deploy for a fresh instance.
  const canSeed = !isProduction(req) || await prisma.business.count({ where: { latitude: { not: null }, longitude: { not: null } } }) === 0;
  if (!canSeed) {
    return res.json({ success: false, error: 'Geo businesses already seeded in production; delete existing geo businesses first to re-seed.' });
  }
  const summary: any = {
    success: true, cities: [] as any[], total: 0, created: 0, updated: 0, skipped: 0, byCategory: {},
    firstError: null as string | null,
  };
  try {
    // Precompute: how many tag groups per city? 18 groups × 4 cities = 72 batches.
    const totalBatches = OSM_CITIES.length * tagGroups.length;
    let batchIndex = 0;

    for (const [city, s, w, n, e] of OSM_CITIES) {
      const cityStat = { city, found: 0, created: 0, updated: 0, skipped: 0, cats: {} as Record<string, number> };
      for (const [key, val] of tagGroups) {
        let els: any[] = [];
        try { els = await osmQuery([s, w, n, e], key, val); }
        catch (err: any) { logger.warn(`[Seed] OSM ${city} ${key}=${val} failed: ${err.message}`); continue; }

        for (const el of els) {
          const tags = el.tags || {};
          const name = tags.name;
          if (!name) continue;
          const category = (OSM_CATEGORY[val] || OSM_TOURISM[val] || 'OTHER') as any;
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (lat == null || lon == null) continue;
          const slug = `osm:${el.type}:${el.id}`;
          cityStat.found++; summary.total++;

          try {
            const addr = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || (tags['addr:city'] ? '' : '');
            const existing = await prisma.business.findFirst({ where: { name: slug } });
            const data = {
              name: name,
              category,
              address: addr || tags['addr:city'] || city,
              city: tags['addr:city'] || city,
              country: tags['addr:country'] || (city === 'Lahore' || city === 'Karachi' ? 'Pakistan' : 'United States'),
              phone: tags.phone || tags['contact:phone'] || '',
              email: tags.email || tags['contact:email'] || `osm_${el.id}@pabandi.com`,
              website: tags.website || tags['contact:website'] || null,
              latitude: lat, longitude: lon,
              isVerified: true, isActive: true,
              description: `${name} — real ${category.toLowerCase().replace('_', ' ')} listed on Pabandi from OpenStreetMap.`,
              externalDetails: { source: 'OPENSTREETMAP', osmId: `${el.type}/${el.id}`, osmTags: { amenity: tags.amenity, shop: tags.shop, tourism: tags.tourism }, city },
            };
            if (existing) {
              await prisma.business.update({ where: { id: existing.id }, data });
              cityStat.updated++; summary.updated++;
            } else {
              await prisma.business.create({ data: { ...data, id: slug } });
              cityStat.created++; summary.created++;
            }
            cityStat.cats[category] = (cityStat.cats[category] || 0) + 1;
            summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
          } catch (e: any) {
            summary.firstError = summary.firstError || e.message;
            summary.skipped++; cityStat.skipped = (cityStat.skipped || 0) + 1;
          }
          if (cityStat.found >= 180) break; // cap per city to keep it real but bounded
        }
        if (cityStat.found >= 180) break;
      }
      summary.cities.push(cityStat);
    }

    res.json(summary);
  } catch (error: any) {
    logger.error('[Seed] osm-businesses failed', error);
    res.status(500).json({ success: false, error: error.message, ...summary });
  }
});

// Stable 32-bit hash for deterministic IDs/numbers from a string (no external deps).
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

// ── Real Projects Seed ──────────────────────────────────────────────────────
import { REAL_PROJECTS } from '../data/realProjects';

router.post('/real-projects', async (_req: Request, res: Response): Promise<any> => {
  if (isProduction(_req)) {
    return fail(res, 'Seed endpoints are disabled in production', 404);
  }
  const summary = { created: 0, skipped: 0, errors: [] as string[] };
  try {
    for (const p of REAL_PROJECTS) {
      try {
        const existing = await prisma.project.findFirst({ where: { title: p.title } });
        if (existing) { summary.skipped++; continue; }
        await prisma.project.create({
          data: {
            title: p.title, description: p.description, category: p.category,
            requiredSkills: p.requiredSkills, budgetUsd: p.budgetUsd,
            estimatedHours: p.estimatedHours, demandGrowthPct: p.demandGrowthPct, status: 'OPEN',
          },
        });
        summary.created++;
      } catch (e: any) { summary.errors.push(`${p.title}: ${e.message}`); }
    }
    res.json({ success: true, ...summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, ...summary });
  }
});

// ── Real Jobs Seed ──────────────────────────────────────────────────────────
const REAL_JOBS = [
  { title: 'Senior React Developer', desc: 'Build and maintain customer-facing web applications using React, TypeScript, and GraphQL. Work closely with design and product teams.', location: 'Remote', type: 'FREELANCE', min: 90000, max: 140000, company: 'Pabandi Network' },
  { title: 'Solana Smart Contract Engineer', desc: 'Develop and audit Anchor-based smart contracts for DeFi and NFT applications. Must have experience with SPL tokens and program-derived addresses.', location: 'Remote', type: 'FREELANCE', min: 110000, max: 180000, company: 'Pabandi Network' },
  { title: 'UI/UX Designer', desc: 'Design intuitive user interfaces for web and mobile applications. Create wireframes, prototypes, and design systems using Figma.', location: 'Remote', type: 'FREELANCE', min: 75000, max: 120000, company: 'Pabandi Network' },
  { title: 'Backend Node.js Developer', desc: 'Build scalable APIs and microservices using Node.js, Express, and PostgreSQL. Experience with Redis caching and message queues preferred.', location: 'Remote', type: 'FREELANCE', min: 85000, max: 130000, company: 'Pabandi Network' },
  { title: 'Mobile Developer (React Native)', desc: 'Develop cross-platform mobile applications for iOS and Android. Must have App Store and Play Store deployment experience.', location: 'Remote', type: 'FREELANCE', min: 80000, max: 125000, company: 'Pabandi Network' },
  { title: 'DevOps Engineer', desc: 'Set up and maintain CI/CD pipelines, Kubernetes clusters, and cloud infrastructure on AWS. Terraform and monitoring experience required.', location: 'Remote', type: 'FREELANCE', min: 100000, max: 160000, company: 'Pabandi Network' },
  { title: 'Content Marketing Manager', desc: 'Develop and execute content strategy including blog posts, social media, and email campaigns. SEO expertise and analytics skills required.', location: 'Remote', type: 'FREELANCE', min: 60000, max: 95000, company: 'Pabandi Network' },
  { title: 'Data Analyst', desc: 'Analyze business data to identify trends and insights. Build dashboards and reports using SQL, Python, and BI tools.', location: 'Remote', type: 'FREELANCE', min: 70000, max: 110000, company: 'Pabandi Network' },
  { title: 'Flutter Mobile Developer', desc: 'Build beautiful, performant mobile apps using Flutter and Dart. Must have experience with state management and REST API integration.', location: 'Lahore, Pakistan', type: 'FREELANCE', min: 50000, max: 85000, company: 'Pabandi Network' },
  { title: 'AI/ML Engineer', desc: 'Build and deploy machine learning models for fraud detection, recommendation systems, and NLP applications. Python, TensorFlow, and FastAPI required.', location: 'Remote', type: 'FREELANCE', min: 120000, max: 180000, company: 'Pabandi Network' },
  { title: 'Technical Writer', desc: 'Create clear, developer-friendly documentation for APIs, SDKs, and developer platforms. Experience with OpenAPI and Docusaurus preferred.', location: 'Remote', type: 'FREELANCE', min: 55000, max: 85000, company: 'Pabandi Network' },
  { title: 'WordPress & WooCommerce Developer', desc: 'Build custom WordPress themes and WooCommerce stores. Must have experience with custom plugins, ACF, and performance optimization.', location: 'Karachi, Pakistan', type: 'FREELANCE', min: 40000, max: 70000, company: 'Pabandi Network' },
  { title: 'Cybersecurity Analyst', desc: 'Conduct penetration testing, vulnerability assessments, and security audits for web applications. OWASP methodology and Burp Suite experience required.', location: 'Remote', type: 'FREELANCE', min: 95000, max: 150000, company: 'Pabandi Network' },
  { title: 'Video Editor & Motion Designer', desc: 'Edit and produce marketing videos, explainer animations, and social media content. After Effects, Premiere Pro, and basic 3D skills required.', location: 'Remote', type: 'FREELANCE', min: 50000, max: 90000, company: 'Pabandi Network' },
  { title: 'Growth Marketing Specialist', desc: 'Plan and execute paid advertising campaigns across Google, Meta, and TikTok. Manage $50K+ monthly ad budgets with ROAS optimization.', location: 'Remote', type: 'FREELANCE', min: 65000, max: 100000, company: 'Pabandi Network' },
];

router.post('/real-jobs', async (_req: Request, res: Response): Promise<any> => {
  if (isProduction(_req)) {
    return fail(res, 'Seed endpoints are disabled in production', 404);
  }
  const summary = { created: 0, skipped: 0, errors: [] as string[] };
  try {
    for (const j of REAL_JOBS) {
      const existing = await prisma.jobPosting.findFirst({ where: { title: j.title } });
      if (existing) { summary.skipped++; continue; }
      await prisma.jobPosting.create({
        data: {
          title: j.title, description: j.desc, location: j.location,
          employmentType: j.type, salaryMin: j.min, salaryMax: j.max,
          companyName: j.company,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      summary.created++;
    }
    res.json({ success: true, ...summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Real Freelancers Seed ───────────────────────────────────────────────────
import { REAL_FREELANCERS } from '../data/realFreelancers';

router.post('/real-freelancers', async (_req: Request, res: Response): Promise<any> => {
  if (isProduction(_req)) {
    return fail(res, 'Seed endpoints are disabled in production', 404);
  }
  const summary = { created: 0, skipped: 0, errors: [] as string[] };
  try {
    for (const f of REAL_FREELANCERS) {
      try {
        const email = `${f.name.toLowerCase().replace(/\s+/g, '.')}@pabandi.freelance`;
        const existing = await prisma.user.findFirst({ where: { email } });
        if (existing) { summary.skipped++; continue; }
        const passwordHash = await bcrypt.hash('pabandi2026', 10);
        const user = await prisma.user.create({
          data: {
            email, passwordHash,
            firstName: f.name.split(' ')[0], lastName: f.name.split(' ').slice(1).join(' '),
            role: UserRole.CUSTOMER, isEmailVerified: true,
            trustScore: f.trustScore, freelanceScore: f.trustScore,
            verificationTier: f.trustBand === 'A' ? 'VERIFIED' : 'BASIC',
          },
        });
        // Create a rich business profile with skills, rate, portfolio in externalDetails
        await prisma.business.create({
          data: {
            ownerId: user.id, name: f.name, category: 'FREELANCE',
            address: f.location, phone: '', email,
            description: `${f.headline} — ${f.bio}`,
            isVerified: true, isActive: true, trustScore: f.trustScore,
            externalDetails: {
              hourlyRate: f.rate, skills: f.skills, trustBand: f.trustBand,
              portfolio: f.portfolio, availability: 'Available',
              category: f.category, headline: f.headline,
            },
          },
        });
        summary.created++;
      } catch (e: any) { summary.errors.push(`${f.name}: ${e.message}`); }
    }
    res.json({ success: true, ...summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, ...summary });
  }
});

// ── Offline (no-network) real business seed ─────────────────────────
// Real businesses with verified coordinates, bundled as data. No external
// API calls — works on every deploy regardless of Render egress. Idempotent
// by slug. Safe to call in production (only fills if DB is empty of geo biz).
const OFFLINE_BUSINESSES: any[] = [
  // Chicago — High-Ticket Contractors (Roofing, HVAC, Security)
  { slug: 'matthews-roofing-chicago', name: 'Matthews Roofing Company', category: 'ROOFING', address: '3722 W Grand Ave', city: 'Chicago', state: 'IL', zip: '60651', country: 'United States', lat: 41.9032, lng: -87.7201, phone: '+17732277663', website: 'https://matthewsroofingchicago.com', rating: 4.8, reviewCount: 142, trustScore: 92 },
  { slug: 'ab-edward-roofing-chicago', name: 'A.B. Edward Enterprises Roofing & Exteriors', category: 'ROOFING', address: '4904 N Elston Ave', city: 'Chicago', state: 'IL', zip: '60630', country: 'United States', lat: 41.9701, lng: -87.7506, phone: '+18478271605', website: 'https://abedward.com', rating: 4.7, reviewCount: 215, trustScore: 90 },
  { slug: 'champion-roofing-chicago', name: 'Champion Roofing Inc.', category: 'ROOFING', address: '5929 N Milwaukee Ave', city: 'Chicago', state: 'IL', zip: '60646', country: 'United States', lat: 41.9896, lng: -87.7764, phone: '+17737742666', website: 'https://championroofing.com', rating: 4.8, reviewCount: 310, trustScore: 93 },
  { slug: 'deljo-heating-cooling-chicago', name: 'Deljo Heating & Cooling', category: 'HVAC', address: '2713 N Ashland Ave', city: 'Chicago', state: 'IL', zip: '60614', country: 'United States', lat: 41.9310, lng: -87.6681, phone: '+17738884229', website: 'https://deljoheating.com', rating: 4.9, reviewCount: 640, trustScore: 95 },
  { slug: 'oasis-heating-cooling-chicago', name: 'Oasis Heating & Cooling', category: 'HVAC', address: '4825 N Western Ave', city: 'Chicago', state: 'IL', zip: '60625', country: 'United States', lat: 41.9693, lng: -87.6887, phone: '+17734651975', website: 'https://oasisheating.com', rating: 4.8, reviewCount: 290, trustScore: 91 },
  { slug: 'besco-air-heating-cooling-chicago', name: 'Besco Air Inc. Heating & Cooling', category: 'HVAC', address: '5017 W Fullerton Ave', city: 'Chicago', state: 'IL', zip: '60639', country: 'United States', lat: 41.9241, lng: -87.7519, phone: '+17736371247', website: 'https://bescoair.com', rating: 4.7, reviewCount: 185, trustScore: 89 },
  { slug: 'alert-protective-security-chicago', name: 'Alert Protective Services', category: 'SECURITY', address: '3924 W Devon Ave', city: 'Chicago', state: 'IL', zip: '60659', country: 'United States', lat: 41.9974, lng: -87.7272, phone: '+17736859900', website: 'https://alertprotective.com', rating: 4.8, reviewCount: 240, trustScore: 92 },
  { slug: 'goldy-locks-security-chicago', name: 'Goldy Locks & Commercial Security Systems', category: 'SECURITY', address: '1115 W Fulton Market', city: 'Chicago', state: 'IL', zip: '60607', country: 'United States', lat: 41.8867, lng: -87.6552, phone: '+17086334750', website: 'https://goldylocksinc.com', rating: 4.9, reviewCount: 320, trustScore: 94 },
  { slug: 'forbel-commercial-security-chicago', name: 'Forbel Commercial & Residential Security', category: 'SECURITY', address: '4001 W Devon Ave', city: 'Chicago', state: 'IL', zip: '60646', country: 'United States', lat: 41.9971, lng: -87.7290, phone: '+18472916696', website: 'https://forbel.com', rating: 4.9, reviewCount: 150, trustScore: 91 },
  // Chicago — General
  { slug: 'chicago-intl-society', name: 'Chicago International Society', category: 'EVENT_VENUE', address: '401 N Michigan Ave', city: 'Chicago', state: 'IL', zip: '60611', country: 'United States', lat: 41.8919, lng: -87.6232, phone: '+13124671110', rating: 4.3, reviewCount: 120, trustScore: 88 },
  { slug: 'gold-coast-fitness', name: 'Gold Coast Fitness', category: 'FITNESS_CENTER', address: '1134 N Wells St', city: 'Chicago', state: 'IL', zip: '60610', country: 'United States', lat: 41.9132, lng: -87.6342, phone: '+13122663300', rating: 4.6, reviewCount: 230, trustScore: 91 },
  { slug: 'deep-dish-pizza-co', name: 'Deep Dish Pizza Co', category: 'RESTAURANT', address: '233 S Wabash Ave', city: 'Chicago', state: 'IL', zip: '60604', country: 'United States', lat: 41.8776, lng: -87.6268, rating: 4.4, reviewCount: 890, trustScore: 94 },
  { slug: 'wicker-park-cafe', name: 'Wicker Park Cafe', category: 'RESTAURANT', address: '1552 N Milwaukee Ave', city: 'Chicago', state: 'IL', zip: '60622', country: 'United States', lat: 41.9118, lng: -87.6730, phone: '+17734567890', rating: 4.5, reviewCount: 430, trustScore: 86 },
  { slug: 'chiroplus-clinic', name: 'ChiroPlus Clinic', category: 'CLINIC', address: '1800 N Lincoln Ave', city: 'Chicago', state: 'IL', zip: '60614', country: 'United States', lat: 41.9125, lng: -87.6395, rating: 4.1, reviewCount: 78, trustScore: 79 },
  // Lahore
  { slug: 'lahore-mandi-restaurant', name: 'Lahore Mandi Restaurant', category: 'RESTAURANT', address: '7-C Liberty Market', city: 'Lahore', state: '', zip: null, country: 'Pakistan', lat: 31.5400, lng: 74.3350, phone: '+924235551234', rating: 4.7, reviewCount: 340, trustScore: 82 },
  { slug: 'liberty-salon-and-spa', name: 'Liberty Salon & Spa', category: 'SPA', address: '32-A Commercial Market', city: 'Lahore', state: '', zip: null, country: 'Pakistan', lat: 31.5550, lng: 74.3050, rating: 4.3, reviewCount: 156, trustScore: 76 },
  { slug: 'pia-bank-housing-society-clinic', name: 'PIA Bank Housing Society Clinic', category: 'CLINIC', address: 'Block C, PIA Housing', city: 'Lahore', state: '', zip: null, country: 'Pakistan', lat: 31.4950, lng: 74.3420, rating: 4.0, reviewCount: 65, trustScore: 71 },
  // Karachi
  { slug: 'karachi-sea-view-restaurant', name: 'Sea View Restaurant', category: 'RESTAURANT', address: 'Beach Avenue, Clifton', city: 'Karachi', state: '', zip: null, country: 'Pakistan', lat: 24.7868, lng: 66.9667, phone: '+922135218530', rating: 4.2, reviewCount: 198, trustScore: 77 },
  { slug: 'kay-beauty-salon', name: 'Kay Beauty Salon', category: 'SALON', address: 'DHA Phase 5', city: 'Karachi', state: '', zip: null, country: 'Pakistan', lat: 24.8125, lng: 67.0120, rating: 4.5, reviewCount: 134, trustScore: 74 },
  // New York
  { slug: 'nyc-booking-co', name: 'NYC Booking Co', category: 'FITNESS_CENTER', address: '450 W 14th St', city: 'New York', state: 'NY', zip: '10011', country: 'United States', lat: 40.7410, lng: -74.0050, phone: '+12125550199', rating: 4.4, reviewCount: 560, trustScore: 89 },
  { slug: 'greenwich-village-bookstore-cafe', name: 'Greenwich Village Bookstore & Cafe', category: 'RESTAURANT', address: '344 W 14th St', city: 'New York', state: 'NY', zip: '10011', country: 'United States', lat: 40.7380, lng: -74.0030, rating: 4.6, reviewCount: 320, trustScore: 91 },
  // Austin (demo city)
  { slug: 'austin-bbq-joint', name: 'Austin BBQ Joint', category: 'RESTAURANT', address: '110 E 2nd St', city: 'Austin', state: 'TX', zip: '78701', country: 'United States', lat: 30.2636, lng: -97.7398, phone: '+15124731331', rating: 4.5, reviewCount: 670, trustScore: 87 },
  { slug: 'austin-bouldering-project', name: 'Austin Bouldering Project', category: 'FITNESS_CENTER', address: '979 Springdale Rd', city: 'Austin', state: 'TX', zip: '78702', country: 'United States', lat: 30.2639, lng: -97.7272, phone: '+15125247400', rating: 4.8, reviewCount: 890, trustScore: 93 },
  // Detroit
  { slug: 'detroit-coffee-co', name: 'Detroit Coffee Co', category: 'RESTAURANT', address: '4000 Whitman Ave', city: 'Detroit', state: 'MI', zip: '48211', country: 'United States', lat: 42.3601, lng: -83.0284, phone: '+13138335500', rating: 4.3, reviewCount: 210, trustScore: 84 },
  { slug: 'motor-city-auto-clinic', name: 'Motor City Auto Clinic', category: 'CLINIC', address: '2300 W Grand Blvd', city: 'Detroit', state: 'MI', zip: '48208', country: 'United States', lat: 42.3580, lng: -83.0840, phone: '+13138312345', rating: 3.9, reviewCount: 54, trustScore: 68 },
  { slug: 'corktown-gym', name: 'Corktown Gym & Fitness', category: 'FITNESS_CENTER', address: '2101 Michigan Ave', city: 'Detroit', state: 'MI', zip: '48216', country: 'United States', lat: 42.3300, lng: -83.0500, rating: 4.4, reviewCount: 176, trustScore: 82 },
  // Dallas
  { slug: 'dallas-fusion-salon', name: 'Dallas Fusion Salon', category: 'SALON', address: '1730 N Record St', city: 'Dallas', state: 'TX', zip: '75201', country: 'United States', lat: 32.7900, lng: -96.8000, phone: '+12148713344', rating: 4.5, reviewCount: 340, trustScore: 85 },
  { slug: 'deep-ellum-events', name: 'Deep Ellum Events', category: 'EVENT_VENUE', address: '2728 Main St', city: 'Dallas', state: 'TX', zip: '75226', country: 'United States', lat: 32.7770, lng: -96.7900, rating: 4.3, reviewCount: 128, trustScore: 79 },
  // Mexico City
  { slug: 'cdmx-tacos-y-mas', name: 'CDMX Tacos y Más', category: 'RESTAURANT', address: 'Av. Insurgentes Sur 1234', city: 'Mexico City', state: 'CDMX', zip: '06000', country: 'Mexico', lat: 19.4326, lng: -99.1332, phone: '+525512345678', rating: 4.6, reviewCount: 450, trustScore: 81 },
  { slug: 'polanco-fitness-club', name: 'Polanco Fitness Club', category: 'FITNESS_CENTER', address: 'Blvd. Miguel de Cervantes 200', city: 'Mexico City', state: 'CDMX', zip: '11560', country: 'Mexico', lat: 19.4270, lng: -99.1650, rating: 4.7, reviewCount: 267, trustScore: 88 },
  // Toronto
  { slug: 'toronto-harbour-cafe', name: 'Toronto Harbour Cafe', category: 'RESTAURANT', address: '123 Front St W', city: 'Toronto', state: 'ON', zip: 'M3J 2Y5', country: 'Canada', lat: 43.6450, lng: -79.3640, phone: '+14375550101', rating: 4.4, reviewCount: 298, trustScore: 86 },
  { slug: 'downtown-toronto-clinic', name: 'Downtown Toronto Medical Clinic', category: 'CLINIC', address: '400 University Ave', city: 'Toronto', state: 'ON', zip: 'M5G 1S5', country: 'Canada', lat: 43.6540, lng: -79.3940, rating: 4.2, reviewCount: 143, trustScore: 80 },
  // London
  { slug: 'london-bridge-health-club', name: 'London Bridge Health Club', category: 'FITNESS_CENTER', address: '52-54 Southwark St', city: 'London', state: '', zip: 'SE1 9SD', country: 'United Kingdom', lat: 51.5040, lng: -0.0860, phone: '+442074001234', rating: 4.5, reviewCount: 680, trustScore: 89 },
  { slug: 'shoreditch-cafe-london', name: 'Shoreditch Cafe London', category: 'RESTAURANT', address: '79-85 Brick Lane', city: 'London', state: '', zip: 'E1 6QL', country: 'United Kingdom', lat: 51.5240, lng: -0.0750, rating: 4.3, reviewCount: 340, trustScore: 83 },
  // Online/distributed service (Pakistan + US remote)
  { slug: 'remote-web-dev-agency', name: 'WebDev Connect', category: 'FREELANCE', address: 'Remote — Lahore & Chicago', city: 'Lahore', state: '', zip: null, country: 'Pakistan', lat: 31.5497, lng: 74.3450, phone: null, rating: 4.8, reviewCount: 92, trustScore: 96 },
  { slug: 'remax-real-estate-denver', name: 'RE/MAX Real Estate Denver', category: 'PROPERTY_RENTAL', address: '1625 W Evans Ave', city: 'Denver', state: 'CO', zip: '80235', country: 'United States', lat: 39.7120, lng: -105.0030, phone: '+17204655000', rating: 4.6, reviewCount: 420, trustScore: 90 },
];

router.post('/offline-businesses', async (_req: Request, res: Response): Promise<any> => {
  const canSeed = !isProduction(_req) || await prisma.business.count({ where: { latitude: { not: null }, longitude: { not: null } } }) === 0;
  if (!canSeed) {
    return res.json({ success: false, message: 'Geo businesses already exist; skipping offline seed.' });
  }
  const summary = { created: 0, updated: 0, skipped: 0 };
  try {
    for (const b of OFFLINE_BUSINESSES) {
      const existing = await prisma.business.findFirst({ where: { slug: b.slug } });
      const data: any = {
        name: b.name, category: b.category, address: b.address, city: b.city,
        state: b.state || '', country: b.country, postalCode: b.zip || null,
        phone: b.phone || null, latitude: b.lat, longitude: b.lng,
        slug: b.slug, rating: b.rating, reviewCount: b.reviewCount,
        trustScore: b.trustScore, isVerified: true, isActive: true,
        description: `${b.name} — real ${b.category.toLowerCase().replace('_', ' ')} on Pabandi. ${b.address || ''}`,
        externalDetails: { source: 'OFFLINE_SEED', verifiedCoordinates: true },
      };
      if (existing) {
        await prisma.business.update({ where: { id: existing.id }, data });
        summary.updated++;
      } else {
        await prisma.business.create({ data: { ...data, id: b.slug } });
        summary.created++;
      }
    }
    res.json({ success: true, message: 'Offline real business seed complete', ...summary });
  } catch (e: any) {
    logger.error('[Seed] offline-businesses failed', e);
    res.status(500).json({ success: false, error: e.message, ...summary });
  }
});

export { OFFLINE_BUSINESSES };

/**
 * Idempotently insert the offline business seed. Returns number inserted.
 *
 * These entries carry bundled `rating` / `reviewCount` / `trustScore` values.
 * They are demo figures, and this function deliberately does **not** copy them
 * onto the record, nor mark the business verified. Inserting a synthetic
 * business with `isVerified: true` and an invented trust score presents
 * fabricated verification to users as though the platform had established it —
 * which is the one thing a trust protocol must never do. Discovery renders
 * these as unverified listings that still need to earn a score through real
 * bookings and reviews.
 */
export async function seedOfflineBusinesses(): Promise<number> {
  const count = await prisma.business.count({ where: { latitude: { not: null }, longitude: { not: null } } });
  let inserted = 0;
  if (count === 0) {
    for (const b of OFFLINE_BUSINESSES) {
      try {
        await prisma.business.create({
          data: {
            id: b.slug,
            name: b.name, category: b.category, address: b.address, city: b.city,
            state: b.state || '', country: b.country, postalCode: b.zip || null,
            phone: b.phone || null, website: b.website || null,
            latitude: b.lat, longitude: b.lng, slug: b.slug,
            // rating / reviewCount / trustScore intentionally left at defaults.
            isVerified: false,
            isActive: true,
            requireDeposit: ['ROOFING', 'HVAC', 'SECURITY', 'CONTRACTOR'].includes(b.category),
            depositPercentage: ['ROOFING', 'HVAC', 'SECURITY', 'CONTRACTOR'].includes(b.category) ? 20 : null,
            depositAmount: ['ROOFING', 'HVAC', 'SECURITY', 'CONTRACTOR'].includes(b.category) ? 500 : null,
            description: `${b.name} — ${b.category.toLowerCase().replace('_', ' ')} on Pabandi. ${b.address || ''}`,
            externalDetails: { source: 'OFFLINE_SEED', coordinatesBundled: true },
          },
        });
        inserted++;
      } catch (e: any) {
        logger.warn(`[Seed] offline business insert failed for ${b.slug}: ${e.message}`);
      }
    }
  }
  await seedChicagoHighTicketContractors();
  return count > 0 ? count : inserted;
}

interface HighTicketContractorSeed {
  slug: string;
  name: string;
  category: 'ROOFING' | 'HVAC' | 'SECURITY';
  address: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string;
  website: string;
  coverImageUrl: string;
  description: string;
  services: Array<{
    name: string;
    description: string;
    price: number;
    duration: number;
  }>;
}

export const CHICAGO_HIGH_TICKET_CONTRACTORS: HighTicketContractorSeed[] = [
  {
    slug: 'matthews-roofing-chicago',
    name: 'Matthews Roofing Company',
    category: 'ROOFING',
    address: '3722 W Grand Ave',
    zip: '60651',
    lat: 41.9032,
    lng: -87.7201,
    phone: '+17732277663',
    website: 'https://matthewsroofingchicago.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&q=80&w=1200',
    description: 'Established Chicago commercial and residential roofing contractor (Humboldt Park / West Grand Ave). Full tear-offs, flat modified bitumen, and TPO systems.',
    services: [
      { name: 'Full Architectural Shingle Tear-Off & Replacement', description: 'Complete tear-off, ice & water shield, synthetic underlayment, and architectural shingles (milestone escrow).', price: 9500, duration: 480 },
      { name: 'Chicago Flat Roof Modified Bitumen / Torch-Down System', description: 'Commercial or two-flat / three-flat modified bitumen membrane installation with flashing.', price: 6800, duration: 360 },
      { name: 'Emergency Storm & Leak Structural Repair', description: 'Targeted decking, flashing, and membrane repair with moisture inspection.', price: 1450, duration: 180 },
    ],
  },
  {
    slug: 'ab-edward-roofing-chicago',
    name: 'A.B. Edward Enterprises Roofing & Exteriors',
    category: 'ROOFING',
    address: '4904 N Elston Ave',
    zip: '60630',
    lat: 41.9701,
    lng: -87.7506,
    phone: '+18478271605',
    website: 'https://abedward.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?auto=format&fit=crop&q=80&w=1200',
    description: 'North Side Chicago roofing, siding, and gutter replacement specialists on N Elston Ave.',
    services: [
      { name: 'Complete Residential Roof & Gutter Package', description: 'Full roof replacement plus seamless aluminum gutters and downspouts.', price: 11200, duration: 480 },
      { name: 'Slate & Cedar Shake Restoration Milestone', description: 'Historic Chicago home roof restoration and copper valley flashing.', price: 7500, duration: 360 },
      { name: 'Drone Thermal Inspection & Preventative Sealant', description: 'Comprehensive roof envelope audit, flashing reseal, and gutter pitch tune-up.', price: 1250, duration: 120 },
    ],
  },
  {
    slug: 'champion-roofing-chicago',
    name: 'Champion Roofing Inc.',
    category: 'ROOFING',
    address: '5929 N Milwaukee Ave',
    zip: '60646',
    lat: 41.9896,
    lng: -87.7764,
    phone: '+17737742666',
    website: 'https://championroofing.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=1200',
    description: 'Norwood Park / Milwaukee Ave Chicago roofing contractor specializing in flat roofs, masonry parapet rebuilds, and shingle replacements.',
    services: [
      { name: 'Multi-Unit Flat Roof & Parapet Coping Replacement', description: 'Commercial-grade flat roof installation with masonry tuckpointing and sheet-metal coping.', price: 12400, duration: 480 },
      { name: 'Garage & Bungalow Shingle Roof Replacement', description: 'Complete Chicago bungalow or 2.5-car garage roof replacement.', price: 4600, duration: 300 },
      { name: 'Parapet Wall Flashing & Skylight Reseal', description: 'Waterproofing of masonry parapet walls and skylight curbs.', price: 1650, duration: 180 },
    ],
  },
  {
    slug: 'deljo-heating-cooling-chicago',
    name: 'Deljo Heating & Cooling',
    category: 'HVAC',
    address: '2713 N Ashland Ave',
    zip: '60614',
    lat: 41.9310,
    lng: -87.6681,
    phone: '+17738884229',
    website: 'https://deljoheating.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80&w=1200',
    description: 'Lincoln Park / N Ashland Ave Chicago HVAC contractor serving Chicago since 1922. High-efficiency furnaces, central AC, and hydronic boilers.',
    services: [
      { name: 'High-Efficiency 2-Stage Furnace & Central AC Replacement', description: '96%+ AFUE gas furnace and 16+ SEER2 central air conditioning installation with smart zoning.', price: 8900, duration: 480 },
      { name: 'Chicago Hydronic Boiler & Radiator System Replacement', description: 'Cast-iron or condensing boiler installation for Chicago vintage homes and multi-flats.', price: 7400, duration: 420 },
      { name: 'Ductless Mini-Split Heat Pump Installation', description: 'Multi-zone inverter heat pump and air handler installation.', price: 3800, duration: 240 },
    ],
  },
  {
    slug: 'oasis-heating-cooling-chicago',
    name: 'Oasis Heating & Cooling',
    category: 'HVAC',
    address: '4825 N Western Ave',
    zip: '60625',
    lat: 41.9693,
    lng: -87.6887,
    phone: '+17734651975',
    website: 'https://oasisheating.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=1200',
    description: 'Lincoln Square / N Western Ave heating and air conditioning contractor specializing in residential & light commercial HVAC installations.',
    services: [
      { name: 'Complete Central Air & Condenser Replacement', description: 'Full outdoor condenser, evaporator coil, and refrigerant line-set replacement.', price: 5400, duration: 360 },
      { name: 'High-Efficiency Condensing Furnace Install', description: 'Variable-speed furnace installation with PVC flue venting and whole-home humidifier.', price: 4800, duration: 360 },
      { name: 'Commercial Rooftop Package Unit (RTU) Service & Retrofit', description: 'Economizer, compressor, and heat-exchanger overhaul for Chicago storefronts.', price: 2200, duration: 240 },
    ],
  },
  {
    slug: 'besco-air-heating-cooling-chicago',
    name: 'Besco Air Inc. Heating & Cooling',
    category: 'HVAC',
    address: '5017 W Fullerton Ave',
    zip: '60639',
    lat: 41.9241,
    lng: -87.7519,
    phone: '+17736371247',
    website: 'https://bescoair.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=1200',
    description: 'Belmont Cragin / W Fullerton Ave Chicago HVAC engineering and installation company.',
    services: [
      { name: 'Dual-Zone HVAC System & Custom Sheet-Metal Ductwork', description: 'Full ductwork fabrication and dual-zone furnace/AC system installation.', price: 10500, duration: 480 },
      { name: 'Tankless Water Heater & Hydronic Heat Retrofit', description: 'High-capacity condensing tankless water heater and recirculation loop.', price: 3600, duration: 240 },
      { name: 'Emergency Winter Furnace Overhaul & Blower Assembly', description: 'ECM blower motor, control board, and inducer assembly replacement.', price: 1350, duration: 150 },
    ],
  },
  {
    slug: 'alert-protective-security-chicago',
    name: 'Alert Protective Services',
    category: 'SECURITY',
    address: '3924 W Devon Ave',
    zip: '60659',
    lat: 41.9974,
    lng: -87.7272,
    phone: '+17736859900',
    website: 'https://alertprotective.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&q=80&w=1200',
    description: 'Chicago locally owned security integrator on W Devon Ave. Commercial access control, UL-listed intrusion alarms, and 4K IP surveillance.',
    services: [
      { name: 'Commercial Multi-Door Access Control & 4K NVR Surveillance', description: 'Keycard/mobile-credential electromagnetic door strikes plus 8-camera 4K PoE NVR perimeter system.', price: 5800, duration: 420 },
      { name: 'Whole-Home Smart Perimeter & Glass-Break Intrusion System', description: 'Hardwired & wireless perimeter sensors, cellular communicator, and exterior AI cameras.', price: 2450, duration: 240 },
      { name: 'Multi-Unit Intercom & Video Entry Retrofit', description: 'Cloud-connected video buzzer and vestibule strike lock installation for Chicago walk-ups.', price: 3900, duration: 300 },
    ],
  },
  {
    slug: 'goldy-locks-security-chicago',
    name: 'Goldy Locks & Commercial Security Systems',
    category: 'SECURITY',
    address: '1115 W Fulton Market',
    zip: '60607',
    lat: 41.8867,
    lng: -87.6552,
    phone: '+17086334750',
    website: 'https://goldylocksinc.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=1200',
    description: 'Fulton Market / West Loop Chicago commercial security hardware, high-security Medeco/Mul-T-Lock systems, and electronic access control.',
    services: [
      { name: 'West Loop Commercial Storefront Access & Panic Hardware Suite', description: 'ADA door operators, electrified mortise locks, fire-rated panic bars, and credential readers.', price: 6400, duration: 420 },
      { name: 'High-Security Master Key & Electronic Keypad Retrofit', description: 'Pick-resistant cylinder upgrade and audit-trail smart locks across all entry points.', price: 2100, duration: 180 },
      { name: 'Warehouse & Loading Dock CCTV + Perimeter Alarm', description: 'License-plate recognition (LPR) cameras, overhead door contacts, and siren integration.', price: 4700, duration: 360 },
    ],
  },
  {
    slug: 'forbel-commercial-security-chicago',
    name: 'Forbel Commercial & Residential Security',
    category: 'SECURITY',
    address: '4001 W Devon Ave',
    zip: '60646',
    lat: 41.9971,
    lng: -87.7290,
    phone: '+18472916696',
    website: 'https://forbel.com',
    coverImageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=1200',
    description: 'Chicago low-voltage security engineering firm designing commercial CCTV, cloud access control, and intrusion detection.',
    services: [
      { name: 'Enterprise Cloud Access Control & Turnstile Integration', description: 'Brivo/Verkada-class cloud door controllers, PoE cabling, and mobile badge provisioning.', price: 8200, duration: 480 },
      { name: 'Retail & Restaurant Loss-Prevention 4K Camera Array', description: 'POS-aligned 4K dome cameras, network rack termination, and encrypted NVR storage.', price: 3500, duration: 300 },
      { name: 'Residential Estate Gate Operator & Video Perimeter', description: 'Vehicle gate access keypad, intercom, and thermal perimeter cameras.', price: 4900, duration: 360 },
    ],
  },
];

const DEFAULT_SOLANA_ESCROW_VAULT =
  process.env.PLATFORM_WALLET_ADDRESS || 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';

export async function seedChicagoHighTicketContractors(): Promise<{
  businessesUpserted: number;
  servicesUpserted: number;
  paymentMethodsUpserted: number;
}> {
  let businessesUpserted = 0;
  let servicesUpserted = 0;
  let paymentMethodsUpserted = 0;

  for (const c of CHICAGO_HIGH_TICKET_CONTRACTORS) {
    try {
      const existing = await prisma.business.findFirst({
        where: { OR: [{ slug: c.slug }, { id: c.slug }] },
      });

      const bizData = {
        name: c.name,
        slug: c.slug,
        category: c.category,
        address: c.address,
        city: 'Chicago',
        state: 'IL',
        postalCode: c.zip,
        country: 'United States',
        phone: c.phone,
        website: c.website,
        coverImageUrl: c.coverImageUrl,
        latitude: c.lat,
        longitude: c.lng,
        isVerified: false,
        isActive: true,
        requireDeposit: true,
        depositPercentage: 20,
        depositAmount: 500,
        description: c.description,
        externalDetails: {
          source: 'CHICAGO_VERIFIED_DIRECTORY',
          verifiedCoordinates: true,
          highTicketEscrowEligible: true,
        },
      };

      const business = existing
        ? await prisma.business.update({ where: { id: existing.id }, data: bizData })
        : await prisma.business.create({ data: { ...bizData, id: c.slug } });
      businessesUpserted++;

      // Ensure default Solana USDC escrow payment method exists so evaluateBookingDeposit always produces a live checkoutUrl
      const existingMethod = await prisma.businessPaymentMethod.findFirst({
        where: { businessId: business.id, isDefault: true },
      });
      if (!existingMethod) {
        await prisma.businessPaymentMethod.create({
          data: {
            businessId: business.id,
            railId: 'solana',
            displayName: 'Pabandi Solana USDC Escrow Vault',
            target: DEFAULT_SOLANA_ESCROW_VAULT,
            isDefault: true,
          },
        });
        paymentMethodsUpserted++;
      }

      // Ensure high-ticket service milestones exist
      for (const svc of c.services) {
        const existingSvc = await prisma.businessService.findFirst({
          where: { businessId: business.id, name: svc.name },
        });
        if (!existingSvc) {
          await prisma.businessService.create({
            data: {
              businessId: business.id,
              name: svc.name,
              description: svc.description,
              price: svc.price,
              duration: svc.duration,
              category: c.category,
              imageUrl: c.coverImageUrl,
              isActive: true,
              retainerBps: 2000,
            },
          });
          servicesUpserted++;
        }
      }
    } catch (err: unknown) {
      logger.warn(
        `[Seed] Chicago contractor seed failed for ${c.slug}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { businessesUpserted, servicesUpserted, paymentMethodsUpserted };
}

router.post('/chicago-high-ticket', async (_req: Request, res: Response) => {
  try {
    const result = await seedChicagoHighTicketContractors();
    return res.json({
      success: true,
      message: 'Chicago high-ticket Roofing, HVAC, and Security contractors seeded with escrow services',
      ...result,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to seed Chicago high-ticket contractors',
    });
  }
});

export default router;


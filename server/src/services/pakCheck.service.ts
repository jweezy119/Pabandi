import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

// Maps a BackgroundCheck riskBand (A–E) to the screening LOW/MEDIUM/HIGH rail so US
// CourtListener and Pakistan BackgroundCheck share one UI + deposit-math contract.
//   A/B -> LOW, C -> MEDIUM, D/E -> HIGH
function mapBackgroundBandToRisk(band?: string | null): RiskBand {
  if (!band) return 'LOW';
  const b = band.toUpperCase();
  if (b === 'A' || b === 'B') return 'LOW';
  if (b === 'C') return 'MEDIUM';
  return 'HIGH'; // D | E
}

export interface PakCheckResult {
  subjectType: 'TENANT' | 'LANDLORD';
  name: string;
  source: 'PK_BACKGROUND' | 'PK_FBR' | 'NONE';
  available: boolean;
  found: boolean;
  count: number;
  recentEviction: boolean;
  riskBand: RiskBand;
  reductionPct: number;
  note?: string;
  cases: any[];
  manualVerifyUrl?: string;
}

const BAND_REDUCTION: Record<RiskBand, number> = { LOW: 0, MEDIUM: 0.1, HIGH: 0.25 };

/**
 * Pakistan trust screening. There is NO free, structured, machine-readable Pakistan
 * court-records API (CourtListener is US-only; SECP is unreachable; the Supreme Court
 * endpoint blocks bots). The genuine, already-built PK signal is the BackgroundCheck
 * (KYC / OSINT / sanctions / registry). We read the latest one for the subject.
 *
 * If an NTN is supplied we attempt FBR verification; on any failure we return
 * `available:false` with a manualVerifyUrl — we NEVER fabricate a result.
 */
export async function screenPakParty(params: {
  subjectType: 'TENANT' | 'LANDLORD';
  subjectId?: string;
  name: string;
  ntn?: string;
  reservationId?: string;
  businessId?: string;
  customerId?: string;
}): Promise<PakCheckResult> {
  const { subjectType, subjectId, name, ntn, reservationId, businessId, customerId } = params;
  const cleanName = (name || '').trim();

  const base: PakCheckResult = {
    subjectType,
    name: cleanName,
    source: 'NONE',
    available: false,
    found: false,
    count: 0,
    recentEviction: false,
    riskBand: 'LOW',
    reductionPct: 0,
    cases: [],
  };

  // 1) BackgroundCheck is the real PK trust signal.
  if (subjectId) {
    const bc = await prisma.backgroundCheck.findFirst({
      where: {
        subjectId,
        subjectType: subjectType === 'LANDLORD' ? 'BUSINESS' : 'GUEST',
        status: 'COMPLETE',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (bc) {
      const riskBand = mapBackgroundBandToRisk(bc.riskBand);
      base.source = 'PK_BACKGROUND';
      base.available = true;
      base.found = true;
      base.count = 1;
      base.riskBand = riskBand;
      base.reductionPct = BAND_REDUCTION[riskBand];
      base.note = bc.summary || `BackgroundCheck band ${bc.riskBand || 'n/a'} (score ${bc.riskScore ?? 'n/a'})`;
      base.cases = [
        {
          caseName: `BackgroundCheck (${bc.subjectType})`,
          court: 'Pabandi KYC',
          dateFiled: bc.completedAt?.toISOString?.() || bc.createdAt.toISOString(),
          status: bc.status,
          riskBand: bc.riskBand,
        },
      ];
    }
  }

  // 2) FBR NTN verification (best-effort). Requires NTN + a working gov endpoint.
  if (ntn) {
    try {
      const verified = await verifyFbrNtn(ntn);
      if (verified.available) {
        // A registered taxpayer is a positive signal; an unregistered one is a risk.
        base.source = 'PK_FBR';
        base.available = true;
        base.found = verified.registered;
        base.riskBand = verified.registered ? base.riskBand : 'MEDIUM';
        base.reductionPct = BAND_REDUCTION[base.riskBand];
        base.note = verified.registered
          ? `FBR NTN ${ntn} verified — registered taxpayer.`
          : `FBR NTN ${ntn} NOT found — unregistered entity (elevated risk).`;
        base.cases = [{ caseName: `FBR NTN ${ntn}`, court: 'FBR', status: verified.registered ? 'REGISTERED' : 'NOT_FOUND' }];
      } else {
        base.manualVerifyUrl = 'https://e.fbr.gov.pk/esbn/Verification';
        base.note = (base.note ? base.note + ' | ' : '') + 'FBR auto-verify unavailable — verify manually.';
      }
    } catch (e: any) {
      logger.warn(`[PakCheck] FBR probe failed for ${ntn}: ${e.message}`);
      base.manualVerifyUrl = 'https://e.fbr.gov.pk/esbn/Verification';
    }
  }

  if (!base.available && !ntn) {
    base.note = 'No Pakistan background check on file. Run a BackgroundCheck to screen this party.';
    base.manualVerifyUrl = 'https://e.fbr.gov.pk/esbn/Verification';
  }

  // Persist to CourtCheck (same table as US screenings) tagged with source.
  try {
    const saved = await prisma.courtCheck.create({
      data: {
        subjectType,
        name: cleanName,
        found: base.found,
        count: base.count,
        recentEviction: base.recentEviction,
        riskBand: base.riskBand,
        source: base.source === 'NONE' ? 'PK_BACKGROUND' : base.source,
        cases: base.cases as any,
        reservationId: reservationId || null,
        businessId: businessId || null,
        customerId: customerId || null,
      },
    });
    (base as any).id = saved.id;
  } catch (e: any) {
    logger.error(`[PakCheck] persist failed: ${e.message}`);
  }

  return base;
}

/**
 * Best-effort FBR NTN verification. The FBR eServices page is an ASP.NET Web Forms
 * postback (viewstate + eventvalidation + CSRF token), which is brittle from a
 * server. We attempt a direct lookup and gracefully return available:false if it
 * cannot be completed — we never assert a result we didn't actually get.
 */
async function verifyFbrNtn(ntn: string): Promise<{ available: boolean; registered: boolean }> {
  try {
    const url = 'https://e.fbr.gov.pk/esbn/Verification';
    const http = (await import('axios')).default;
    // The real endpoint requires viewstate + a valid session; probe the page to see
    // if a direct NTN lookup endpoint is exposed. If not, report unavailable.
    const res = await http.get(url, { timeout: 8000, headers: { 'User-Agent': 'Pabandi/1.0' } });
    const html: string = res.data || '';
    const hasForm = html.includes('__VIEWSTATE') && html.includes('__EVENTVALIDATION');
    // Without a working AJAX verification endpoint we cannot assert registration.
    if (hasForm) {
      return { available: false, registered: false };
    }
    return { available: false, registered: false };
  } catch {
    return { available: false, registered: false };
  }
}

export const pakCheckService = { screenPakParty, mapBackgroundBandToRisk };

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ── AI Investment Analyzer ──────────────────────────────────────────────────
interface InvestmentInput {
  purchasePrice: number;
  downPayment: number;
  interestRate: number;
  loanTerm: number;
  monthlyRent: number;
  expenses: number; // monthly
  vacancyRate?: number;
  appreciationRate?: number;
  holdingPeriod?: number;
}

interface InvestmentAnalysis {
  monthlyMortgage: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  totalReturn: number;
  breakEvenMonths: number;
  roi: number;
  recommendation: string;
  projections: { year: number; equity: number; totalReturn: number }[];
}

function analyzeInvestment(input: InvestmentInput): InvestmentAnalysis {
  const { purchasePrice, downPayment, interestRate, loanTerm, monthlyRent, expenses } = input;
  const vacancyRate = input.vacancyRate || 0.05;
  const appreciationRate = input.appreciationRate || 0.03;
  const holdingPeriod = input.holdingPeriod || 5;

  const loanAmount = purchasePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;
  const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

  const effectiveRent = monthlyRent * (1 - vacancyRate);
  const monthlyCashFlow = effectiveRent - expenses - monthlyMortgage;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashReturn = (annualCashFlow / downPayment) * 100;
  const noi = (effectiveRent - expenses) * 12;
  const capRate = (noi / purchasePrice) * 100;

  const projections = [];
  let equity = downPayment;
  let totalReturn = 0;
  for (let year = 1; year <= holdingPeriod; year++) {
    const appreciation = purchasePrice * Math.pow(1 + appreciationRate, year) - purchasePrice;
    const accumulatedCashFlow = annualCashFlow * year;
    const loanPaydown = loanAmount - (loanAmount * ((Math.pow(1 + monthlyRate, numPayments) - Math.pow(1 + monthlyRate, year * 12)) / (Math.pow(1 + monthlyRate, numPayments) - 1)));
    equity = downPayment + appreciation + loanPaydown;
    totalReturn = accumulatedCashFlow + appreciation + loanPaydown;
    projections.push({ year, equity: Math.round(equity), totalReturn: Math.round(totalReturn) });
  }

  const roi = (totalReturn / downPayment) * 100;
  const breakEvenMonths = monthlyCashFlow > 0 ? Math.ceil(downPayment / monthlyCashFlow) : Infinity;

  let recommendation = 'neutral';
  if (cashOnCashReturn > 10 && capRate > 7) recommendation = 'strong_buy';
  else if (cashOnCashReturn > 6 && capRate > 5) recommendation = 'buy';
  else if (cashOnCashReturn < 2 || capRate < 3) recommendation = 'avoid';

  return {
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
    capRate: Math.round(capRate * 100) / 100,
    totalReturn: Math.round(totalReturn),
    breakEvenMonths: breakEvenMonths === Infinity ? -1 : breakEvenMonths,
    roi: Math.round(roi * 100) / 100,
    recommendation,
    projections,
  };
}

// ── POST /api/v1/ai/analyze-investment ──────────────────────────────────────
router.post('/analyze-investment', async (req: Request, res: Response) => {
  try {
    const input: InvestmentInput = req.body;
    if (!input.purchasePrice || !input.monthlyRent) {
      return res.status(400).json({ success: false, error: 'purchasePrice and monthlyRent are required' });
    }
    const result = analyzeInvestment(input);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── AI Rent Price Optimizer ─────────────────────────────────────────────────
interface RentOptimizerInput {
  address: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  amenities?: string[];
}

interface RentOptimizerResult {
  suggestedRent: number;
  range: { min: number; max: number };
  confidence: number;
  factors: string[];
  comparables: any[];
}

function optimizeRent(input: RentOptimizerInput): RentOptimizerResult {
  const CITY_MULTIPLIERS: Record<string, number> = {
    'new york': 3.5, 'los angeles': 2.8, 'san francisco': 3.8,
    'chicago': 1.8, 'miami': 2.2, 'houston': 1.5, 'phoenix': 1.6,
    'dallas': 1.6, 'atlanta': 1.5, 'seattle': 2.5, 'denver': 2.0, 'austin': 2.0,
  };
  const DEFAULT_MULTIPLIER = 1.5;

  const cityKey = input.city?.toLowerCase() || '';
  const multiplier = CITY_MULTIPLIERS[cityKey] || DEFAULT_MULTIPLIER;

  // Base rent calculation
  let baseRent = input.sqft * multiplier * 0.8;
  baseRent += input.bedrooms * 200;
  baseRent += input.bathrooms * 150;

  // Amenities bonus
  const amenities = input.amenities || [];
  if (amenities.includes('parking')) baseRent += 150;
  if (amenities.includes('laundry')) baseRent += 100;
  if (amenities.includes('gym')) baseRent += 100;
  if (amenities.includes('pool')) baseRent += 150;
  if (amenities.includes('doorman')) baseRent += 200;

  const suggestedRent = Math.round(baseRent);
  const range = { min: Math.round(suggestedRent * 0.9), max: Math.round(suggestedRent * 1.1) };

  const factors: string[] = [];
  factors.push(`Location: ${input.city}, ${input.state}`);
  factors.push(`Size: ${input.sqft.toLocaleString()} sqft, ${input.bedrooms}bd/${input.bathrooms}ba`);
  if (amenities.length > 0) factors.push(`Amenities: ${amenities.join(', ')}`);

  return {
    suggestedRent,
    range,
    confidence: CITY_MULTIPLIERS[cityKey] ? 75 : 55,
    factors,
    comparables: [],
  };
}

// ── POST /api/v1/ai/optimize-rent ───────────────────────────────────────────
router.post('/optimize-rent', async (req: Request, res: Response) => {
  try {
    const input: RentOptimizerInput = req.body;
    if (!input.city || !input.bedrooms || !input.sqft) {
      return res.status(400).json({ success: false, error: 'city, bedrooms, and sqft are required' });
    }
    const result = optimizeRent(input);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── AI Property Matcher ─────────────────────────────────────────────────────
interface MatcherInput {
  bedrooms?: number;
  bathrooms?: number;
  maxRent?: number;
  city?: string;
  state?: string;
  amenities?: string[];
}

interface MatcherResult {
  matches: any[];
  totalAvailable: number;
  matchScore: number;
}

// ── POST /api/v1/ai/match-properties ────────────────────────────────────────
router.post('/match-properties', async (req: Request, res: Response) => {
  try {
    const input: MatcherInput = req.body;
    const where: any = { status: 'VACANT' };
    if (input.city) where.city = { contains: input.city, mode: 'insensitive' };
    if (input.state) where.state = { contains: input.state, mode: 'insensitive' };
    if (input.bedrooms) where.bedrooms = { gte: input.bedrooms - 1, lte: input.bedrooms + 1 };
    if (input.bathrooms) where.bathrooms = { gte: input.bathrooms - 0.5, lte: input.bathrooms + 0.5 };
    if (input.maxRent) where.rentAmount = { lte: input.maxRent };

    const properties = await prisma.propertyManagerProperty.findMany({
      where,
      take: 20,
      include: { manager: { select: { companyName: true, slug: true } } },
    });

    const matches = properties.map((p: any) => ({
      id: p.id,
      title: p.title,
      address: p.address,
      city: p.city,
      state: p.state,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      rentAmount: p.rentAmount,
      manager: p.manager,
    }));

    res.json({ success: true, data: { matches, totalAvailable: properties.length, matchScore: properties.length > 0 ? 85 : 0 } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── AI Tenant Screener (profile analysis) ───────────────────────────────────
interface ScreenerInput {
  name: string;
  email: string;
  phone?: string;
  monthlyIncome: number;
  employmentStatus: string;
  creditScore?: number;
  evictionHistory?: boolean;
  criminalHistory?: boolean;
  references?: number;
}

interface ScreenerResult {
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  factors: string[];
  risks: string[];
  incomeToRentRatio: number;
}

function screenTenant(input: ScreenerInput, monthlyRent: number = 1500): ScreenerResult {
  let score = 70;
  const factors: string[] = [];
  const risks: string[] = [];

  // Income analysis
  const incomeToRentRatio = input.monthlyIncome / monthlyRent;
  if (incomeToRentRatio >= 3) {
    score += 15;
    factors.push(`Strong income ratio: ${incomeToRentRatio.toFixed(1)}x rent`);
  } else if (incomeToRentRatio >= 2.5) {
    score += 5;
    factors.push(`Adequate income ratio: ${incomeToRentRatio.toFixed(1)}x rent`);
  } else if (incomeToRentRatio < 2) {
    score -= 20;
    risks.push(`Low income ratio: ${incomeToRentRatio.toFixed(1)}x rent (recommended: 3x)`);
  }

  // Credit score
  if (input.creditScore) {
    if (input.creditScore >= 700) { score += 10; factors.push('Good credit score'); }
    else if (input.creditScore >= 600) { score += 0; factors.push('Fair credit score'); }
    else { score -= 15; risks.push('Below-average credit score'); }
  }

  // Employment
  if (input.employmentStatus === 'employed') { score += 5; factors.push('Employed'); }
  else if (input.employmentStatus === 'self-employed') { score += 0; factors.push('Self-employed'); }
  else { score -= 10; risks.push('Unemployment or unstable income'); }

  // History
  if (input.evictionHistory) { score -= 25; risks.push('Prior eviction on record'); }
  if (input.criminalHistory) { score -= 15; risks.push('Criminal history reported'); }

  // References
  if (input.references && input.references >= 2) { score += 5; factors.push('Multiple references provided'); }

  score = Math.max(0, Math.min(100, score));
  const band = score >= 75 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH';
  const recommendation = score >= 75 ? 'Approve' : score >= 50 ? 'Review manually' : 'Decline';

  return { score, band, recommendation, factors, risks, incomeToRentRatio: Math.round(incomeToRentRatio * 100) / 100 };
}

// ── POST /api/v1/ai/screen-tenant ───────────────────────────────────────────
router.post('/screen-tenant', async (req: Request, res: Response) => {
  try {
    const { monthlyRent, ...tenantInfo } = req.body;
    if (!tenantInfo.name || !tenantInfo.email || !tenantInfo.monthlyIncome) {
      return res.status(400).json({ success: false, error: 'name, email, and monthlyIncome are required' });
    }
    const result = screenTenant(tenantInfo, monthlyRent);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── AI Listing Description Writer ───────────────────────────────────────────
interface ListingWriterInput {
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  city: string;
  state: string;
  amenities: string[];
  tone?: 'professional' | 'casual' | 'luxury';
}

function generateListingDescription(input: ListingWriterInput): string {
  const tone = input.tone || 'professional';
  const amenitiesList = input.amenities.length > 0 ? input.amenities.join(', ') : 'modern finishes';

  const intros: Record<string, string> = {
    professional: `Welcome to this beautifully maintained ${input.bedrooms}-bedroom, ${input.bathrooms}-bathroom ${input.propertyType} in ${input.city}, ${input.state}.`,
    casual: `Check out this awesome ${input.bedrooms}bd/${input.bathrooms}ba ${input.propertyType} in ${input.city}!`,
    luxury: `Exceptional ${input.propertyType} residence offering ${input.bedrooms} bedrooms and ${input.bathrooms} bathrooms in prestigious ${input.city}, ${input.state}.`,
  };

  const sizeLine = `Spanning ${input.sqft.toLocaleString()} square feet, this property offers comfortable living space.`;
  const amenitiesLine = `Featuring ${amenitiesList}.`;
  const locationLine = `Located in ${input.city}, ${input.state} — close to shopping, dining, and transportation.`;

  return `${intros[tone]}\n\n${sizeLine}\n\n${amenitiesLine}\n\n${locationLine}\n\nSchedule a showing today!`;
}

// ── POST /api/v1/ai/generate-listing ────────────────────────────────────────
router.post('/generate-listing', async (req: Request, res: Response) => {
  try {
    const input: ListingWriterInput = req.body;
    if (!input.propertyType || !input.bedrooms || !input.city) {
      return res.status(400).json({ success: false, error: 'propertyType, bedrooms, and city are required' });
    }
    const description = generateListingDescription(input);
    res.json({ success: true, data: { description } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;

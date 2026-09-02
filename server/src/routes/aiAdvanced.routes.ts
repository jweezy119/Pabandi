import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ──────────────────────────────────────────────────────────────────────────
// 1. ENHANCED PROPERTY INTELLIGENCE
//    Neighborhood scoring, price velocity, predictive analytics
// ──────────────────────────────────────────────────────────────────────────

interface PropertyIntelligenceInput {
  address: string;
  city: string;
  state: string;
  zip?: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt?: number;
  propertyType?: string;
  lotSize?: number;
  hasGarage?: boolean;
  hasPool?: boolean;
  condition?: string;
}

interface NeighborhoodScore {
  overall: number;
  schools: number;
  safety: number;
  walkability: number;
  transit: number;
  amenities: number;
  appreciationTrend: number;
  rentalDemand: number;
  vacancyRate: number;
  medianIncome: number;
  populationGrowth: number;
  factors: string[];
}

interface PriceVelocity {
  monthlyChange: number;
  yearlyChange: number;
  momentum: 'accelerating' | 'stable' | 'decelerating';
  daysOnMarket: number;
  listToSaleRatio: number;
  inventoryMonths: number;
}

interface PropertyIntelligenceResult {
  valuation: {
    estimatedValue: number;
    valuePerSqft: number;
    confidence: number;
    range: { low: number; high: number };
    rentalEstimate: number;
    rentalYield: number;
  };
  neighborhood: NeighborhoodScore;
  priceVelocity: PriceVelocity;
  predictions: {
    value1Year: number;
    value3Year: number;
    value5Year: number;
    rent1Year: number;
    rent3Year: number;
    rent5Year: number;
  };
  comparables: any[];
  risks: string[];
  opportunities: string[];
  investmentScore: number;
}

// City-level data for intelligence
const CITY_INTELLIGENCE: Record<string, {
  medianIncome: number;
  populationGrowth: number;
  vacancyRate: number;
  walkScore: number;
  transitScore: number;
  schoolScore: number;
  safetyScore: number;
  appreciationRate: number;
  daysOnMarket: number;
  inventoryMonths: number;
}> = {
  'chicago': { medianIncome: 62000, populationGrowth: 0.004, vacancyRate: 0.08, walkScore: 77, transitScore: 65, schoolScore: 55, safetyScore: 45, appreciationRate: 0.04, daysOnMarket: 45, inventoryMonths: 3.2 },
  'new york': { medianIncome: 67000, populationGrowth: 0.005, vacancyRate: 0.05, walkScore: 88, transitScore: 85, schoolScore: 60, safetyScore: 55, appreciationRate: 0.05, daysOnMarket: 60, inventoryMonths: 4.5 },
  'los angeles': { medianIncome: 65000, populationGrowth: 0.003, vacancyRate: 0.06, walkScore: 69, transitScore: 50, schoolScore: 50, safetyScore: 50, appreciationRate: 0.06, daysOnMarket: 40, inventoryMonths: 2.8 },
  'houston': { medianIncome: 55000, populationGrowth: 0.012, vacancyRate: 0.10, walkScore: 48, transitScore: 35, schoolScore: 45, safetyScore: 40, appreciationRate: 0.05, daysOnMarket: 35, inventoryMonths: 2.5 },
  'phoenix': { medianIncome: 58000, populationGrowth: 0.015, vacancyRate: 0.09, walkScore: 41, transitScore: 30, schoolScore: 40, safetyScore: 45, appreciationRate: 0.07, daysOnMarket: 30, inventoryMonths: 2.2 },
  'miami': { medianIncome: 52000, populationGrowth: 0.008, vacancyRate: 0.07, walkScore: 76, transitScore: 55, schoolScore: 45, safetyScore: 40, appreciationRate: 0.08, daysOnMarket: 55, inventoryMonths: 5.0 },
  'dallas': { medianIncome: 60000, populationGrowth: 0.011, vacancyRate: 0.09, walkScore: 46, transitScore: 35, schoolScore: 50, safetyScore: 45, appreciationRate: 0.06, daysOnMarket: 32, inventoryMonths: 2.4 },
  'atlanta': { medianIncome: 59000, populationGrowth: 0.010, vacancyRate: 0.08, walkScore: 48, transitScore: 40, schoolScore: 50, safetyScore: 40, appreciationRate: 0.06, daysOnMarket: 33, inventoryMonths: 2.3 },
  'seattle': { medianIncome: 95000, populationGrowth: 0.008, vacancyRate: 0.05, walkScore: 74, transitScore: 60, schoolScore: 65, safetyScore: 55, appreciationRate: 0.05, daysOnMarket: 25, inventoryMonths: 1.8 },
  'denver': { medianIncome: 72000, populationGrowth: 0.009, vacancyRate: 0.06, walkScore: 61, transitScore: 45, schoolScore: 55, safetyScore: 55, appreciationRate: 0.05, daysOnMarket: 28, inventoryMonths: 2.0 },
  'austin': { medianIncome: 71000, populationGrowth: 0.018, vacancyRate: 0.07, walkScore: 42, transitScore: 35, schoolScore: 55, safetyScore: 55, appreciationRate: 0.08, daysOnMarket: 30, inventoryMonths: 2.1 },
  'san francisco': { medianIncome: 112000, populationGrowth: 0.002, vacancyRate: 0.04, walkScore: 87, transitScore: 80, schoolScore: 65, safetyScore: 50, appreciationRate: 0.04, daysOnMarket: 35, inventoryMonths: 2.5 },
};

const DEFAULT_CITY = { medianIncome: 55000, populationGrowth: 0.005, vacancyRate: 0.08, walkScore: 50, transitScore: 40, schoolScore: 50, safetyScore: 50, appreciationRate: 0.04, daysOnMarket: 40, inventoryMonths: 3.0 };

function analyzePropertyIntelligence(input: PropertyIntelligenceInput): PropertyIntelligenceResult {
  const cityKey = input.city?.toLowerCase() || '';
  const cityData = CITY_INTELLIGENCE[cityKey] || DEFAULT_CITY;

  // ── Valuation ──
  const CITY_TIERS: Record<string, { basePrice: number; rentalMultiplier: number }> = {
    'new york': { basePrice: 800, rentalMultiplier: 0.008 },
    'los angeles': { basePrice: 650, rentalMultiplier: 0.007 },
    'san francisco': { basePrice: 900, rentalMultiplier: 0.006 },
    'chicago': { basePrice: 250, rentalMultiplier: 0.009 },
    'miami': { basePrice: 400, rentalMultiplier: 0.008 },
    'houston': { basePrice: 180, rentalMultiplier: 0.01 },
    'phoenix': { basePrice: 220, rentalMultiplier: 0.009 },
    'dallas': { basePrice: 200, rentalMultiplier: 0.009 },
    'atlanta': { basePrice: 190, rentalMultiplier: 0.01 },
    'seattle': { basePrice: 550, rentalMultiplier: 0.007 },
    'denver': { basePrice: 350, rentalMultiplier: 0.008 },
    'austin': { basePrice: 300, rentalMultiplier: 0.008 },
  };
  const tier = CITY_TIERS[cityKey] || { basePrice: 200, rentalMultiplier: 0.009 };

  let baseValue = input.sqft * tier.basePrice;
  baseValue += Math.max(0, input.bedrooms - 2) * 15000;
  baseValue += Math.max(0, input.bathrooms - 1) * 10000;

  if (input.yearBuilt) {
    const age = new Date().getFullYear() - input.yearBuilt;
    if (age > 50) baseValue *= 0.85;
    else if (age > 30) baseValue *= 0.92;
    else if (age > 15) baseValue *= 0.97;
    else if (age <= 5) baseValue *= 1.05;
  }

  const conditionMultipliers: Record<string, number> = { excellent: 1.1, good: 1.0, fair: 0.9, poor: 0.75 };
  baseValue *= input.condition ? (conditionMultipliers[input.condition] || 1) : 1;
  if (input.hasGarage) baseValue += 15000;
  if (input.hasPool) baseValue += 25000;

  const typeMultipliers: Record<string, number> = { single_family: 1.0, condo: 0.9, townhouse: 0.95, multi_family: 1.2 };
  baseValue *= input.propertyType ? (typeMultipliers[input.propertyType] || 1) : 1;

  const rentalEstimate = baseValue * tier.rentalMultiplier;
  const rentalYield = (rentalEstimate * 12) / baseValue;

  // ── Neighborhood Score ──
  const neighborhood: NeighborhoodScore = {
    overall: Math.round((cityData.walkScore + cityData.transitScore + cityData.schoolScore + cityData.safetyScore) / 4),
    schools: cityData.schoolScore,
    safety: cityData.safetyScore,
    walkability: cityData.walkScore,
    transit: cityData.transitScore,
    amenities: Math.round((cityData.walkScore + cityData.transitScore) / 2),
    appreciationTrend: Math.round(cityData.appreciationRate * 10000) / 100,
    rentalDemand: Math.round((1 - cityData.vacancyRate) * 100),
    vacancyRate: Math.round(cityData.vacancyRate * 10000) / 100,
    medianIncome: cityData.medianIncome,
    populationGrowth: Math.round(cityData.populationGrowth * 10000) / 100,
    factors: [],
  };

  if (neighborhood.schools >= 60) neighborhood.factors.push('Above-average schools');
  if (neighborhood.walkability >= 70) neighborhood.factors.push('Highly walkable');
  if (neighborhood.transit >= 60) neighborhood.factors.push('Good transit access');
  if (neighborhood.safety >= 55) neighborhood.factors.push('Above-average safety');
  if (cityData.populationGrowth > 0.01) neighborhood.factors.push('Fast-growing population');
  if (cityData.vacancyRate < 0.06) neighborhood.factors.push('Low vacancy — high demand');

  // ── Price Velocity ──
  const priceVelocity: PriceVelocity = {
    monthlyChange: Math.round(cityData.appreciationRate / 12 * 10000) / 100,
    yearlyChange: Math.round(cityData.appreciationRate * 10000) / 100,
    momentum: cityData.appreciationRate > 0.06 ? 'accelerating' : cityData.appreciationRate > 0.03 ? 'stable' : 'decelerating',
    daysOnMarket: cityData.daysOnMarket,
    listToSaleRatio: Math.round((0.95 + Math.random() * 0.05) * 100) / 100,
    inventoryMonths: cityData.inventoryMonths,
  };

  // ── Predictions ──
  const predictions = {
    value1Year: Math.round(baseValue * (1 + cityData.appreciationRate)),
    value3Year: Math.round(baseValue * Math.pow(1 + cityData.appreciationRate, 3)),
    value5Year: Math.round(baseValue * Math.pow(1 + cityData.appreciationRate, 5)),
    rent1Year: Math.round(rentalEstimate * (1 + cityData.appreciationRate * 0.8)),
    rent3Year: Math.round(rentalEstimate * Math.pow(1 + cityData.appreciationRate * 0.8, 3)),
    rent5Year: Math.round(rentalEstimate * Math.pow(1 + cityData.appreciationRate * 0.8, 5)),
  };

  // ── Investment Score ──
  let investmentScore = 50;
  if (rentalYield > 0.08) investmentScore += 15;
  else if (rentalYield > 0.06) investmentScore += 8;
  if (cityData.appreciationRate > 0.06) investmentScore += 10;
  if (neighborhood.rentalDemand > 92) investmentScore += 10;
  if (cityData.vacancyRate < 0.06) investmentScore += 5;
  if (neighborhood.schools >= 60) investmentScore += 5;
  if (neighborhood.walkability >= 70) investmentScore += 5;
  investmentScore = Math.max(0, Math.min(100, investmentScore));

  // ── Risks & Opportunities ──
  const risks: string[] = [];
  if (cityData.vacancyRate > 0.08) risks.push('High vacancy rate — may be hard to find tenants');
  if (cityData.appreciationRate < 0.03) risks.push('Low appreciation market');
  if (neighborhood.safety < 45) risks.push('Below-average safety score');
  if (input.yearBuilt && input.yearBuilt < 1990) risks.push('Older property — potential maintenance costs');
  if (cityData.inventoryMonths > 4) risks.push('High inventory — buyer\'s market');

  const opportunities: string[] = [];
  if (cityData.populationGrowth > 0.01) opportunities.push('Fast-growing area — increasing demand');
  if (cityData.vacancyRate < 0.06) opportunities.push('Low vacancy — strong rental demand');
  if (neighborhood.walkability >= 70) opportunities.push('Walkable area commands premium rent');
  if (cityData.appreciationRate > 0.06) opportunities.push('Strong appreciation trend');
  if (input.propertyType === 'multi_family') opportunities.push('Multiple income streams reduce risk');

  return {
    valuation: {
      estimatedValue: Math.round(baseValue),
      valuePerSqft: Math.round(baseValue / input.sqft),
      confidence: CITY_TIERS[cityKey] ? 80 : 60,
      range: { low: Math.round(baseValue * 0.9), high: Math.round(baseValue * 1.1) },
      rentalEstimate: Math.round(rentalEstimate),
      rentalYield: Math.round(rentalYield * 10000) / 100,
    },
    neighborhood,
    priceVelocity,
    predictions,
    comparables: [],
    risks,
    opportunities,
    investmentScore,
  };
}

router.post('/property-intelligence', async (req: Request, res: Response) => {
  try {
    const input: PropertyIntelligenceInput = req.body;
    if (!input.city || !input.state || !input.sqft || !input.bedrooms) {
      return res.status(400).json({ success: false, error: 'city, state, sqft, bedrooms required' });
    }
    const result = analyzePropertyIntelligence(input);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 2. INVESTMENT SCENARIO PLANNER
//    What-if analysis, sensitivity tables, side-by-side comparisons
// ──────────────────────────────────────────────────────────────────────────

interface ScenarioInput {
  purchasePrice: number;
  downPayment: number;
  interestRate: number;
  loanTerm: number;
  monthlyRent: number;
  monthlyExpenses: number;
  vacancyRate?: number;
  appreciationRate?: number;
  holdingPeriod?: number;
}

interface ScenarioResult {
  id: string;
  name: string;
  monthlyMortgage: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  totalReturn: number;
  roi: number;
  breakEvenMonths: number;
  dscr: number; // Debt service coverage ratio
  projections: { year: number; equity: number; totalReturn: number; cashFlow: number }[];
}

interface ScenarioPlannerResult {
  scenarios: ScenarioResult[];
  sensitivity: {
    rentChange: number[];
    valueChange: number[];
    cashFlowImpact: number[];
  };
  recommendation: string;
}

function planScenarios(input: ScenarioInput): ScenarioPlannerResult {
  const baseDownPct = input.downPayment / input.purchasePrice;

  // Generate 3 scenarios: conservative, base, optimistic
  const scenarios: ScenarioResult[] = [];

  const variations = [
    { name: 'Conservative', rentMult: 0.9, expMult: 1.1, appMult: 0.7 },
    { name: 'Base Case', rentMult: 1.0, expMult: 1.0, appMult: 1.0 },
    { name: 'Optimistic', rentMult: 1.1, expMult: 0.9, appMult: 1.3 },
  ];

  for (const v of variations) {
    const rent = input.monthlyRent * v.rentMult;
    const expenses = input.monthlyExpenses * v.expMult;
    const appreciation = (input.appreciationRate || 0.03) * v.appMult;
    const holdingPeriod = input.holdingPeriod || 5;

    const loanAmount = input.purchasePrice - input.downPayment;
    const monthlyRate = input.interestRate / 100 / 12;
    const numPayments = input.loanTerm * 12;
    const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

    const effectiveRent = rent * (1 - (input.vacancyRate || 0.05));
    const monthlyCashFlow = effectiveRent - expenses - monthlyMortgage;
    const annualCashFlow = monthlyCashFlow * 12;
    const cashOnCashReturn = (annualCashFlow / input.downPayment) * 100;
    const noi = (effectiveRent - expenses) * 12;
    const capRate = (noi / input.purchasePrice) * 100;

    const projections = [];
    let equity = input.downPayment;
    let totalReturn = 0;
    for (let year = 1; year <= holdingPeriod; year++) {
      const appreciationGain = input.purchasePrice * Math.pow(1 + appreciation, year) - input.purchasePrice;
      const accumulatedCashFlow = annualCashFlow * year;
      const remainingLoan = loanAmount * ((Math.pow(1 + monthlyRate, numPayments) - Math.pow(1 + monthlyRate, year * 12)) / (Math.pow(1 + monthlyRate, numPayments) - 1));
      equity = input.downPayment + appreciationGain + (loanAmount - remainingLoan);
      totalReturn = accumulatedCashFlow + appreciationGain + (loanAmount - remainingLoan);
      projections.push({ year, equity: Math.round(equity), totalReturn: Math.round(totalReturn), cashFlow: Math.round(annualCashFlow) });
    }

    const roi = (totalReturn / input.downPayment) * 100;
    const breakEvenMonths = monthlyCashFlow > 0 ? Math.ceil(input.downPayment / monthlyCashFlow) : Infinity;
    const dscr = (effectiveRent - expenses) / monthlyMortgage;

    scenarios.push({
      id: v.name.toLowerCase().replace(' ', '_'),
      name: v.name,
      monthlyMortgage: Math.round(monthlyMortgage),
      monthlyCashFlow: Math.round(monthlyCashFlow),
      annualCashFlow: Math.round(annualCashFlow),
      cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
      capRate: Math.round(capRate * 100) / 100,
      totalReturn: Math.round(totalReturn),
      roi: Math.round(roi * 100) / 100,
      breakEvenMonths: breakEvenMonths === Infinity ? -1 : breakEvenMonths,
      dscr: Math.round(dscr * 100) / 100,
      projections,
    });
  }

  // Sensitivity analysis
  const rentChanges = [-10, -5, 0, 5, 10];
  const sensitivity = {
    rentChange: rentChanges,
    valueChange: rentChanges.map((r) => Math.round((input.monthlyRent * (1 + r / 100) * 12) / (input.purchasePrice * 0.06) * 100 - 100)),
    cashFlowImpact: rentChanges.map((r) => Math.round(input.monthlyRent * (r / 100) * 12)),
  };

  const baseScenario = scenarios[1];
  let recommendation = 'neutral';
  if (baseScenario.cashOnCashReturn > 10 && baseScenario.dscr > 1.25) recommendation = 'strong_buy';
  else if (baseScenario.cashOnCashReturn > 6 && baseScenario.dscr > 1.0) recommendation = 'buy';
  else if (baseScenario.cashOnCashReturn < 2 || baseScenario.dscr < 0.8) recommendation = 'avoid';

  return { scenarios, sensitivity, recommendation };
}

router.post('/scenario-planner', async (req: Request, res: Response) => {
  try {
    const input: ScenarioInput = req.body;
    if (!input.purchasePrice || !input.monthlyRent) {
      return res.status(400).json({ success: false, error: 'purchasePrice and monthlyRent required' });
    }
    const result = planScenarios(input);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 3. PORTFOLIO ANALYZER
//    Diversification, aggregate metrics, benchmarking
// ──────────────────────────────────────────────────────────────────────────

interface PortfolioProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  purchasePrice: number;
  currentValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
  mortgage: number;
  type: string;
  acquisitionDate: string;
}

interface PortfolioResult {
  summary: {
    totalValue: number;
    totalEquity: number;
    totalDebt: number;
    totalAnnualIncome: number;
    totalAnnualExpenses: number;
    netOperatingIncome: number;
    cashOnCashReturn: number;
    capRate: number;
    weightedDscr: number;
  };
  diversification: {
    byType: Record<string, number>;
    byLocation: Record<string, number>;
    byValue: Record<string, number>;
    score: number;
    recommendations: string[];
  };
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    bestPerformer: string;
    worstPerformer: string;
    incomeGrowth: number;
  };
  benchmarking: {
    vsMarket: number;
    vsREIT: number;
    vsSavings: number;
    percentile: number;
  };
  risk: {
    concentrationRisk: number;
    vacancyRisk: number;
    leverageRisk: number;
    overallRisk: number;
    recommendations: string[];
  };
}

function analyzePortfolio(properties: PortfolioProperty[]): PortfolioResult {
  const totalValue = properties.reduce((s, p) => s + p.currentValue, 0);
  const totalDebt = properties.reduce((s, p) => s + (p.mortgage || 0), 0);
  const totalEquity = totalValue - totalDebt;
  const totalAnnualIncome = properties.reduce((s, p) => s + p.monthlyRent * 12, 0);
  const totalAnnualExpenses = properties.reduce((s, p) => s + (p.monthlyExpenses + (p.mortgage || 0) * 12), 0);
  const netOperatingIncome = totalAnnualIncome - totalAnnualExpenses;
  const totalInvested = properties.reduce((s, p) => s + (p.purchasePrice * 0.2), 0); // assume 20% down
  const cashOnCashReturn = (netOperatingIncome / totalInvested) * 100;
  const capRate = (netOperatingIncome / totalValue) * 100;

  // DSCR
  const totalDebtService = properties.reduce((s, p) => s + (p.mortgage || 0) * 12, 0);
  const weightedDscr = totalDebtService > 0 ? (totalAnnualIncome - totalAnnualExpenses + totalDebtService) / totalDebtService : 0;

  // Diversification
  const byType: Record<string, number> = {};
  const byLocation: Record<string, number> = {};
  const byValue: Record<string, number> = {};
  for (const p of properties) {
    byType[p.type] = (byType[p.type] || 0) + p.currentValue;
    const loc = `${p.city}, ${p.state}`;
    byLocation[loc] = (byLocation[loc] || 0) + p.currentValue;
    const valueTier = p.currentValue > 500000 ? 'high' : p.currentValue > 200000 ? 'mid' : 'low';
    byValue[valueTier] = (byValue[valueTier] || 0) + p.currentValue;
  }

  // Normalize to percentages
  for (const k of Object.keys(byType)) byType[k] = Math.round((byType[k] / totalValue) * 100);
  for (const k of Object.keys(byLocation)) byLocation[k] = Math.round((byLocation[k] / totalValue) * 100);
  for (const k of Object.keys(byValue)) byValue[k] = Math.round((byValue[k] / totalValue) * 100);

  // Diversification score
  const typeEntropy = Object.values(byType).reduce((s, v) => s + (v / 100) * Math.log2(100 / v || 1), 0);
  const locEntropy = Object.values(byLocation).reduce((s, v) => s + (v / 100) * Math.log2(100 / v || 1), 0);
  const diversificationScore = Math.round(((typeEntropy + locEntropy) / 2) * 25);

  const diversificationRecs: string[] = [];
  if (Object.values(byType).some((v) => v > 60)) diversificationRecs.push('Over-concentrated in one property type — diversify');
  if (Object.values(byLocation).some((v) => v > 50)) diversificationRecs.push('Geographic concentration risk — expand to new markets');
  if (Object.keys(byLocation).length < 3) diversificationRecs.push('Consider expanding to additional markets');

  // Performance
  const totalReturn = properties.reduce((s, p) => s + (p.currentValue - p.purchasePrice), 0);
  const annualizedReturn = Math.pow((totalValue + netOperatingIncome) / (totalValue - totalReturn), 1 / 5) - 1;

  const sortedByROI = [...properties].sort((a, b) => ((b.currentValue - b.purchasePrice) / b.purchasePrice) - ((a.currentValue - a.purchasePrice) / a.purchasePrice));

  // Risk
  const maxLocConcentration = Math.max(...Object.values(byLocation));
  const avgVacancyRate = 0.08;
  const avgLtv = totalDebt / totalValue;

  const concentrationRisk = Math.min(100, maxLocConcentration * 1.5);
  const vacancyRisk = Math.round(avgVacancyRate * 100 * 10) / 10;
  const leverageRisk = Math.min(100, avgLtv * 150);
  const overallRisk = Math.round((concentrationRisk + vacancyRisk * 5 + leverageRisk) / 3);

  const riskRecs: string[] = [];
  if (maxLocConcentration > 50) riskRecs.push('High geographic concentration');
  if (avgLtv > 0.7) riskRecs.push('High leverage — consider paying down debt');
  if (properties.length < 3) riskRecs.push('Small portfolio — diversify to reduce idiosyncratic risk');

  return {
    summary: {
      totalValue: Math.round(totalValue),
      totalEquity: Math.round(totalEquity),
      totalDebt: Math.round(totalDebt),
      totalAnnualIncome: Math.round(totalAnnualIncome),
      totalAnnualExpenses: Math.round(totalAnnualExpenses),
      netOperatingIncome: Math.round(netOperatingIncome),
      cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
      capRate: Math.round(capRate * 100) / 100,
      weightedDscr: Math.round(weightedDscr * 100) / 100,
    },
    diversification: {
      byType,
      byLocation,
      byValue,
      score: Math.min(100, diversificationScore),
      recommendations: diversificationRecs,
    },
    performance: {
      totalReturn: Math.round(totalReturn),
      annualizedReturn: Math.round(annualizedReturn * 10000) / 100,
      bestPerformer: sortedByROI[0]?.address || 'N/A',
      worstPerformer: sortedByROI[sortedByROI.length - 1]?.address || 'N/A',
      incomeGrowth: Math.round((annualizedReturn - 0.03) * 10000) / 100,
    },
    benchmarking: {
      vsMarket: Math.round((annualizedReturn - 0.06) * 10000) / 100,
      vsREIT: Math.round((annualizedReturn - 0.08) * 10000) / 100,
      vsSavings: Math.round((annualizedReturn - 0.045) * 10000) / 100,
      percentile: Math.min(99, Math.max(1, Math.round(50 + (annualizedReturn - 0.06) * 500))),
    },
    risk: {
      concentrationRisk: Math.round(concentrationRisk),
      vacancyRisk,
      leverageRisk: Math.round(leverageRisk),
      overallRisk,
      recommendations: riskRecs,
    },
  };
}

router.post('/portfolio-analyzer', async (req: Request, res: Response) => {
  try {
    const { properties } = req.body;
    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return res.status(400).json({ success: false, error: 'properties array required' });
    }
    const result = analyzePortfolio(properties);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 4. ADVANCED TENANT INTELLIGENCE
//    Employment stability, behavioral patterns, custom risk models
// ──────────────────────────────────────────────────────────────────────────

interface TenantIntelInput {
  name: string;
  email: string;
  phone?: string;
  monthlyIncome: number;
  employmentStatus: string;
  employmentLength?: number; // months
  employer?: string;
  creditScore?: number;
  evictionHistory?: boolean;
  criminalHistory?: boolean;
  references?: number;
  previousLandlord?: string;
  debtToIncome?: number;
  savingsMonths?: number;
  monthlyRent: number;
}

interface TenantIntelligenceResult {
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  incomeAnalysis: {
    incomeToRentRatio: number;
    stabilityScore: number;
    employmentRisk: string;
    sufficient: boolean;
  };
  creditAnalysis: {
    score: number;
    riskLevel: string;
    paymentHistory: string;
    debtBurden: string;
  };
  behavioralRisk: {
    evictionRisk: string;
    criminalRisk: string;
    referenceStrength: string;
    overall: string;
  };
  financialResilience: {
    monthsOfReserve: number;
    canHandleEmergency: boolean;
    stressTest: string;
  };
  factors: string[];
  risks: string[];
  suggestions: string[];
}

function analyzeTenantIntelligence(input: TenantIntelInput): TenantIntelligenceResult {
  const incomeToRentRatio = input.monthlyIncome / input.monthlyRent;

  // Income stability
  let stabilityScore = 50;
  if (input.employmentLength) {
    if (input.employmentLength >= 24) stabilityScore += 25;
    else if (input.employmentLength >= 12) stabilityScore += 15;
    else if (input.employmentLength >= 6) stabilityScore += 5;
    else stabilityScore -= 10;
  }
  if (input.employmentStatus === 'employed') stabilityScore += 10;
  else if (input.employmentStatus === 'self-employed') stabilityScore += 0;
  else if (input.employmentStatus === 'unemployed') stabilityScore -= 30;

  const employmentRisk = stabilityScore >= 70 ? 'low' : stabilityScore >= 40 ? 'medium' : 'high';

  // Credit analysis
  let creditScore = 580;
  let creditRisk = 'high';
  let paymentHistory = 'Unknown';
  let debtBurden = 'Unknown';

  if (input.creditScore) {
    creditScore = input.creditScore;
    if (input.creditScore >= 740) { creditRisk = 'very_low'; paymentHistory = 'Excellent'; debtBurden = 'Low'; }
    else if (input.creditScore >= 670) { creditRisk = 'low'; paymentHistory = 'Good'; debtBurden = 'Moderate'; }
    else if (input.creditScore >= 580) { creditRisk = 'medium'; paymentHistory = 'Fair'; debtBurden = 'Moderate'; }
    else { creditRisk = 'high'; paymentHistory = 'Poor'; debtBurden = 'High'; }
  }

  if (input.debtToIncome) {
    if (input.debtToIncome > 0.43) debtBurden = 'Very High';
    else if (input.debtToIncome > 0.36) debtBurden = 'High';
    else if (input.debtToIncome > 0.20) debtBurden = 'Moderate';
    else debtBurden = 'Low';
  }

  // Behavioral risk
  const evictionRisk = input.evictionHistory ? 'HIGH — Prior eviction on record' : 'LOW — No prior evictions';
  const criminalRisk = input.criminalHistory ? 'MEDIUM — Criminal history reported' : 'LOW — No criminal history';
  const referenceStrength = input.references && input.references >= 2 ? 'STRONG' : input.references === 1 ? 'ADEQUATE' : 'WEAK — No references provided';

  // Financial resilience
  const monthsOfReserve = input.savingsMonths || Math.round((input.monthlyIncome - input.monthlyRent) / input.monthlyRent);
  const canHandleEmergency = monthsOfReserve >= 3;
  const stressTest = monthsOfReserve >= 6 ? 'Can handle 6+ months without income' :
    monthsOfReserve >= 3 ? 'Can handle 3-6 months without income' :
    monthsOfReserve >= 1 ? 'Can handle 1-3 months without income' : 'Vulnerable — less than 1 month reserve';

  // Overall score
  let score = 60;
  if (incomeToRentRatio >= 3) score += 15;
  else if (incomeToRentRatio >= 2.5) score += 5;
  else if (incomeToRentRatio < 2) score -= 20;

  if (input.creditScore) {
    if (input.creditScore >= 700) score += 15;
    else if (input.creditScore >= 600) score += 5;
    else score -= 15;
  }

  if (input.evictionHistory) score -= 25;
  if (input.criminalHistory) score -= 10;
  if (input.references && input.references >= 2) score += 5;
  if (monthsOfReserve >= 3) score += 5;
  if (input.employmentLength && input.employmentLength >= 12) score += 5;

  score = Math.max(0, Math.min(100, score));
  const band = score >= 75 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH';
  const recommendation = score >= 75 ? 'Approve' : score >= 50 ? 'Review manually — consider additional requirements' : 'Decline or require guarantor';

  const factors: string[] = [];
  if (incomeToRentRatio >= 3) factors.push(`Strong income ratio: ${incomeToRentRatio.toFixed(1)}x rent`);
  if (input.employmentLength && input.employmentLength >= 12) factors.push(`Stable employment: ${input.employmentLength} months`);
  if (input.creditScore && input.creditScore >= 670) factors.push('Good credit history');
  if (monthsOfReserve >= 3) factors.push(`Financial reserve: ${monthsOfReserve} months`);
  if (input.references && input.references >= 2) factors.push('Multiple references provided');

  const risks: string[] = [];
  if (incomeToRentRatio < 2.5) risks.push(`Low income ratio: ${incomeToRentRatio.toFixed(1)}x rent (recommended: 3x)`);
  if (input.creditScore && input.creditScore < 600) risks.push('Below-average credit score');
  if (input.evictionHistory) risks.push('Prior eviction on record');
  if (monthsOfReserve < 3) risks.push('Limited financial reserve');
  if (input.employmentLength && input.employmentLength < 6) risks.push('Short employment tenure');

  const suggestions: string[] = [];
  if (incomeToRentRatio < 3) suggestions.push('Consider requiring a larger security deposit');
  if (input.creditScore && input.creditScore < 600) suggestions.push('Request a co-signer or guarantor');
  if (monthsOfReserve < 3) suggestions.push('Require proof of savings or prepaid rent');
  if (!input.references || input.references < 2) suggestions.push('Request additional references');

  return {
    score,
    band,
    recommendation,
    incomeAnalysis: {
      incomeToRentRatio: Math.round(incomeToRentRatio * 100) / 100,
      stabilityScore: Math.min(100, stabilityScore),
      employmentRisk,
      sufficient: incomeToRentRatio >= 2.5,
    },
    creditAnalysis: {
      score: creditScore,
      riskLevel: creditRisk,
      paymentHistory,
      debtBurden,
    },
    behavioralRisk: {
      evictionRisk,
      criminalRisk,
      referenceStrength,
      overall: score >= 70 ? 'LOW' : score >= 40 ? 'MEDIUM' : 'HIGH',
    },
    financialResilience: {
      monthsOfReserve,
      canHandleEmergency,
      stressTest,
    },
    factors,
    risks,
    suggestions,
  };
}

router.post('/tenant-intelligence', async (req: Request, res: Response) => {
  try {
    const input: TenantIntelInput = req.body;
    if (!input.name || !input.email || !input.monthlyIncome || !input.monthlyRent) {
      return res.status(400).json({ success: false, error: 'name, email, monthlyIncome, monthlyRent required' });
    }
    const result = analyzeTenantIntelligence(input);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 5. MARKET INTELLIGENCE ENGINE
//    Supply/demand scoring, trend forecasting, seasonality
// ──────────────────────────────────────────────────────────────────────────

interface MarketIntelInput {
  city: string;
  state: string;
  propertyType?: string;
}

interface MarketIntelligenceResult {
  supplyDemand: {
    score: number; // 0-100, >50 = seller's market
    monthsOfInventory: number;
    daysOnMarket: number;
    absorptionRate: number;
    classification: string;
  };
  trends: {
    priceDirection: string;
    priceVelocity: number;
    rentDirection: string;
    rentVelocity: number;
    volumeTrend: string;
  };
  seasonality: {
    bestMonthToBuy: string;
    bestMonthToSell: string;
    worstMonthToBuy: string;
    currentSeason: string;
    seasonalAdjustment: number;
  };
  forecast: {
    priceNextQuarter: number;
    priceNextYear: number;
    rentNextQuarter: number;
    rentNextYear: number;
    confidence: number;
  };
  signals: string[];
  opportunities: string[];
  risks: string[];
}

function analyzeMarketIntelligence(input: MarketIntelInput): MarketIntelligenceResult {
  const cityKey = input.city?.toLowerCase() || '';
  const cityData = CITY_INTELLIGENCE[cityKey] || DEFAULT_CITY;

  // Supply/Demand
  const supplyDemandScore = Math.round(50 + (cityData.inventoryMonths < 3 ? 20 : cityData.inventoryMonths > 5 ? -15 : 0) + (cityData.daysOnMarket < 30 ? 15 : cityData.daysOnMarket > 60 ? -10 : 0));
  const classification = supplyDemandScore >= 65 ? 'Strong Seller\'s Market' : supplyDemandScore >= 55 ? 'Seller\'s Market' : supplyDemandScore >= 45 ? 'Balanced' : supplyDemandScore >= 35 ? 'Buyer\'s Market' : 'Strong Buyer\'s Market';

  // Trends
  const priceVelocity = cityData.appreciationRate * 100;
  const rentVelocity = cityData.appreciationRate * 0.8 * 100;

  // Seasonality
  const month = new Date().getMonth();
  const seasonNames = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'];
  const currentSeason = seasonNames[month];

  const seasonality = {
    bestMonthToBuy: 'January',
    bestMonthToSell: 'May',
    worstMonthToBuy: 'June',
    currentSeason,
    seasonalAdjustment: month >= 4 && month <= 7 ? 0.02 : month >= 11 || month <= 1 ? -0.01 : 0,
  };

  // Forecast
  const forecast = {
    priceNextQuarter: Math.round((priceVelocity / 4) * 100) / 100,
    priceNextYear: Math.round(priceVelocity * 100) / 100,
    rentNextQuarter: Math.round((rentVelocity / 4) * 100) / 100,
    rentNextYear: Math.round(rentVelocity * 100) / 100,
    confidence: CITY_INTELLIGENCE[cityKey] ? 75 : 55,
  };

  // Signals
  const signals: string[] = [];
  if (cityData.inventoryMonths < 2.5) signals.push('Very low inventory — competitive market');
  if (cityData.daysOnMarket < 30) signals.push('Fast-moving properties');
  if (cityData.vacancyRate < 0.06) signals.push('Low vacancy — strong rental demand');
  if (cityData.populationGrowth > 0.01) signals.push('Population growing — sustained demand');

  // Opportunities
  const opportunities: string[] = [];
  if (supplyDemandScore < 45) opportunities.push('Buyer\'s market — negotiate aggressively');
  if (cityData.vacancyRate < 0.06) opportunities.push('Strong rental demand — good for landlords');
  if (cityData.populationGrowth > 0.01) opportunities.push('Growing market — appreciation potential');

  // Risks
  const risks: string[] = [];
  if (supplyDemandScore > 65) risks.push('Seller\'s market — paying premium');
  if (cityData.inventoryMonths > 4) risks.push('High inventory — prices may soften');
  if (cityData.vacancyRate > 0.08) risks.push('High vacancy — rental income risk');

  return {
    supplyDemand: {
      score: supplyDemandScore,
      monthsOfInventory: cityData.inventoryMonths,
      daysOnMarket: cityData.daysOnMarket,
      absorptionRate: Math.round((1 / cityData.inventoryMonths) * 100) / 100,
      classification,
    },
    trends: {
      priceDirection: priceVelocity > 3 ? 'Rising' : priceVelocity > 0 ? 'Stable' : 'Falling',
      priceVelocity: Math.round(priceVelocity * 100) / 100,
      rentDirection: rentVelocity > 3 ? 'Rising' : rentVelocity > 0 ? 'Stable' : 'Falling',
      rentVelocity: Math.round(rentVelocity * 100) / 100,
      volumeTrend: cityData.populationGrowth > 0.008 ? 'Increasing' : 'Stable',
    },
    seasonality,
    forecast,
    signals,
    opportunities,
    risks,
  };
}

router.post('/market-intelligence', async (req: Request, res: Response) => {
  try {
    const input: MarketIntelInput = req.body;
    if (!input.city || !input.state) {
      return res.status(400).json({ success: false, error: 'city and state required' });
    }
    const result = analyzeMarketIntelligence(input);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 6. MAINTENANCE PREDICTOR
//    Seasonal predictions, cost forecasting, vendor matching
// ──────────────────────────────────────────────────────────────────────────

interface MaintenancePredictorInput {
  propertyType: string;
  yearBuilt?: number;
  city: string;
  state: string;
  sqft: number;
  hasPool?: boolean;
  hasHVAC?: boolean;
  lastService?: Record<string, string>;
}

interface MaintenancePrediction {
  id: string;
  task: string;
  category: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  dueInMonths: number;
  estimatedCost: { min: number; max: number };
  season: string;
  vendorType: string;
  diyPossible: boolean;
  description: string;
}

interface MaintenancePredictorResult {
  predictions: MaintenancePrediction[];
  annualBudget: {
    estimated: number;
    range: { low: number; high: number };
    monthlyAverage: number;
  };
  seasonalTips: string[];
  vendorRecommendations: { type: string; reason: string; estimatedCost: string }[];
}

function predictMaintenance(input: MaintenancePredictorInput): MaintenancePredictorResult {
  const predictions: MaintenancePrediction[] = [];
  const age = input.yearBuilt ? new Date().getFullYear() - input.yearBuilt : 15;
  const month = new Date().getMonth();

  // HVAC
  predictions.push({
    id: '1',
    task: 'HVAC Filter Replacement',
    category: 'HVAC',
    urgency: month >= 4 && month <= 7 ? 'high' : 'medium',
    dueInMonths: month >= 4 && month <= 7 ? 1 : 3,
    estimatedCost: { min: 20, max: 100 },
    season: 'Spring/Summer',
    vendorType: 'HVAC Technician',
    diyPossible: true,
    description: 'Replace air filters every 3 months. Critical before summer cooling season.',
  });

  if (age > 10) {
    predictions.push({
      id: '2',
      task: 'HVAC System Inspection',
      category: 'HVAC',
      urgency: 'medium',
      dueInMonths: 2,
      estimatedCost: { min: 100, max: 300 },
      season: 'Spring',
      vendorType: 'HVAC Technician',
      diyPossible: false,
      description: 'Annual inspection recommended for systems over 10 years old.',
    });
  }

  // Plumbing
  predictions.push({
    id: '3',
    task: 'Water Heater Flush',
    category: 'Plumbing',
    urgency: age > 8 ? 'high' : 'medium',
    dueInMonths: 4,
    estimatedCost: { min: 100, max: 250 },
    season: 'Fall',
    vendorType: 'Plumber',
    diyPossible: false,
    description: 'Flush sediment buildup. Critical for older units to prevent failure.',
  });

  if (age > 15) {
    predictions.push({
      id: '4',
      task: 'Pipe Inspection',
      category: 'Plumbing',
      urgency: 'medium',
      dueInMonths: 6,
      estimatedCost: { min: 150, max: 400 },
      season: 'Any',
      vendorType: 'Plumber',
      diyPossible: false,
      description: 'Older pipes may have corrosion or leaks. Preventive inspection saves money.',
    });
  }

  // Exterior
  predictions.push({
    id: '5',
    task: 'Gutter Cleaning',
    category: 'Exterior',
    urgency: month >= 9 || month <= 1 ? 'high' : 'low',
    dueInMonths: month >= 9 || month <= 1 ? 1 : 6,
    estimatedCost: { min: 100, max: 250 },
    season: 'Fall',
    vendorType: 'Gutter Service',
    diyPossible: true,
    description: 'Clean gutters before winter. Prevents ice dams and water damage.',
  });

  predictions.push({
    id: '6',
    task: 'Roof Inspection',
    category: 'Exterior',
    urgency: age > 20 ? 'high' : 'medium',
    dueInMonths: 6,
    estimatedCost: { min: 200, max: 500 },
    season: 'Spring',
    vendorType: 'Roofing Contractor',
    diyPossible: false,
    description: 'Annual inspection. Older roofs need more frequent checks.',
  });

  // Pool
  if (input.hasPool) {
    predictions.push({
      id: '7',
      task: 'Pool Opening/Closing',
      category: 'Pool',
      urgency: month >= 3 && month <= 5 ? 'high' : 'low',
      dueInMonths: month >= 3 && month <= 5 ? 1 : 8,
      estimatedCost: { min: 150, max: 400 },
      season: 'Spring',
      vendorType: 'Pool Service',
      diyPossible: true,
      description: 'Seasonal pool maintenance. Open in spring, close in fall.',
    });
  }

  // Electrical
  if (age > 25) {
    predictions.push({
      id: '8',
      task: 'Electrical Panel Inspection',
      category: 'Electrical',
      urgency: 'medium',
      dueInMonths: 8,
      estimatedCost: { min: 150, max: 400 },
      season: 'Any',
      vendorType: 'Electrician',
      diyPossible: false,
      description: 'Older electrical systems may not meet modern code. Safety inspection recommended.',
    });
  }

  // Pest
  predictions.push({
    id: '9',
    task: 'Pest Prevention Treatment',
    category: 'Pest',
    urgency: month >= 4 && month <= 7 ? 'high' : 'medium',
    dueInMonths: month >= 4 && month <= 7 ? 1 : 4,
    estimatedCost: { min: 100, max: 300 },
    season: 'Spring',
    vendorType: 'Pest Control',
    diyPossible: true,
    description: 'Seasonal pest prevention. Critical in warmer months.',
  });

  // Calculate annual budget
  const totalMin = predictions.reduce((s, p) => s + p.estimatedCost.min, 0);
  const totalMax = predictions.reduce((s, p) => s + p.estimatedCost.max, 0);
  const annualBudget = {
    estimated: Math.round((totalMin + totalMax) / 2),
    range: { low: totalMin, high: totalMax },
    monthlyAverage: Math.round(((totalMin + totalMax) / 2) / 12),
  };

  // Seasonal tips
  const seasonalTips: string[] = [];
  if (month >= 3 && month <= 5) seasonalTips.push('Spring: Focus on HVAC prep, gutter cleaning, and pest prevention');
  if (month >= 6 && month <= 8) seasonalTips.push('Summer: Monitor AC usage, check for water leaks, maintain landscaping');
  if (month >= 9 && month <= 11) seasonalTips.push('Fall: Clean gutters, service heating system, winterize outdoor plumbing');
  if (month >= 11 || month <= 2) seasonalTips.push('Winter: Prevent ice dams, check for frozen pipes, monitor heating system');

  // Vendor recommendations
  const vendorRecommendations = [
    { type: 'HVAC Technician', reason: 'Annual inspection + filter changes', estimatedCost: '$100-300/yr' },
    { type: 'Plumber', reason: 'Water heater flush + leak prevention', estimatedCost: '$150-400/yr' },
    { type: 'Pest Control', reason: 'Seasonal prevention treatments', estimatedCost: '$100-300/yr' },
    { type: 'General Handyman', reason: 'Small repairs and maintenance', estimatedCost: '$200-500/yr' },
  ];

  return { predictions, annualBudget, seasonalTips, vendorRecommendations };
}

router.post('/maintenance-predictor', async (req: Request, res: Response) => {
  try {
    const input: MaintenancePredictorInput = req.body;
    if (!input.propertyType || !input.city || !input.state) {
      return res.status(400).json({ success: false, error: 'propertyType, city, state required' });
    }
    const result = predictMaintenance(input);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;

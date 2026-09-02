import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { aiNlpService } from '../services/ai.nlp.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── AI Lease Analyzer ───────────────────────────────────────────────────────
// POST /api/v1/ai/analyze-lease
router.post('/analyze-lease', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'Lease text is required' });

    const analysis = analyzeLeaseTerms(text);
    res.json({ success: true, data: analysis });
  } catch (e) {
    next(e);
  }
});

// ── AI Maintenance Assistant ────────────────────────────────────────────────
// POST /api/v1/ai/maintenance-advice
router.post('/maintenance-advice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { issue, propertyType, budget, urgency } = req.body;
    if (!issue) return res.status(400).json({ success: false, error: 'Issue description is required' });

    const advice = getMaintenanceAdvice(issue, propertyType, budget, urgency as any);
    res.json({ success: true, data: advice });
  } catch (e) {
    next(e);
  }
});

// ── AI Market Intelligence ──────────────────────────────────────────────────
// POST /api/v1/ai/market-insights
router.post('/market-insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { city, state, propertyType, address } = req.body;

    const insights = await getMarketInsights(city, state, propertyType);
    res.json({ success: true, data: insights });
  } catch (e) {
    next(e);
  }
});

// ── AI Document Writer ──────────────────────────────────────────────────────
// POST /api/v1/ai/generate-document
router.post('/generate-document', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, params } = req.body;
    if (!type) return res.status(400).json({ success: false, error: 'Document type is required' });

    const doc = generateDocument(type, params || {});
    res.json({ success: true, data: doc });
  } catch (e) {
    next(e);
  }
});

// ── AI Property Valuation ───────────────────────────────────────────────────
// POST /api/v1/ai/property-valuation
router.post('/property-valuation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address, city, state, zip, bedrooms, bathrooms, sqft, propertyType, condition } = req.body;
    if (!city) return res.status(400).json({ success: false, error: 'City is required' });

    const valuation = await getPropertyValuation({ address, city, state, zip, bedrooms, bathrooms, sqft, propertyType, condition });
    res.json({ success: true, data: valuation });
  } catch (e) {
    next(e);
  }
});

// ── AI Assistant Chat ──────────────────────────────────────────────────────
// POST /api/v1/ai/chat
router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    const response = await aiChat(message, context);
    res.json({ success: true, data: { response } });
  } catch (e) {
    next(e);
  }
});

export default router;

// ── Lease Analyzer Logic ────────────────────────────────────────────────────

interface LeaseAnalysis {
  terms: { name: string; value: string; status: 'found' | 'missing' | 'unclear' }[];
  redFlags: string[];
  recommendations: string[];
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
}

function analyzeLeaseTerms(text: string): LeaseAnalysis {
  const lower = text.toLowerCase();
  const terms: LeaseAnalysis['terms'] = [];
  const redFlags: string[] = [];
  const recommendations: string[] = [];

  // Key lease terms to look for
  const termPatterns = [
    { name: 'Rent Amount', pattern: /\$?\d{1,4}(?:,\d{3})*(?:\.\d{2})?\s*(?:per month|\/\s*mo|monthly)/i },
    { name: 'Security Deposit', pattern: /security deposit|deposit.*\$?\d+/i },
    { name: 'Lease Term', pattern: /(\d{1,2})\s*(?:month|year)|\d{1,2}\s*month lease|\d{1,2}\s*year lease/i },
    { name: 'Start Date', pattern: /(?:commence|start|begin|effective).*?(?:date|\d{1,2}\/\d{1,2}\/\d{2,4})/i },
    { name: 'End Date', pattern: /(?:end|expire|termination).*?(?:date|\d{1,2}\/\d{1,2}\/\d{2,4})/i },
    { name: 'Due Date', pattern: /(?:due|payable).*?(?:\d{1,2}(?:st|nd|rd|th)?|first|1st).*?(?:of each month|monthly)/i },
    { name: 'Late Fee', pattern: /late (?:fee|charge|penalty)|\$\d+.*late/i },
    { name: 'Grace Period', pattern: /grace period|\d+ days?(?: before| after).*late/i },
    { name: 'Utilities Included', pattern: /utilities included|water.*included|electric.*included|gas.*included/i },
    { name: 'Pet Policy', pattern: /pet(?:s)?|animal|pet deposit|pet rent/i },
    { name: 'Maintenance Responsibility', pattern: /maintenance|repair|responsible for/i },
    { name: 'Termination Clause', pattern: /terminate|termination|break.*lease|early termination/i },
    { name: 'Renewal Terms', pattern: /renew|renewal|automatic renewal|month.to.month/i },
    { name: 'Subletting', pattern: /sublet|sublease|assign/i },
    { name: 'Insurance Requirement', pattern: /insurance|renter.*insurance/i },
  ];

  let foundCount = 0;
  for (const term of termPatterns) {
    const found = term.pattern.test(text);
    terms.push({
      name: term.name,
      value: found ? 'Found' : 'Missing',
      status: found ? 'found' : 'missing',
    });
    if (found) foundCount++;
  }

  // Red flag detection
  if (!termPatterns[0].pattern.test(text)) {
    redFlags.push('Rent amount not clearly specified');
  }
  if (!termPatterns[1].pattern.test(text)) {
    redFlags.push('Security deposit not specified');
  }
  if (!termPatterns[3].pattern.test(text)) {
    redFlags.push('Lease start/end dates not clearly defined');
  }
  if (lower.includes('waive') && lower.includes('right')) {
    redFlags.push('Tenant rights waiver detected');
  }
  if (lower.includes('automatic') && lower.includes('renew')) {
    redFlags.push('Automatic renewal clause — may lock you in');
  }
  if (lower.includes('no refund') || lower.includes('non-refundable')) {
    redFlags.push('Non-refundable terms detected');
  }
  if (!termPatterns[8].pattern.test(text)) {
    redFlags.push('Utilities responsibility not clearly defined');
  }
  if (lower.includes('immediate') && lower.includes('eviction')) {
    redFlags.push('Immediate eviction clause detected');
  }

  // Recommendations
  if (foundCount < 8) {
    recommendations.push('Request a complete lease with all standard terms');
  }
  if (!termPatterns[10].pattern.test(text)) {
    recommendations.push('Clarify maintenance responsibilities in writing');
  }
  if (!termPatterns[11].pattern.test(text)) {
    recommendations.push('Understand early termination penalties before signing');
  }
  if (!termPatterns[14].pattern.test(text)) {
    recommendations.push('Consider requiring renter\'s insurance');
  }
  recommendations.push('Have a legal professional review before signing');
  recommendations.push('Take photos of property condition before move-in');

  const riskScore = Math.max(0, Math.min(100, (redFlags.length * 20) + ((15 - foundCount) * 3)));
  const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

  return {
    terms,
    redFlags,
    recommendations,
    summary: `Found ${foundCount}/${termPatterns.length} standard lease terms. ${redFlags.length} potential issues identified.`,
    riskLevel,
    riskScore,
  };
}

// ── Maintenance Advice Logic ────────────────────────────────────────────────

interface MaintenanceAdvice {
  issue: string;
  category: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  diyPossible: boolean;
  estimatedCost: { min: number; max: number; currency: string };
  steps: string[];
  professionalRequired: string[];
  preventionTips: string[];
  timeframe: string;
}

function getMaintenanceAdvice(issue: string, propertyType?: string, budget?: string, urgency?: 'low' | 'medium' | 'high' | 'emergency'): MaintenanceAdvice {
  const lower = issue.toLowerCase();
  const category = categorizeIssue(lower);
  const urgencyLevel: 'low' | 'medium' | 'high' | 'emergency' = urgency || detectUrgency(lower);

  const advice: MaintenanceAdvice = {
    issue: issue.slice(0, 100),
    category,
    urgency: urgencyLevel,
    diyPossible: false,
    estimatedCost: { min: 0, max: 0, currency: 'USD' },
    steps: [],
    professionalRequired: [],
    preventionTips: [],
    timeframe: '',
  };

  // Water leaks
  if (lower.includes('leak') || lower.includes('water') || lower.includes('drip')) {
    advice.category = 'Plumbing';
    advice.steps = ['Turn off water supply', 'Identify source of leak', 'Temporarily patch if possible', 'Call licensed plumber'];
    advice.professionalRequired = ['Licensed plumber'];
    advice.diyPossible = lower.includes('minor') || lower.includes('small');
    advice.estimatedCost = advice.diyPossible ? { min: 20, max: 100, currency: 'USD' } : { min: 150, max: 500, currency: 'USD' };
    advice.preventionTips = ['Regular pipe inspections', 'Don\'t pour grease down drains', 'Know where shut-off valves are'];
    advice.timeframe = urgencyLevel === 'emergency' ? 'Immediate (within 1 hour)' : 'Within 24-48 hours';
  }
  // Electrical
  else if (lower.includes('electric') || lower.includes('outlet') || lower.includes('power') || lower.includes('circuit')) {
    advice.category = 'Electrical';
    advice.steps = ['Turn off circuit breaker', 'Do NOT touch water near electrical issue', 'Test outlets with tester', 'Call licensed electrician'];
    advice.professionalRequired = ['Licensed electrician'];
    advice.diyPossible = false;
    advice.estimatedCost = { min: 100, max: 500, currency: 'USD' };
    advice.preventionTips = ['Don\'t overload outlets', 'Test GFCI outlets monthly', 'Watch for flickering lights'];
    advice.timeframe = urgencyLevel === 'emergency' ? 'Immediate' : 'Within 24 hours';
  }
  // HVAC
  else if (lower.includes('heat') || lower.includes('ac') || lower.includes('air condition') || lower.includes('furnace')) {
    advice.category = 'HVAC';
    advice.steps = ['Check thermostat settings', 'Replace air filter', 'Check circuit breaker', 'Call HVAC technician if not resolved'];
    advice.professionalRequired = ['HVAC technician'];
    advice.diyPossible = lower.includes('filter') || lower.includes('thermostat');
    advice.estimatedCost = advice.diyPossible ? { min: 10, max: 50, currency: 'USD' } : { min: 200, max: 800, currency: 'USD' };
    advice.preventionTips = ['Change filters every 3 months', 'Schedule annual maintenance', 'Keep vents clear'];
    advice.timeframe = urgencyLevel === 'emergency' ? 'Same day' : 'Within 1-2 days';
  }
  // Pest control
  else if (lower.includes('pest') || lower.includes('bug') || lower.includes('roach') || lower.includes('mouse') || lower.includes('rat') || lower.includes('ant')) {
    advice.category = 'Pest Control';
    advice.steps = ['Identify pest type', 'Seal entry points', 'Set traps or apply treatment', 'Schedule professional inspection'];
    advice.professionalRequired = ['Pest control service'];
    advice.diyPossible = true;
    advice.estimatedCost = { min: 50, max: 300, currency: 'USD' };
    advice.preventionTips = ['Seal cracks and openings', 'Keep food in airtight containers', 'Regular cleaning schedule'];
    advice.timeframe = 'Within 1 week';
  }
  // Appliance
  else if (lower.includes('appliance') || lower.includes('fridge') || lower.includes('refrigerator') || lower.includes('washer') || lower.includes('dryer') || lower.includes('dishwasher') || lower.includes('oven') || lower.includes('stove')) {
    advice.category = 'Appliance';
    advice.steps = ['Check power source', 'Consult user manual', 'Check for obvious issues', 'Call appliance repair service'];
    advice.professionalRequired = ['Appliance repair technician'];
    advice.diyPossible = lower.includes('filter') || lower.includes('unclog');
    advice.estimatedCost = advice.diyPossible ? { min: 0, max: 50, currency: 'USD' } : { min: 100, max: 400, currency: 'USD' };
    advice.preventionTips = ['Clean appliances regularly', 'Don\'t overload washer', 'Check hoses for leaks'];
    advice.timeframe = 'Within 3-5 days';
  }
  // Structural
  else if (lower.includes('crack') || lower.includes('wall') || lower.includes('floor') || lower.includes('ceiling') || lower.includes('foundation') || lower.includes('structural')) {
    advice.category = 'Structural';
    advice.steps = ['Document damage with photos', 'Monitor for changes', 'Do not attempt DIY structural repairs', 'Call structural engineer or contractor'];
    advice.professionalRequired = ['Structural engineer', 'Licensed contractor'];
    advice.diyPossible = false;
    advice.estimatedCost = { min: 500, max: 5000, currency: 'USD' };
    advice.preventionTips = ['Monitor existing cracks', 'Maintain proper drainage', 'Control humidity levels'];
    advice.timeframe = urgencyLevel === 'emergency' ? 'Immediate' : 'Within 1 week';
  }
  // Lockout / security
  else if (lower.includes('lock') || lower.includes('key') || lower.includes('security') || lower.includes('break in')) {
    advice.category = 'Security';
    advice.steps = ['Ensure personal safety first', 'Call locksmith if locked out', 'Change locks after break-in', 'Document incident'];
    advice.professionalRequired = ['Locksmith', 'Police (if break-in)'];
    advice.diyPossible = false;
    advice.estimatedCost = { min: 75, max: 300, currency: 'USD' };
    advice.preventionTips = ['Have spare keys with trusted neighbor', 'Install smart lock', 'Change locks when moving in'];
    advice.timeframe = 'Immediate';
  }
  // Default
  else {
    advice.category = 'General';
    advice.steps = ['Assess the situation', 'Document with photos', 'Determine if safe to attempt repair', 'Call appropriate professional'];
    advice.professionalRequired = ['General contractor'];
    advice.diyPossible = false;
    advice.estimatedCost = { min: 100, max: 500, currency: 'USD' };
    advice.preventionTips = ['Regular property inspections', 'Address small issues before they become big'];
    advice.timeframe = 'Within 1 week';
  }

  return advice;
}

function categorizeIssue(text: string): string {
  if (/leak|water|drip|pipe|plumb/.test(text)) return 'Plumbing';
  if (/electric|outlet|power|circuit|wire/.test(text)) return 'Electrical';
  if (/heat|ac|air condition|furnace|hvac/.test(text)) return 'HVAC';
  if (/pest|bug|roach|mouse|rat|ant|insect/.test(text)) return 'Pest Control';
  if (/appliance|fridge|washer|dryer|dishwasher|oven|stove/.test(text)) return 'Appliance';
  if (/crack|wall|floor|ceiling|foundation|structural/.test(text)) return 'Structural';
  if (/lock|key|security|break/.test(text)) return 'Security';
  return 'General';
}

function detectUrgency(text: string): 'low' | 'medium' | 'high' | 'emergency' {
  if (/flood|fire|spark|gas|emergency|immediately|burst|collapse/.test(text)) return 'emergency';
  if (/no heat|no AC|leak|broken|not working|urgent/.test(text)) return 'high';
  if (/slow|minor|small|drip|noise/.test(text)) return 'medium';
  return 'low';
}

// ── Market Insights Logic ────────────────────────────────────────────────────

async function getMarketInsights(city: string, state?: string, propertyType?: string) {
  // Get local data from our platform
  const localListings = await prisma.property.findMany({
    where: { city: { contains: city, mode: 'insensitive' } },
    select: { pricePerNight: true, bedrooms: true, city: true, category: true },
    take: 50,
  });

  const localPMProperties = await prisma.propertyManagerProperty.findMany({
    where: { city: { contains: city, mode: 'insensitive' } },
    select: { rentAmount: true, bedrooms: true, bathrooms: true, status: true },
    take: 50,
  });

  // Calculate local averages
  const avgNightlyRate = localListings.length > 0
    ? localListings.reduce((sum, l) => sum + (l.pricePerNight || 0), 0) / localListings.length
    : null;

  const avgRent = localPMProperties.length > 0
    ? localPMProperties.reduce((sum, p) => sum + (p.rentAmount || 0), 0) / localPMProperties.length
    : null;

  const occupancyRate = localPMProperties.length > 0
    ? (localPMProperties.filter(p => p.status === 'OCCUPIED').length / localPMProperties.length) * 100
    : null;

  // Rental yield estimates (national averages as fallback)
  const estimatedYield = 6.5; // Average US rental yield
  const priceToRentRatio = avgRent ? Math.round(avgRent * 12 / 0.065) : null;

  return {
    city,
    state: state || 'Unknown',
    propertyType: propertyType || 'All Types',
    dataPoints: localListings.length + localPMProperties.length,
    metrics: {
      avgNightlyRate: avgNightlyRate ? Math.round(avgNightlyRate) : null,
      avgMonthlyRent: avgRent ? Math.round(avgRent) : null,
      occupancyRate: occupancyRate ? Math.round(occupancyRate) : null,
      estimatedYield: `${estimatedYield}%`,
      priceToRentRatio: priceToRentRatio ? `$${priceToRentRatio.toLocaleString()}` : null,
    },
    insights: generateMarketInsights(city, avgRent, avgNightlyRate, occupancyRate),
    trends: {
      demandTrend: 'stable', // Would come from historical data
      rentTrend: localPMProperties.length > 5 ? 'increasing' : 'unknown',
      inventoryLevel: localListings.length > 20 ? 'high' : localListings.length > 5 ? 'medium' : 'low',
    },
    recommendations: generateMarketRecommendations(city, avgRent, occupancyRate),
    generatedAt: new Date().toISOString(),
  };
}

function generateMarketInsights(city: string, avgRent?: number | null, avgNightly?: number | null, occupancy?: number | null): string[] {
  const insights: string[] = [];
  if (avgRent) insights.push(`Average monthly rent in ${city}: $${Math.round(avgRent).toLocaleString()}`);
  if (avgNightly) insights.push(`Average nightly rate: $${Math.round(avgNightly).toLocaleString()}`);
  if (occupancy) insights.push(`Current occupancy rate: ${Math.round(occupancy)}%`);
  if (occupancy && occupancy > 85) insights.push('High demand market — favorable for landlords');
  if (occupancy && occupancy < 60) insights.push('Lower demand — consider competitive pricing');
  return insights;
}

function generateMarketRecommendations(city: string, avgRent?: number | null, occupancy?: number | null): string[] {
  const recs: string[] = [];
  if (occupancy && occupancy > 80) recs.push('Market supports rent increases — consider 3-5% annual adjustments');
  if (occupancy && occupancy < 70) recs.push('Focus on tenant retention and property improvements');
  if (avgRent && avgRent > 2000) recs.push('Premium market — emphasize quality and amenities');
  if (avgRent && avgRent < 1000) recs.push('Budget-friendly market — target value-seeking tenants');
  recs.push('Screen tenants thoroughly to reduce turnover');
  recs.push('Consider long-term leases in stable markets');
  return recs;
}

// ── Document Generator Logic ─────────────────────────────────────────────────

function generateDocument(type: string, params: any): { title: string; content: string; warnings: string[] } {
  const warnings: string[] = ['This is a template document. Have it reviewed by a legal professional before use.'];

  switch (type) {
    case 'lease_agreement':
      return {
        title: 'Residential Lease Agreement',
        content: generateLeaseAgreement(params),
        warnings,
      };
    case 'notice_to_vacate':
      return {
        title: 'Notice to Vacate',
        content: generateNoticeToVacate(params),
        warnings,
      };
    case 'rent_receipt':
      return {
        title: 'Rent Payment Receipt',
        content: generateRentReceipt(params),
        warnings,
      };
    case 'maintenance_request':
      return {
        title: 'Maintenance Request Form',
        content: generateMaintenanceRequest(params),
        warnings,
      };
    case 'move_in_checklist':
      return {
        title: 'Move-In Condition Checklist',
        content: generateMoveInChecklist(params),
        warnings,
      };
    case 'pet_addendum':
      return {
        title: 'Pet Addendum',
        content: generatePetAddendum(params),
        warnings,
      };
    default:
      return { title: 'Unknown Document', content: 'Document type not recognized', warnings: ['Invalid document type'] };
  }
}

function generateLeaseAgreement(params: any): string {
  const { landlordName = '[LANDLORD NAME]', tenantName = '[TENANT NAME]', propertyAddress = '[ADDRESS]', rentAmount = '[RENT]', depositAmount = '[DEPOSIT]', leaseTerm = '[TERM]', startDate = '[START DATE]', endDate = '[END DATE]' } = params;

  return `
RESIDENTIAL LEASE AGREEMENT

This Lease Agreement is entered into on ${new Date().toISOString().split('T')[0]}.

LANDLORD: ${landlordName}
TENANT: ${tenantName}
PROPERTY: ${propertyAddress}

1. TERM: This lease shall run for ${leaseTerm}, beginning ${startDate} and ending ${endDate}.

2. RENT: Tenant agrees to pay $${rentAmount} per month, due on the 1st of each month.

3. SECURITY DEPOSIT: Tenant shall pay a security deposit of $${depositAmount} before move-in.

4. LATE FEE: Rent received after the 5th of the month incurs a late fee of $75.

5. UTILITIES: Tenant is responsible for all utilities unless otherwise specified.

6. MAINTENANCE: Tenant shall maintain the property in good condition. Landlord responsible for structural repairs.

7. PETS: No pets without written consent from Landlord.

8. TERMINATION: Either party may terminate with 30 days written notice.

9. GOVERNING LAW: This agreement is governed by the laws of the state where the property is located.

SIGNATURES:

Landlord: _________________ Date: _______
Tenant: _________________ Date: _______
  `.trim();
}

function generateNoticeToVacate(params: any): string {
  const { tenantName = '[TENANT NAME]', propertyAddress = '[ADDRESS]', vacateDate = '[DATE]', reason = '[REASON]', landlordName = '[LANDLORD NAME]' } = params;

  return `
NOTICE TO VACATE

Date: ${new Date().toISOString().split('T')[0]}

To: ${tenantName}
Property: ${propertyAddress}

Dear ${tenantName},

This is formal notice that you must vacate the above property by ${vacateDate}.

Reason: ${reason}

Please ensure:
- All personal property is removed
- Property is left in clean condition
- Keys are returned to landlord
- Forwarding address is provided for security deposit return

If you have questions, please contact ${landlordName}.

Sincerely,
${landlordName}
  `.trim();
}

function generateRentReceipt(params: any): string {
  const { tenantName = '[TENANT NAME]', amount = '[AMOUNT]', date = new Date().toISOString().split('T')[0], propertyAddress = '[ADDRESS]', paymentMethod = '[METHOD]', landlordName = '[LANDLORD NAME]' } = params;

  return `
RENT PAYMENT RECEIPT

Date: ${date}
Received From: ${tenantName}
Property: ${propertyAddress}
Amount: $${amount}
Payment Method: ${paymentMethod}
Period: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

Received By: ${landlordName}

This receipt confirms payment of rent for the period specified above.

Signature: _________________
  `.trim();
}

function generateMaintenanceRequest(params: any): string {
  const { tenantName = '[TENANT NAME]', propertyAddress = '[ADDRESS]', issue = '[ISSUE DESCRIPTION]', urgency = '[URGENCY]', date = new Date().toISOString().split('T')[0] } = params;

  return `
MAINTENANCE REQUEST

Date: ${date}
Tenant: ${tenantName}
Property: ${propertyAddress}
Urgency: ${urgency}

ISSUE DESCRIPTION:
${issue}

Preferred Access Times: _________________
Permission to enter if tenant absent: Yes / No

Tenant Signature: _________________ Date: _______
  `.trim();
}

function generateMoveInChecklist(params: any): string {
  const { propertyAddress = '[ADDRESS]', tenantName = '[TENANT NAME]', date = new Date().toISOString().split('T')[0] } = params;

  return `
MOVE-IN CONDITION CHECKLIST

Property: ${propertyAddress}
Tenant: ${tenantName}
Date: ${date}

Rate each item: Good (G) / Fair (F) / Poor (P) / Not Applicable (N/A)

KITCHEN:
[ ] Stove/Oven
[ ] Refrigerator
[ ] Dishwasher
[ ] Sink/Plumbing
[ ] Cabinets
[ ] Countertops
[ ] Flooring
[ ] Walls/Ceiling
[ ] Windows/Lights

BATHROOM:
[ ] Toilet
[ ] Sink/Vanity
[ ] Shower/Tub
[ ] Plumbing
[ ] Ventilation
[ ] Flooring
[ ] Walls

BEDROOM(S):
[ ] Flooring
[ ] Walls/Ceiling
[ ] Windows
[ ] Closet
[ ] Lights

LIVING AREAS:
[ ] Flooring
[ ] Walls/Ceiling
[ ] Windows
[ ] Lights
[ ] Heating/AC

EXTERIOR:
[ ] Front Door
[ ] Locks
[ ] Windows
[ ] Balcony/Patio

NOTES:
_________________________________
_________________________________

Tenant Signature: _________________ Date: _______
Landlord Signature: _________________ Date: _______
  `.trim();
}

function generatePetAddendum(params: any): string {
  const { tenantName = '[TENANT NAME]', propertyAddress = '[ADDRESS]', petType = '[TYPE]', petName = '[NAME]', petDeposit = '[DEPOSIT]', petRent = '[RENT]' } = params;

  return `
PET ADDENDUM TO LEASE AGREEMENT

Property: ${propertyAddress}
Tenant: ${tenantName}

PET INFORMATION:
Type: ${petType}
Name: ${petName}

TERMS:
1. Pet deposit of $${petDeposit} is required (refundable).
2. Additional monthly pet rent of $${petRent} applies.
3. Tenant is responsible for any damage caused by pet.
4. Pet must be leashed in common areas.
5. Tenant must clean up after pet immediately.
6. Excessive noise or aggression is grounds for removal.
7. Maximum of 2 pets allowed.

Tenant Signature: _________________ Date: _______
Landlord Signature: _________________ Date: _______
  `.trim();
}

// ── Property Valuation Logic ─────────────────────────────────────────────────

async function getPropertyValuation(params: any) {
  const { address, city, state, zip, bedrooms = 2, bathrooms = 1, sqft = 1000, propertyType = 'apartment', condition = 'good' } = params;

  // Get comparable properties from our database
  const comparables = await prisma.propertyManagerProperty.findMany({
    where: {
      city: { contains: city, mode: 'insensitive' },
      bedrooms: { gte: bedrooms - 1, lte: bedrooms + 1 },
    },
    select: { rentAmount: true, bedrooms: true, bathrooms: true, status: true },
    take: 20,
  });

  // Calculate estimated rent based on comparables
  let estimatedRent = 0;
  if (comparables.length > 0) {
    const avgRent = comparables.reduce((sum, c) => sum + (c.rentAmount || 0), 0) / comparables.length;
    estimatedRent = avgRent;
  } else {
    // Fallback: estimate based on bedrooms and national averages
    const baseRent = 800;
    const perBedroom = 400;
    estimatedRent = baseRent + (bedrooms * perBedroom);
  }

  // Adjust for condition
  const conditionMultiplier = condition === 'excellent' ? 1.15 : condition === 'good' ? 1.0 : condition === 'fair' ? 0.9 : 0.8;
  estimatedRent = Math.round(estimatedRent * conditionMultiplier);

  // Estimate property value (using 1% rule as rough guide)
  const estimatedValue = Math.round(estimatedRent * 12 / 0.06); // 6% cap rate

  // Calculate rental yield
  const annualRent = estimatedRent * 12;
  const grossYield = ((annualRent / estimatedValue) * 100).toFixed(1);

  return {
    address: address || 'Not specified',
    city,
    state: state || 'Unknown',
    zip: zip || 'Unknown',
    propertyDetails: { bedrooms, bathrooms, sqft, propertyType, condition },
    valuation: {
      estimatedMonthlyRent: estimatedRent,
      estimatedAnnualRent: annualRent,
      estimatedPropertyValue: estimatedValue,
      grossRentalYield: `${grossYield}%`,
      pricePerSqft: sqft ? Math.round(estimatedValue / sqft) : null,
    },
    comparables: {
      count: comparables.length,
      avgRent: comparables.length > 0 ? Math.round(comparables.reduce((s, c) => s + (c.rentAmount || 0), 0) / comparables.length) : null,
    },
    recommendations: [
      estimatedRent > 2000 ? 'Premium market — emphasize quality and amenities' : 'Competitive market — focus on value proposition',
      'Screen tenants thoroughly to minimize vacancy',
      'Consider annual rent adjustments of 3-5%',
      'Maintain property to preserve value',
    ],
    generatedAt: new Date().toISOString(),
  };
}

// ── AI Chat Logic ────────────────────────────────────────────────────────────

async function aiChat(message: string, context?: any): Promise<string> {
  const lower = message.toLowerCase();

  // Real estate specific responses
  if (/lease|rent|tenant|landlord/.test(lower)) {
    return "I can help with real estate questions! Try:\n- **Analyze Lease** - Upload a lease for review\n- **Market Insights** - Get rental data for your area\n- **Property Valuation** - Estimate rent or property value\n- **Generate Document** - Create lease agreements, notices, and more\n\nWhat would you like to do?";
  }
  if (/maintenance|repair|fix|broken/.test(lower)) {
    return "For maintenance issues, I can:\n- Diagnose the problem\n- Estimate repair costs\n- Suggest DIY vs professional help\n- Provide prevention tips\n\nDescribe your issue and I'll help!";
  }
  if (/document|agreement|form|template/.test(lower)) {
    return "I can generate these documents:\n- Lease Agreement\n- Notice to Vacate\n- Rent Receipt\n- Maintenance Request\n- Move-In Checklist\n- Pet Addendum\n\nWhich document do you need?";
  }
  if (/value|worth|price|rent/.test(lower)) {
    return "I can help estimate:\n- Monthly rent for a property\n- Property value based on rental income\n- Rental yield percentage\n- Market comparables\n\nTell me about the property (city, bedrooms, etc.)!";
  }

  // Use NLP service for general queries
  const nlpResult = await aiNlpService.classifyIntentAndLanguage(message);

  return `I understand you're asking about: ${nlpResult.intent}. I'm Pabandi's AI assistant for real estate. I can help with lease analysis, maintenance advice, market insights, property valuation, and document generation. What would you like to explore?`;
}

import { Router } from 'express';

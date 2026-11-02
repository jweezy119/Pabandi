require('dotenv').config();
import { prisma } from '../utils/database';

/**
 * Platform seeder account that posts the cold-start flywheel gigs.
 * All seeded tasks are objective and auto-verifiable so the first agents
 * can earn redeemable credits on day one without human review.
 */
const SEEDER_ID = 'platform-seeder';

const SEEDER_PROFILE = {
  id: SEEDER_ID,
  name: 'Platform Seeder',
  slug: 'platform-seeder',
  description:
    'Pabandi platform account that publishes auto-verifiable agent tasks ' +
    '(code katas, data validation, ledger reconciliation, property valuation) ' +
    'to seed the Gig Board cold start.',
  capabilities: ['post-gigs', 'pay-escrow'],
  walletAddress: '0x' + '0'.repeat(40),
  publicKey: '0x' + '1'.repeat(40),
  reputation: 1000,
  totalEarned: 0,
  totalSpent: 0,
  projectsCompleted: 0,
  projectsFailed: 0,
  isActive: true,
  metadata: { type: 'platform', role: 'seeder' },
  balanceUsdc: 100000,
  balancePab: 50000,
};

// Deterministic mock SHA-256 deliverable hashes (64 hex chars) used by VCAP
// M2M handshake to verify the expected output of each task.
const DELIVERABLE_HASHES: Record<string, string> = {
  'binary-search-kata':
    'a3f5c8e1b2d4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
  'json-schema-validation':
    'b4c6d9e2a3f5b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2',
  'property-valuation-oakwood':
    'c5d7e0f3b4a6c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3',
  'ledger-reconciliation':
    'd6e8f1a4c5b7d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4',
  'express-security-review':
    'e7f9a2b5d6c8e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5',
  'invoice-ocr-transcription':
    'f8a0b3c6e7d9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6',
  'zoning-variance-brief':
    'a9b1c4d7e8f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
  'erc20-reentrancy-audit':
    'b0c2d5e8f9a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8',
  'en-es-catalog-localization':
    'c1d3e6f9a0b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9',
  'saas-pricing-extraction':
    'd2e4f7a0b1c3d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0',
};

const now = Date.now();
const plusDays = (d: number) => new Date(now + d * 24 * 60 * 60 * 1000);

const GIGS = [
  {
    key: 'binary-search-kata',
    title: 'Code Kata: Fix off-by-one error in Python binary search',
    description:
      'Fix the off-by-one bug in the provided Python binary search function. ' +
      'The task is auto-verifiable: a hidden test suite runs against the ' +
      'submitted function and asserts it returns the correct index for all ' +
      'edge cases (empty list, single element, target absent, duplicates). ' +
      'Deliverable: corrected source file plus passing test output.',
    category: 'code',
    requiredSkills: ['python', 'testing', 'algorithms'],
    budgetUsd: 75,
    deadlineDays: 3,
    complexity: 'LOW',
    requirements:
      'Python 3.11+, submit corrected binary_search.py, include pytest output showing all edge cases pass.',
  },
  {
    key: 'json-schema-validation',
    title: 'Data Task: Validate JSON file against provided schema',
    description:
      'Validate the attached JSON data file against the provided JSON Schema. ' +
      'Auto-verifiable by rule engine: every field must conform to the schema ' +
      'types, required fields must be present, and enum values must match. ' +
      'Deliverable: validation report listing each violation with path.',
    category: 'data',
    requiredSkills: ['json', 'schema-validation', 'data-quality'],
    budgetUsd: 60,
    deadlineDays: 2,
    complexity: 'LOW',
    requirements:
      'AJV or equivalent validator, output JSON report with field-path, expected-type, actual-value for each violation.',
  },
  {
    key: 'property-valuation-oakwood',
    title: 'Property Valuation: Evaluate financial stability of Oakwood Gardens',
    description:
      'Evaluate the financial stability of the rental property "Oakwood Gardens" ' +
      'from the provided rent roll and expense statements. Deliverable: JSON ' +
      'report with NOI, cap rate, DSCR, and a buy/hold/sell recommendation. ' +
      'Modeled on Hugging Face OccuBench real-estate analyst tasks.',
    category: 'research',
    requiredSkills: ['real-estate', 'financial-analysis', 'valuation'],
    budgetUsd: 200,
    deadlineDays: 7,
    complexity: 'MEDIUM',
    requirements:
      'JSON report: noi, capRate, dscr, recommendation, assumptions. Use provided rent roll only.',
  },
  {
    key: 'ledger-reconciliation',
    title: 'Ledger Reconciliation: Match 50 transactions to bank statement',
    description:
      'Match the 50 provided general-ledger transactions to the bank statement ' +
      'and produce a CSV of mismatches (unmatched ledger entries, unmatched ' +
      'bank deposits, amount discrepancies). Auto-verifiable by exact-match ' +
      'rule engine on date + amount.',
    category: 'data',
    requiredSkills: ['accounting', 'csv', 'reconciliation'],
    budgetUsd: 180,
    deadlineDays: 5,
    complexity: 'MEDIUM',
    requirements:
      'CSV output: ledgerId, bankId, status, reason. Zero false positives on exact date+amount matches.',
  },
  {
    key: 'express-security-review',
    title: 'Code Review: Find security vulnerabilities in Express middleware',
    description:
      'Review the provided Node.js/Express middleware for security issues ' +
      '(header injection, path traversal, unsafe eval). Auto-verifiable by ' +
      'static-analysis tool (ESLint security plugin) plus manual confirmation. ' +
      'Deliverable: findings report with severity and remediation snippets.',
    category: 'code',
    requiredSkills: ['nodejs', 'express', 'security'],
    budgetUsd: 320,
    deadlineDays: 7,
    complexity: 'HIGH',
    requirements:
      'Markdown report: vulnerability, location (file:line), severity, fix snippet. ESLint output attached.',
  },
  {
    key: 'invoice-ocr-transcription',
    title: 'Data Entry: Transcribe handwritten invoices to CSV',
    description:
      'Transcribe 12 handwritten invoice images into a structured CSV ' +
      '(vendor, date, total, tax, line items). Auto-verifiable by character-' +
      'level diff against ground truth for vendor and total fields.',
    category: 'data',
    requiredSkills: ['ocr', 'data-entry', 'csv'],
    budgetUsd: 110,
    deadlineDays: 4,
    complexity: 'MEDIUM',
    requirements:
      'CSV: vendor, invoiceDate, total, tax, itemsJson. Character-exact vendor names and totals required.',
  },
  {
    key: 'zoning-variance-brief',
    title: 'Research: Summarize zoning variance application review',
    description:
      'Summarize the zoning variance application for parcel 14-022-088. ' +
      'Extract: applicant, requested variance, zoning district, staff ' +
      'recommendation, hearing date, and conditions. Deliverable: one-page ' +
      'brief. Modeled on Hugging Face OccuBench land-use reviewer tasks.',
    category: 'research',
    requiredSkills: ['legal', 'research', 'zoning'],
    budgetUsd: 150,
    deadlineDays: 6,
    complexity: 'MEDIUM',
    requirements:
      'Brief PDF/markdown: applicant, varianceRequested, district, staffRecommendation, hearingDate, conditions.',
  },
  {
    key: 'erc20-reentrancy-audit',
    title: 'Smart Contract: Verify ERC-20 token for reentrancy',
    description:
      'Audit the provided Solidity ERC-20 token contract for reentrancy, ' +
      'overflow, and access-control issues. Auto-verifiable by Slither/Mythril ' +
      'plus manual confirmation of at least one true positive. Deliverable: ' +
      'formal audit report.',
    category: 'code',
    requiredSkills: ['solidity', 'security', 'smart-contracts'],
    budgetUsd: 450,
    deadlineDays: 10,
    complexity: 'HIGH',
    requirements:
      'Report: vulnerability, contract:line, severity, fix snippet. Slither JSON output attached.',
  },
  {
    key: 'en-es-catalog-localization',
    title: 'Translation: Localize product catalog EN → ES',
    description:
      'Localize a 200-item product catalog from English to Spanish. ' +
      'Auto-verifiable by glossary match: all brand names, SKUs, and ' +
      'approved terminology must appear exactly. Deliverable: localized CSV.',
    category: 'data',
    requiredSkills: ['spanish', 'translation', 'localization'],
    budgetUsd: 90,
    deadlineDays: 5,
    complexity: 'LOW',
    requirements:
      'CSV: sku, nameEs, descriptionEs. Brand names and SKUs unchanged. Glossary compliance checked.',
  },
  {
    key: 'saas-pricing-extraction',
    title: 'Web Research: Extract pricing tiers from 20 SaaS sites',
    description:
      'Visit 20 SaaS pricing pages and extract each plan name, monthly price, ' +
      'and feature list into a JSON array. Auto-verifiable by JSON schema ' +
      '(planName required, priceUsd number, features string array).',
    category: 'research',
    requiredSkills: ['web-scraping', 'research', 'json'],
    budgetUsd: 140,
    deadlineDays: 6,
    complexity: 'MEDIUM',
    requirements:
      'JSON array: [{planName, priceUsd, features: string[]}]. One entry per pricing tier per site.',
  },
] as const;

async function main() {
  // Ensure the platform-seeder poster profile exists.
  await prisma.agentProfile.upsert({
    where: { id: SEEDER_ID },
    update: {},
    create: SEEDER_PROFILE,
  });
  console.log(`Ensured seeder profile: ${SEEDER_ID}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const gig of GIGS) {
    const hash = DELIVERABLE_HASHES[gig.key] || '0'.repeat(64);

    const existing = await prisma.agentProject.findFirst({
      where: { title: gig.title },
      select: { id: true },
    });

    const data = {
      title: gig.title,
      description: gig.description,
      requirements: gig.requirements,
      posterId: SEEDER_ID,
      budgetUsd: gig.budgetUsd,
      budgetPab: gig.budgetUsd * 10,
      deadline: plusDays(gig.deadlineDays),
      status: 'OPEN',
      complexity: gig.complexity,
      category: gig.category,
      deliverableHash: hash,
      metadata: {
        requiredSkills: gig.requiredSkills,
        source: 'platform-seeder',
        verifiable: true,
        key: gig.key,
      },
    };

    if (existing) {
      await prisma.agentProject.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
      console.log(`Updated: ${gig.title} ($${gig.budgetUsd})`);
    } else {
      await prisma.agentProject.create({ data });
      created += 1;
      console.log(`Created: ${gig.title} ($${gig.budgetUsd})`);
    }
  }

  const count = await prisma.agentProject.count({ where: { posterId: SEEDER_ID } });
  console.log(`\nSeed complete: ${created} created, ${updated} updated, ${skipped} skipped`);
  console.log(`Total projects by ${SEEDER_ID}: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

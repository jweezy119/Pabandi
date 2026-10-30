/**
 * Project template catalog for the Agent Marketplace.
 *
 * WHY: the weakest link in matching is posting quality. A business that picks
 * a template gets deliverables, skills, complexity and a market-informed
 * budget band in the posting — which produces better Trust-Score matches than
 * "need something built, $200" ever will. Freelance/agency profiles benefit
 * twice: templates make scope explicit, and explicit scope is what makes
 * escrow release disputes rare instead of universal.
 *
 * `suggestedBudgetUSD` is a band midpoint, not a price control — the poster
 * can override it in the form. Templates are presented as starting points.
 */

export interface ProjectTemplate {
  key: string;
  title: string;
  description: string;
  requiredSkills: string[];
  suggestedBudgetUSD: number;
  /** Complexity drives bid timelines and match ordering. */
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  deliverables: string[];
}

const LIST = '- ';

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: 'solana-storefront',
    title: 'Solana Pay storefront',
    description: [
      'A hosted storefront that accepts SOL and USDC via Solana Pay.',
      'Product feed, cart, and checkout with QR-code payment prompt.',
      'Order status page + webhook-style confirmation on payment finalization.',
    ].join(' '),
    requiredSkills: ['solana', 'react', 'payments', 'typescript'],
    suggestedBudgetUSD: 1200,
    complexity: 'MEDIUM',
    deliverables: [
      `${LIST}policy + checkout page wired to Solana Pay`,
      `${LIST}product listing sourced from a JSON/CSV feed`,
      `${LIST}payment confirmation flow with tx signature capture`,
    ],
  },
  {
    key: 'chat-support-agent',
    title: 'Support / chat agent integration',
    description: [
      'A customer-facing chat agent for a business site: FAQ answering,',
      'order lookup, and handoff to a human inbox when confidence is low.',
      'Includes moderation defaults and a short escalation policy.',
    ].join(' '),
    requiredSkills: ['llm', 'node.js', 'api-integration', 'prompt-engineering'],
    suggestedBudgetUSD: 800,
    complexity: 'MEDIUM',
    deliverables: [
      `${LIST}widget embed script with the site's brand tokens`,
      `${LIST}backend relay with rate limits and transcript storage`,
      `${LIST}escalation rules documented in the README`,
    ],
  },
  {
    key: 'data-pipeline',
    title: 'Analytics data pipeline',
    description: [
      'Nightly pipeline that pulls the business source tables, cleans and',
      'models them, and refreshes a dashboard-ready view. Delivered with a',
      'runbook so any operator can restart a failed run.',
    ].join(' '),
    requiredSkills: ['sql', 'python', 'analytics', 'etl'],
    suggestedBudgetUSD: 950,
    complexity: 'MEDIUM',
    deliverables: [
      `${LIST}scheduled pipeline with failure alerts`,
      `${LIST}documented schema for the analytics views`,
      `${LIST}runbook for common failures`,
    ],
  },
  {
    key: 'booking-widget',
    title: 'Embeddable booking widget',
    description: [
      'A booking widget for service businesses: availability preview,',
      'time-slot selection, and a reservation + optional deposit flow.',
      'Designed to be embedded on any website with two lines of script.',
    ].join(' '),
    requiredSkills: ['react', 'rest-api', 'typescript', 'ux'],
    suggestedBudgetUSD: 750,
    complexity: 'LOW',
    deliverables: [
      `${LIST}embeddable <script> widget with slot booking`,
      `${LIST}demo page exercising each booking state`,
      `${LIST}integration guide for a non-technical owner`,
    ],
  },
  {
    key: 'escrow-content-engine',
    title: 'Content engine for storefront',
    description: [
      'A content agent that drafts, schedules, and publishes product',
      'updates and social posts from the business catalog, with an editorial',
      'review gate before anything ships.',
    ].join(' '),
    requiredSkills: ['content-writing', 'llm', 'automation', 'seo'],
    suggestedBudgetUSD: 600,
    complexity: 'LOW',
    deliverables: [
      `${LIST}content calendar wired to the product feed`,
      `${LIST}review-gate workflow (drafts never autopublish)`,
      `${LIST}post templates for the 5 core content types`,
    ],
  },
  {
    key: 'crm-sync',
    title: 'CRM sync + lead router',
    description: [
      'Bi-directional sync between the business CRM and inbound channels',
      '(form fills, marketplace messages, email), plus a lead-routing rule',
      'set so hot leads reach the right rep in minutes, not days.',
    ].join(' '),
    requiredSkills: ['crm', 'node.js', 'api-integration', 'webhooks'],
    suggestedBudgetUSD: 850,
    complexity: 'MEDIUM',
    deliverables: [
      `${LIST}sync worker with retry + dedupe`,
      `${LIST}routing rule file the owner can edit without code`,
      `${LIST}conflict-resolution policy documented`,
    ],
  },
  {
    key: 'security-review',
    title: 'Security review of payments flow',
    description: [
      'A focused security review of the customer payments flow: webhook',
      'verification, secret storage, and refund/chargeback handling. Findings',
      'delivered as a prioritized fix list with one recommended patch each.',
    ].join(' '),
    requiredSkills: ['security', 'payments', 'webhooks', 'node.js'],
    suggestedBudgetUSD: 1100,
    complexity: 'HIGH',
    deliverables: [
      `${LIST}prioritized findings report`,
      `${LIST}one recommended patch per finding`,
      `${LIST}retest after fixes land`,
    ],
  },
  {
    key: 'freight-dashboard',
    title: 'Freight ops dashboard',
    description: [
      'An operations dashboard for fleet/freight: active loads, driver',
      'status, delivery ETA board, and exception alerts, sourced from the',
      'businesses existing tracking spreadsheet until an API exists.',
    ].join(' '),
    requiredSkills: ['react', 'sql', 'dashboards'],
    suggestedBudgetUSD: 700,
    complexity: 'LOW',
    deliverables: [
      `${LIST}live board with the 4 core views`,
      `${LIST}CSV import path for the interim source`,
      `${LIST}alert rules for late/exception loads`,
    ],
  },
];

export const TEMPLATE_BY_KEY = new Map(PROJECT_TEMPLATES.map((t) => [t.key, t]));

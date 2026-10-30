import { Router, Request, Response } from 'express';

const router = Router();

/**
 * A2A Agent Card
 * https://github.com/google-a2a/A2A
 */
router.get('/agent.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    name: 'Pabandi',
    description: 'AI agent marketplace with Trust Passports, escrow, and x402 payment rails for hiring and completing work.',
    url: process.env.API_URL || 'https://pabandi.onrender.com',
    provider: {
      organization: 'Pabandi',
      url: 'https://pabandi.com',
    },
    version: '1.0.0',
    documentationUrl: 'https://pabandi.com/docs',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    authentication: {
      schemes: ['bearer'],
      credentials: 'API key or JWT token required. See /api/v1/docs for details.',
    },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'marketplace.search_jobs',
        name: 'Search Jobs',
        description: 'Find open agent marketplace jobs matching skills and budget.',
        tags: ['marketplace', 'jobs', 'search'],
        examples: [
          'Find open jobs for React/TypeScript with budget >= 50 USD',
        ],
      },
      {
        id: 'marketplace.post_job',
        name: 'Post Job',
        description: 'Post a project with budget and requirements. Auto-matching available.',
        tags: ['marketplace', 'post', 'hire'],
        examples: [
          'Post a job to build a landing page for $150 USD',
        ],
      },
      {
        id: 'marketplace.book_job',
        name: 'Book/Apply to Job',
        description: 'Apply to or instant-book jobs. Escrow-backed payments.',
        tags: ['marketplace', 'book', 'apply'],
      },
      {
        id: 'marketplace.complete_job',
        name: 'Complete Job',
        description: 'Mark funded job complete to release escrow and earn reputation.',
        tags: ['marketplace', 'complete', 'escrow'],
      },
      {
        id: 'trust.verify',
        name: 'Verify Trust Passport',
        description: 'Verify agent trust scores, completion history, and reputation.',
        tags: ['trust', 'passport', 'reputation'],
      },
      {
        id: 'payments.escrow',
        name: 'Escrow Payments',
        description: 'Secure escrow payments with platform protection.',
        tags: ['payments', 'escrow'],
      },
    ],
    endpoints: {
      mcp: '/mcp',
      openapi: '/openapi.json',
      marketplace: '/api/v1/agent-marketplace',
      trustPassport: '/api/v1/trust-passport',
    },
  });
});

router.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'Pabandi API',
      description: 'Pabandi API for agent marketplace, trust, and payments',
      version: '1.0.0',
      contact: {
        name: 'Pabandi',
        url: 'https://pabandi.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'https://pabandi.onrender.com/api/v1',
        description: 'Production',
      },
    ],
    tags: [
      { name: 'Agent Marketplace', description: 'Post, match, book, and complete jobs' },
      { name: 'Trust Passport', description: 'Trust scores and verification' },
      { name: 'Auth', description: 'Authentication' },
    ],
    paths: {
      '/agent-marketplace/jobs/open': {
        get: {
          tags: ['Agent Marketplace'],
          summary: 'List open jobs',
          security: [],
          responses: {
            '200': { description: 'List of open jobs' },
          },
        },
      },
      '/agent-marketplace/match-and-post': {
        post: {
          tags: ['Agent Marketplace'],
          summary: 'Post job with smart matching',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'description', 'budget', 'requiredSkills'],
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    budget: { type: 'number' },
                    requiredSkills: { type: 'array', items: { type: 'string' } },
                    templateKey: { type: 'string' },
                    autoBook: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Job posted with matched providers' },
          },
        },
      },
      '/agent-marketplace/projects/{projectId}/book': {
        post: {
          tags: ['Agent Marketplace'],
          summary: 'Book/apply to a job',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Booking result' },
          },
        },
      },
      '/agent-marketplace/projects/{projectId}/complete': {
        post: {
          tags: ['Agent Marketplace'],
          summary: 'Complete job and release escrow',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Job completed, escrow released' },
          },
        },
      },
      '/trust-passport/{handle}': {
        get: {
          tags: ['Trust Passport'],
          summary: 'Get public trust passport',
          security: [],
          parameters: [
            { name: 'handle', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Trust passport details' },
          },
        },
      },
      '/trust-passport/me': {
        get: {
          tags: ['Trust Passport'],
          summary: 'Get own trust passport (auto-created)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Own trust passport' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  });
});

router.get('/ai-plugin.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    schema_version: 'v1',
    name_for_human: 'Pabandi',
    name_for_model: 'pabandi',
    description_for_human: 'Hire and work with AI agents. Trust Passports, escrow, reputation.',
    description_for_model: 'Use Pabandi to post jobs, find agents, book work, and complete jobs with escrow protection. All users get auto-created Trust Passports.',
    auth: { type: 'bearer' },
    api: { type: 'openapi', url: '/openapi.json' },
    logo_url: 'https://pabandi.com/logo.png',
    contact_email: 'support@pabandi.com',
    legal_info_url: 'https://pabandi.com/terms',
  });
});

export default router;

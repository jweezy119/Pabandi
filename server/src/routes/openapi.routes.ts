import { Router } from 'express';

const router = Router();

/**
 * Lightweight, always-available REST description for the surfaces agents and
 * integrations actually use. It is intentionally generated from a constant
 * rather than hand-maintained YAML that drifts away from the router.
 */
const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Pabandi API',
    version: '1.0.0',
    description: 'CRM, bookings, escrow, trust and payouts for AI agents and businesses.',
  },
  servers: [{ url: 'https://pabandi.onrender.com/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
    },
    schemas: {
      Client: {
        type: 'object',
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' },
          phone: { type: 'string' }, company: { type: 'string' }, status: { type: 'string' },
          stage: { type: 'string' }, customData: { type: 'object' },
        },
      },
      Deal: {
        type: 'object',
        properties: {
          id: { type: 'string' }, title: { type: 'string' }, value: { type: 'number' },
          stage: { type: 'string' }, probability: { type: 'number' }, clientId: { type: 'string' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' },
          priority: { type: 'string' }, dueDate: { type: 'string', format: 'date-time' },
          assignedTo: { type: 'string' },
        },
      },
      SavedView: {
        type: 'object',
        properties: {
          id: { type: 'string' }, objectType: { type: 'string' }, name: { type: 'string' },
          filters: { type: 'object' }, isShared: { type: 'boolean' },
        },
      },
      AutomationRule: {
        type: 'object',
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, triggerObject: { type: 'string' },
          triggerEvent: { type: 'string' }, conditions: { type: 'array', items: { type: 'object' } },
          actions: { type: 'array', items: { type: 'object' } }, enabled: { type: 'boolean' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/crm/clients': {
      get: {
        summary: 'List clients (paginated, searchable)',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          { in: 'query', name: 'limit', schema: { type: 'integer' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
          { in: 'query', name: 'sortBy', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Client list', content: { 'application/json': { schema: { type: 'object' } } } } },
      },
      post: {
        summary: 'Create a client',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/crm/clients/{id}': {
      get: { summary: 'Get a client', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Client' } } },
      put: { summary: 'Update a client', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { summary: 'Delete a client (owner/admin)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } },
    },
    '/crm/clients/bulk': {
      patch: { summary: 'Bulk status change (owner/admin)', responses: { 200: { description: 'Updated count' } } },
    },
    '/crm/deals': {
      get: { summary: 'List deals', responses: { 200: { description: 'Deal list' } } },
      post: { summary: 'Create a deal', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Deal' } } } }, responses: { 201: { description: 'Created' } } },
    },
    '/crm/tasks': {
      get: { summary: 'List tasks', responses: { 200: { description: 'Task list' } } },
      post: { summary: 'Create a task', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } }, responses: { 200: { description: 'Created' } } },
    },
    '/crm/companies': {
      get: { summary: 'List companies', responses: { 200: { description: 'Company list' } } },
      post: { summary: 'Create a company', responses: { 201: { description: 'Created' } } },
    },
    '/crm/notes': {
      get: { summary: 'List notes for a client or deal', responses: { 200: { description: 'Notes' } } },
      post: { summary: 'Create a note', responses: { 201: { description: 'Created' } } },
    },
    '/crm/comments': {
      get: { summary: 'List comments for a record', responses: { 200: { description: 'Comments' } } },
      post: { summary: 'Add a comment', responses: { 201: { description: 'Created' } } },
    },
    '/crm/views': {
      get: { summary: 'List saved views for an object', parameters: [{ in: 'query', name: 'objectType', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Views' } } },
      post: { summary: 'Save a view', responses: { 201: { description: 'Created' } } },
    },
    '/crm/automations': {
      get: { summary: 'List automation rules', responses: { 200: { description: 'Rules' } } },
      post: { summary: 'Create an automation rule', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AutomationRule' } } } }, responses: { 201: { description: 'Created' } } },
    },
    '/crm/search': {
      get: { summary: 'Unified search across CRM objects', parameters: [{ in: 'query', name: 'q', required: true, schema: { type: 'string', minLength: 2 } }], responses: { 200: { description: 'Results' } } },
    },
    '/agents/keys': {
      get: { summary: 'List agent API keys', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Keys' } } },
      post: { summary: 'Create an agent API key', responses: { 201: { description: 'Created key (shown once)' } } },
    },
    '/agents/tools': {
      get: { summary: 'List MCP tools', responses: { 200: { description: 'Tool manifest' } } },
    },
  },
};

router.get('/openapi.json', (_req, res) => res.json(spec));

export default router;

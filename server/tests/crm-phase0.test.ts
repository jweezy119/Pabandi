import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (rel: string) => readFileSync(resolve(__dirname, '../src', rel), 'utf8');

describe('CRM broken-surface fixes', () => {
  it('returns a palette-compatible multi-entity search payload', () => {
    const routes = src('routes/crm.routes.ts');
    const search = routes.slice(routes.indexOf("router.get('/search'"), routes.indexOf('// ── Dashboard'));
    expect(search).toMatch(/q\.length < 2/);
    expect(search).toMatch(/ok\(res, \{ results \}\)/);
    for (const type of ['client', 'deal', 'job', 'invoice', 'activity']) {
      expect(search).toContain(`type: '${type}'`);
    }
    // Tenant scope must be AND-ed, not overwritten by the text-match OR.
    expect(search).toMatch(/AND: \[crmScope/);
  });

  it('mounts the team and API-key endpoints the settings pages call', () => {
    const index = src('routes/index.ts');
    expect(index).toMatch(/\['\/team', '\.\/team.routes'\]/);
    expect(index).toMatch(/\['\/api-keys', '\.\/apiKeys.routes'\]/);
  });

  it('backs team pages with tenant-scoped CrmEmployee queries', () => {
    const team = src('routes/team.routes.ts');
    expect(team).toMatch(/ownedEmployee/);
    expect(team).not.toMatch(/scope\(crm\.businessId!\) &&/);
    expect(team).toMatch(/\/invite/);
  });

  it('uses the real agent key store for CRM API keys', () => {
    const keys = src('routes/apiKeys.routes.ts');
    expect(keys).toMatch(/createAgentKey/);
    expect(keys).toMatch(/listAgentKeys/);
    expect(keys).toMatch(/revokeAgentKey/);
  });

  it('persists custom fields on client, deal and task records', () => {
    const routes = src('routes/crm.routes.ts');
    expect(routes.match(/patch\.customData = customData/g)?.length).toBeGreaterThanOrEqual(3);
    const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    expect(schema.match(/customData\s+Json\?/g)?.length).toBeGreaterThanOrEqual(3);
    const shipped = readFileSync(resolve(__dirname, '../sql/shipped-migrations.sql'), 'utf8');
    expect(shipped).toMatch(/ADD COLUMN IF NOT EXISTS "customData" JSONB/);
  });

  it('rejects the invalid TASK activity option in the client', () => {
    const detail = readFileSync(
      resolve(__dirname, '../../client/src/pages/contact/ContactClientDetailPage.tsx'),
      'utf8',
    );
    expect(detail).not.toMatch(/<option value="TASK">/);
  });
});

describe('CRM saved views and bulk actions', () => {
  it('persists saved views per object with tenant-scoped reads', () => {
    const routes = src('routes/crm.routes.ts');
    expect(routes).toMatch(/router\.get\('\/views'/);
    expect(routes).toMatch(/router\.post\('\/views'/);
    expect(routes).toMatch(/router\.delete\('\/views\/:id'/);
    const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    expect(schema).toMatch(/model CrmSavedView/);
  });

  it('exposes a validated bulk status endpoint before the /:id route', () => {
    const routes = src('routes/crm.routes.ts');
    const bulk = routes.indexOf("router.patch('/clients/bulk'");
    const byId = routes.indexOf("router.get('/clients/:id'");
    expect(bulk).toBeGreaterThan(-1);
    expect(bulk).toBeLessThan(byId);
    expect(routes).toMatch(/CLIENT_STATUSES as readonly string\[\]/);
  });

  it('adds creation commands to the palette', () => {
    const palette = readFileSync(
      resolve(__dirname, '../../client/src/components/CommandPalette.tsx'),
      'utf8',
    );
    for (const label of ['New Client', 'New Deal', 'New Task', 'New Invoice']) {
      expect(palette).toContain(label);
    }
  });

  it('supports drag and drop on the kanban board', () => {
    const board = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/components/DealKanbanBoard.tsx'),
      'utf8',
    );
    expect(board).toMatch(/draggable/);
    expect(board).toMatch(/onDrop/);
  });
});

describe('CRM data depth', () => {
  it('adds first-class company, note and comment objects', () => {
    const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    for (const model of ['CrmCompany', 'CrmNote', 'CrmComment']) {
      expect(schema).toContain(`model ${model}`);
    }
    const routes = src('routes/crm.routes.ts');
    for (const path of ['/companies', '/notes', '/comments']) {
      expect(routes).toContain(`router.get('${path}'`);
      expect(routes).toContain(`router.post('${path}'`);
    }
  });

  it('exposes task assignee UI and the notes/comments panel', () => {
    const taskForm = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/components/TaskFormModal.tsx'),
      'utf8',
    );
    expect(taskForm).toMatch(/assignedTo/);
    const detail = readFileSync(
      resolve(__dirname, '../../client/src/pages/contact/ContactClientDetailPage.tsx'),
      'utf8',
    );
    expect(detail).toMatch(/NotesCommentsPanel/);
  });

  it('routes the companies page and adds it to CRM navigation', () => {
    const app = readFileSync(resolve(__dirname, '../../client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/path="contact\/companies"/);
    const nav = readFileSync(
      resolve(__dirname, '../../client/src/components/DashboardLayout.tsx'),
      'utf8',
    );
    expect(nav).toMatch(/path: '\/contact\/companies'/);
  });
});

describe('CRM automation and permissions', () => {
  it('emits signed webhooks and rule actions on record events', () => {
    const service = src('services/crmAutomation.service.ts');
    expect(service).toMatch(/createHmac\('sha256'/);
    expect(service).toMatch(/x-pabandi-signature/);
    for (const action of ['setStatus', 'createTask', 'notify']) {
      expect(service).toContain(`case '${action}'`);
    }
    const routes = src('routes/crm.routes.ts');
    expect(routes.match(/emitCrmEvent\(/g)?.length).toBeGreaterThanOrEqual(6);
    expect(routes).toMatch(/router\.get\('\/automations'/);
  });

  it('uses the real session role instead of a hardcoded owner', () => {
    const context = src('middleware/crmContext.middleware.ts');
    expect(context).toMatch(/isOwner: biz\.ownerId === userId/);
    expect(context).toMatch(/role: req\.user\?\.role/);
    const routes = src('routes/crm.routes.ts');
    expect(routes).toMatch(/function assertManager/);
  });

  it('wires the automation settings UI', () => {
    const app = readFileSync(resolve(__dirname, '../../client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/contact\/settings\/automations/);
  });
});

describe('CRM inline editing, preview and API docs', () => {
  it('serves an OpenAPI description on the versioned API', () => {
    const index = src('routes/index.ts');
    expect(index).toMatch(/openapi\.routes/);
    const spec = src('routes/openapi.routes.ts');
    expect(spec).toMatch(/openapi: '3\.0\.3'/);
    for (const path of ['/crm/clients', '/crm/deals', '/crm/tasks', '/crm/automations', '/agents/tools']) {
      expect(spec).toContain(`'${path}'`);
    }
  });

  it('provides a metadata layer for custom objects, fields and records', () => {
    const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    for (const model of ['CrmObjectDefinition', 'CrmFieldDefinition', 'CrmCustomRecord', 'CrmBuilderProgress']) {
      expect(schema).toContain(`model ${model}`);
    }
    const routes = src('routes/crmBuilder.routes.ts');
    for (const endpoint of ['/objects', '/objects/:id/fields', '/objects/:id/records', '/progress']) {
      expect(routes).toContain(`'${endpoint}'`);
    }
    expect(routes).toMatch(/createHmac|award\(/);
  });

  it('supports shareable blueprint templates', () => {
    const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('model CrmBlueprintTemplate');
    const routes = src('routes/crmBuilder.routes.ts');
    for (const endpoint of ['/templates', '/templates/:id/use']) {
      expect(routes).toContain(`'${endpoint}'`);
    }
    expect(routes).toMatch(/BUILTIN_TEMPLATES/);
  });

  it('gives standard objects the same custom-field metadata as custom objects', () => {
    const clientPage = readFileSync(
      resolve(__dirname, '../../client/src/pages/contact/ContactClientsPage.tsx'),
      'utf8',
    );
    expect(clientPage).toMatch(/customFields\?\.Client \?\? settings\?\.customFields\?\.client/);
    const deal = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/components/DealFormModal.tsx'),
      'utf8',
    );
    expect(deal).toMatch(/CustomFieldsRenderer/);
    const task = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/components/TaskFormModal.tsx'),
      'utf8',
    );
    expect(task).toMatch(/CustomFieldsRenderer/);
    const settings = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/settings/CustomFieldsPage.tsx'),
      'utf8',
    );
    expect(settings).toMatch(/<option value="select">Choice<\/option>/);
  });

  it('wires real IMAP/CalDAV sync with encrypted credentials', () => {
    const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('model CrmMailAccount');
    expect(schema).toContain('model CrmCalendarAccount');
    const service = src('services/channelSync.service.ts');
    expect(service).toMatch(/from 'imapflow'/);
    expect(service).toMatch(/from 'tsdav'/);
    expect(service).toMatch(/decrypt\(/);
    expect(service).toMatch(/syncAllChannels/);
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
    expect(pkg.scripts.worker).toMatch(/dist\/src\/queues\/worker\.js/);
    const worker = src('queues/worker.ts');
    expect(worker).toMatch(/new Worker/);
    expect(worker).toMatch(/runEmailJob/);
  });

  it('exposes channel account setup in CRM settings', () => {
    const app = readFileSync(resolve(__dirname, '../../client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/contact\/settings\/channels/);
    const page = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/settings/ChannelsSettingsPage.tsx'),
      'utf8',
    );
    expect(page).toMatch(/channels\/mail/);
    expect(page).toMatch(/channels\/calendar/);
  });

  it('ships a signed, provider-agnostic email/calendar channel layer', () => {
    const routes = src('routes/channels.routes.ts');
    expect(routes).toMatch(/router\.get\('\/:businessId\/messages'/);
    expect(routes).toMatch(/router\.post\('\/route'/);
    expect(routes).toMatch(/router\.post\('\/ingest'/);
    expect(routes).toMatch(/CHANNEL_INGEST_SECRET/);
    expect(routes).toMatch(/createHmac\('sha256'/);
    expect(routes).toMatch(/type: channel === 'CALENDAR' \? 'MEETING' : 'EMAIL'/);
    const index = src('routes/index.ts');
    expect(index).toMatch(/\['\/channels', '\.\/channels.routes'\]/);
  });

  it('makes custom objects first-class navigation with their own views', () => {
    const hook = readFileSync(
      resolve(__dirname, '../../client/src/hooks/useCustomObjects.ts'),
      'utf8',
    );
    expect(hook).toMatch(/crm\/builder\/objects/);
    const nav = readFileSync(
      resolve(__dirname, '../../client/src/components/DashboardLayout.tsx'),
      'utf8',
    );
    expect(nav).toMatch(/useCustomObjects/);
    expect(nav).toMatch(/\/contact\/objects\//);
    const page = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/CustomObjectPage.tsx'),
      'utf8',
    );
    expect(page).toMatch(/'table' \| 'kanban'/);
    expect(page).toMatch(/onDragStart/);
    const app = readFileSync(resolve(__dirname, '../../client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/path="contact\/objects\/:objectId"/);
  });

  it('ships an animated guided builder with blueprints and a game HUD', () => {
    const page = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/CrmBuilderPage.tsx'),
      'utf8',
    );
    for (const marker of ['BLUEPRINTS', 'FIELD_CARDS', 'motion.button', 'confetti', 'Level {level}', '+50 XP']) {
      expect(page).toContain(marker);
    }
    const app = readFileSync(resolve(__dirname, '../../client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/path="contact\/builder"/);
  });

  it('wires inline editing and the side-panel preview into the clients list', () => {
    const table = readFileSync(
      resolve(__dirname, '../../client/src/pages/crm/components/ClientListTable.tsx'),
      'utf8',
    );
    expect(table).toMatch(/InlineEdit/);
    expect(table).toMatch(/onPreview/);
    const page = readFileSync(
      resolve(__dirname, '../../client/src/pages/contact/ContactClientsPage.tsx'),
      'utf8',
    );
    expect(page).toMatch(/ClientPreviewPanel/);
    expect(page).toMatch(/handleInlineUpdate/);
  });
});

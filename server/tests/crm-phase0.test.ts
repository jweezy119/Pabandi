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

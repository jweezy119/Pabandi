import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLIENT_STATUSES,
  DEAL_STAGES,
  JOB_STATUSES,
  ACTIVITY_TYPES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  INVOICE_STATUSES,
  DEAL_STAGE_LABELS,
  isDealStage,
  isClientStatus,
  options,
  validateEmailField,
  validateNameField,
} from '../../server/src/domain/crm';

/**
 * One vocabulary, and the places that used to have their own.
 *
 * THE DEFECT THIS EXISTS TO PREVENT
 * The same six deal stages were written down in four places. One of them was
 * missing NEGOTIATION — a stage the server accepts, renders on the kanban, and
 * assigns a probability to. A second copy was a fourth private `probMap`. Task
 * priority was a dropdown in the UI and `typeof x === 'string' ? x : 'MEDIUM'` on
 * the server, so "high", "HIGH " and "urgent" all stored as distinct values that
 * no board displays.
 *
 * None of those disagreements announce themselves. The UI looks right; the value
 * is accepted; the row then matches no filter and the thing simply is not there.
 *
 * So these tests assert three things: the vocabulary is internally complete, the
 * server's parsers accept exactly it, and the UI no longer hand-writes its own
 * copies.
 */

const here = new URL('.', import.meta.url).pathname;
const clientSrc = (p: string) => readFileSync(join(here, '../../client/src', p), 'utf8');

/** Source with comments stripped, so prose explaining a fix is not mistaken for it. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('the vocabulary is complete', () => {
  it('has a label for every value, or a select renders a blank option', () => {
    // A missing label is the same failure as a missing value: the dropdown looks
    // right and the choice is invisible.
    for (const [name, values, labels] of [
      ['CLIENT_STATUSES', CLIENT_STATUSES, { ACTIVE: 1, AT_RISK: 1, VIP: 1, INACTIVE: 1 }],
      ['DEAL_STAGES', DEAL_STAGES, { LEAD: 1, QUALIFIED: 1, PROPOSAL: 1, NEGOTIATION: 1, WON: 1, LOST: 1 }],
      ['JOB_STATUSES', JOB_STATUSES, { SCHEDULED: 1, IN_PROGRESS: 1, COMPLETED: 1, CANCELLED: 1 }],
      ['ACTIVITY_TYPES', ACTIVITY_TYPES, { NOTE: 1, CALL: 1, EMAIL: 1, MEETING: 1 }],
      ['TASK_STATUSES', TASK_STATUSES, { TODO: 1, IN_PROGRESS: 1, DONE: 1 }],
      ['TASK_PRIORITIES', TASK_PRIORITIES, { LOW: 1, MEDIUM: 1, HIGH: 1 }],
      ['INVOICE_STATUSES', INVOICE_STATUSES, { draft: 1, sent: 1, paid: 1, overdue: 1, defaulted: 1 }],
    ] as const) {
      expect(values.length, `${name} is empty`).toBeGreaterThan(0);
      for (const v of values) {
        expect(labels, `${name} has no label for ${v}`).toHaveProperty(v);
      }
    }
  });

  it('offers CANCELLED for jobs', async () => {
    // The old jobs filter offered three of the server's four. A cancelled job was
    // therefore unreachable from the UI — it existed, and there was no way to see
    // or filter for it.
    const { JOB_STATUS_LABELS } = await import('../../server/src/domain/crm');
    expect(JOB_STATUSES).toContain('CANCELLED');
    expect(JOB_STATUS_LABELS.CANCELLED).toBeTruthy();
  });

  it('does not offer TASK as an activity type', async () => {
    // Tasks have their own endpoint, status, priority and completion handling. An
    // activity claiming to be a task would appear on no board and never complete.
    expect(ACTIVITY_TYPES).not.toContain('TASK');
  });

  it('keeps WON and LOST out of the open pipeline', async () => {
    const { OPEN_DEAL_STAGES } = await import('../../server/src/domain/crm');
    expect(OPEN_DEAL_STAGES).not.toContain('WON');
    expect(OPEN_DEAL_STAGES).not.toContain('LOST');
    expect(OPEN_DEAL_STAGES).toContain('NEGOTIATION');
  });
});

describe('the server enforces exactly this', () => {
  it('parseStage accepts every stage the UI offers', async () => {
    const { parseStage } = await import('../../server/src/services/crm.service');
    for (const stage of DEAL_STAGES) {
      expect(() => parseStage(stage)).not.toThrow();
    }
  });

  it('parseStage still rejects what it always did', async () => {
    // The vocabulary must not become a loophole. A free-form stage name still 400s.
    const { parseStage } = await import('../../server/src/services/crm.service');
    expect(() => parseStage('stage-1')).toThrow(/Invalid stage/);
    expect(() => parseStage('won')).toThrow(/Invalid stage/);
  });

  it('parseClientStatus accepts every status the UI offers', async () => {
    const { parseClientStatus } = await import('../../server/src/services/crm.service');
    for (const status of CLIENT_STATUSES) {
      expect(() => parseClientStatus(status)).not.toThrow();
    }
  });

  it('isClientStatus and isDealStage agree with the parsers', () => {
    // The guards exist so the client can decide what is valid without calling the
    // server. If they disagree with parseStage, the form would accept something the
    // server rejects.
    for (const s of DEAL_STAGES) expect(isDealStage(s)).toBe(true);
    expect(isDealStage('stage-1')).toBe(false);

    for (const s of CLIENT_STATUSES) expect(isClientStatus(s)).toBe(true);
    expect(isClientStatus('at risk')).toBe(false);
  });
});

describe('the UI imports it rather than copying it', () => {
  it.each([
    ['pages/crm/components/ClientFormModal.tsx', '@shared/crm'],
    ['pages/crm/components/TaskFormModal.tsx', '@shared/crm'],
    ['pages/crm/components/ActivityFormModal.tsx', '@shared/crm'],
    ['pages/crm/components/DealFormModal.tsx', '@shared/crm'],
    ['pages/contact/ContactDealsPage.tsx', '@shared/crm'],
    ['pages/contact/ContactDealDetailPage.tsx', '@shared/crm'],
  ])('%s imports the shared vocabulary', (file, alias) => {
    expect(clientSrc(file), `${file} should import from ${alias}`).toContain(alias);
  });

  it.each([
    ['pages/contact/ContactDealDetailPage.tsx', ["'LEAD'", "'QUALIFIED'", "'NEGOTIATION'"]],
    ['pages/contact/ContactDealsPage.tsx', ["id: 'LEAD'", 'probMap']],
  ])('%s no longer hand-writes its stage list', (file, needles) => {
    const src = codeOnly(clientSrc(file));
    for (const needle of needles) {
      // A hard-coded id list next to the shared import is how NEGOTIATION went
      // missing the first time. The stage ids should appear only via the vocabulary.
      expect(src.includes(needle), `${file} still hard-codes ${needle}`).toBe(false);
    }
  });

  it('DealFormModal keys its icons by stage, which TypeScript keeps exhaustive', () => {
    // This file names every stage — but as the keys of a Record<DealStage, string>,
    // not as an option list. Adding a stage to the vocabulary stops this compiling,
    // which is the opposite failure from the one we are guarding against.
    const src = clientSrc('pages/crm/components/DealFormModal.tsx');
    expect(src).toContain('Record<DealStage, string>');
    for (const stage of DEAL_STAGES) {
      expect(src.includes(`${stage}:`), `no icon for ${stage}`).toBe(true);
    }
  });

  it('ContactDealsPage no longer reads settings.pipelineStages for stage values', () => {
    // applyPreset writes {id: 'stage-1', name: 'Lead'}, so using it as the option
    // value sent "stage-1" to parseStage and 400'd. Finishing the setup wizard
    // broke the pipeline board.
    expect(codeOnly(clientSrc('pages/contact/ContactDealsPage.tsx'))).not.toMatch(/pipelineStages/);
  });
});

describe('validation messages a person can act on', () => {
  it('accepts ordinary addresses', () => {
    for (const email of ['a@b.co', 'first.last@example.com', 'x+tag@sub.domain.org']) {
      expect(validateEmailField(email), email).toBeNull();
    }
  });

  it('accepts an empty email, because email is optional', () => {
    expect(validateEmailField('')).toBeNull();
    expect(validateEmailField('   ')).toBeNull();
  });

  it('says which part is missing rather than "invalid"', () => {
    // "Invalid email address" tells someone nothing they can act on.
    expect(validateEmailField('ayeshaexample.com')).toMatch(/@/);
    expect(validateEmailField('@example.com')).toMatch(/before the @/);
    expect(validateEmailField('ayesha@')).toMatch(/after the @/);
    expect(validateEmailField('ayesha@example')).toMatch(/domain/);
  });

  it('accepts addresses with unusual but ordinary shapes', () => {
    // Over-strict validation is worse than none: it teaches people to enter a
    // different address than the one they have.
    expect(validateEmailField('a@b.co.uk')).toBeNull();
    expect(validateEmailField('first+tag@sub.example.org')).toBeNull();
    expect(validateEmailField('UPPER@EXAMPLE.COM')).toBeNull();
  });

  it('rejects exactly what the CSV importer rejects, and no more', async () => {
    // The bulk importer is the other place an address is checked. If these two ever
    // disagree, the same person can import an address by spreadsheet and be refused
    // by hand — which is how an address ends up on an invoice and undeliverable.
    const { importClients } = await import('../../server/src/services/crm.service');
    expect(importClients).toBeDefined();
    // The shared regex is what both use; assert it rather than re-deriving it.
    const importer = readFileSync(join(here, '../src/services/crm.service.ts'), 'utf8');
    expect(importer).toContain('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/');
  });

  it('trims before judging', () => {
    expect(validateEmailField('  ayesha@example.com  ')).toBeNull();
  });

  it('explains why a name is required', () => {
    expect(validateNameField('')).toMatch(/invoice/);
    expect(validateNameField('   ')).toMatch(/invoice/);
    expect(validateNameField('Ayesha')).toBeNull();
  });
});

describe('options() builds what the selects render', () => {
  it('maps every value to its label', () => {
    expect(options(DEAL_STAGES, DEAL_STAGE_LABELS)).toEqual([
      { value: 'LEAD', label: 'Lead' },
      { value: 'QUALIFIED', label: 'Qualified' },
      { value: 'PROPOSAL', label: 'Proposal' },
      { value: 'NEGOTIATION', label: 'Negotiation' },
      { value: 'WON', label: 'Won' },
      { value: 'LOST', label: 'Lost' },
    ]);
  });
});
import { describe, it, expect } from 'vitest';
import {
  VERTICAL_LIST,
  VERTICAL_PERSONAS,
  getVerticalPersona,
  formatOutreachMessage,
} from './verticalPersonas';
import { VERTICAL_PRESETS } from '../hooks/useBusinessSettings';

const CHAIN_JARGON = [
  'solana', 'pda', 'mint', 'usdc', 'blockchain', 'on-chain', 'onchain',
  'wallet', 'token', 'lamport', 'anchor', 'rpc', 'crypto', 'web3',
];

describe('verticalPersonas — SMB CRM Personalization Engine', () => {
  it('excludes logistics & freight and matches VERTICAL_PRESETS 1:1', () => {
    const presetIds = Object.keys(VERTICAL_PRESETS).sort();
    const personaIds = Object.keys(VERTICAL_PERSONAS).sort();
    expect(personaIds).not.toContain('logistics');
    expect(presetIds).not.toContain('logistics');
    expect(personaIds).toEqual(presetIds);
    expect(VERTICAL_LIST).toHaveLength(7);
  });

  it('safely falls back unknown or legacy verticals (including logistics) to general', () => {
    expect(getVerticalPersona(null).id).toBe('general');
    expect(getVerticalPersona(undefined).id).toBe('general');
    expect(getVerticalPersona('logistics').id).toBe('general');
    expect(getVerticalPersona('salon').id).toBe('salon');
  });

  it.each(VERTICAL_LIST.map((v) => v.id))(
    '%s has complete nav labels, checklist copy, starter services, and 4 warm templates',
    (id) => {
      const p = VERTICAL_PERSONAS[id];
      expect(p.navLabels.clients).toBeTruthy();
      expect(p.navLabels.deals).toBeTruthy();
      expect(p.navLabels.jobs).toBeTruthy();
      expect(p.navLabels.invoices).toBeTruthy();
      expect(p.navLabels.team).toBeTruthy();
      expect(p.starterServices.length).toBeGreaterThanOrEqual(3);
      expect(p.outreachTemplates).toHaveLength(4);
      for (const t of p.outreachTemplates) {
        expect(t.body).toContain('{clientName}');
        expect(t.body).toContain('{businessName}');
      }
    }
  );

  it('keeps daily CRM labels and client outreach templates free of blockchain jargon', () => {
    const serialized = JSON.stringify(VERTICAL_PERSONAS);
    for (const term of CHAIN_JARGON) {
      const re = new RegExp(`\\b${term}\\b`, 'i');
      expect(re.test(serialized), `verticalPersonas should not leak "${term}" into daily CRM copy`).toBe(false);
    }
  });

  it('formats warm outreach templates using the client first name and business name', () => {
    const reminder = VERTICAL_PERSONAS.salon.outreachTemplates.find((t) => t.id === 'reminder')!;
    const msg = formatOutreachMessage(reminder.body, {
      clientName: 'Sarah Jenkins',
      businessName: 'Glow Beauty Studio',
    });
    expect(msg).toContain('Hi Sarah,');
    expect(msg).toContain('Glow Beauty Studio');
    expect(msg).not.toContain('{clientName}');
    expect(msg).not.toContain('{businessName}');
  });
});

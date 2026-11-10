import { describe, it, expect } from 'vitest';
import { SHARIA_COMPLIANCE_PAYLOAD } from '../compliance.routes';

describe('Sharia Compliance REST Endpoint & Payload', () => {
  it('returns compliant AAOIFI standards declaration', () => {
    expect(SHARIA_COMPLIANCE_PAYLOAD.is_compliant).toBe(true);
    expect(SHARIA_COMPLIANCE_PAYLOAD.standard).toBe('AAOIFI Sharia Standards');
  });

  it('guarantees key feature flags for Islamic Finance', () => {
    expect(SHARIA_COMPLIANCE_PAYLOAD.features.riba_free).toBe(true);
    expect(SHARIA_COMPLIANCE_PAYLOAD.features.gharar_mitigated).toBe(true);
    expect(SHARIA_COMPLIANCE_PAYLOAD.features.asset_backed).toBe(true);
  });

  it('provides plain-language explanations for all 3 principles', () => {
    expect(SHARIA_COMPLIANCE_PAYLOAD.principles.no_riba).toContain('Mudarabah');
    expect(SHARIA_COMPLIANCE_PAYLOAD.principles.no_gharar).toContain('Anchor smart contracts');
    expect(SHARIA_COMPLIANCE_PAYLOAD.principles.no_maisir).toContain('utility token');
  });

  it('declares valid certificate URL', () => {
    expect(SHARIA_COMPLIANCE_PAYLOAD.certificate_url).toBe('https://pabandi.com/sharia-compliance');
  });
});


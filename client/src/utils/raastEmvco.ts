/**
 * EMVCo-compliant Raast QR Payload Generator (State Bank of Pakistan Standard)
 *
 * Implements EMVCo Merchant-Presented Mode (MPM) Specification
 * with SBP Raast interoperable tags (AID pk.gov.sbp.raast).
 */

// CRC-16 CCITT (Polynomial 0x1021, Initial 0xFFFF) required by EMVCo Tag 63
function computeCrc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatEmvTag(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

export interface RaastQrParams {
  raastId: string; // Mobile number (e.g. 03001234567) or IBAN (e.g. PK00...)
  amountPkr?: number;
  referenceId?: string;
  merchantName?: string;
  merchantCity?: string;
}

/**
 * Generates an interoperable EMVCo QR code string recognized by Pakistani
 * mobile banking apps (NayaPay, SadaPay, Easypaisa, JazzCash, Meezan, HBL, Alfalah).
 */
export function generateRaastEmvcoPayload(params: RaastQrParams): string {
  const rawId = (params.raastId || '03001234567').trim();
  const cleanId = rawId.startsWith('+92')
    ? '0' + rawId.slice(3)
    : rawId.startsWith('92')
    ? '0' + rawId.slice(2)
    : rawId;

  const merchantName = (params.merchantName || 'Pabandi').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 25);
  const merchantCity = (params.merchantCity || 'Karachi').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15);
  const ref = (params.referenceId || 'PBN').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);

  // Sub-tags for Merchant Account Information (Tag 26)
  // Subtag 00: Globally Unique Identifier (pk.gov.sbp.raast)
  // Subtag 01: Raast Alias (Phone) or IBAN
  const tag26Sub00 = formatEmvTag('00', 'pk.gov.sbp.raast');
  const tag26Sub01 = formatEmvTag('01', cleanId);
  const tag26Value = `${tag26Sub00}${tag26Sub01}`;

  // Sub-tags for Additional Data Field (Tag 62)
  // Subtag 01: Bill / Reference ID
  const tag62Sub01 = formatEmvTag('01', ref);

  let payload = '';
  payload += formatEmvTag('00', '01'); // Payload Format Indicator
  payload += formatEmvTag('01', params.amountPkr ? '12' : '11'); // 12 = Dynamic (amount fixed), 11 = Static
  payload += formatEmvTag('26', tag26Value); // SBP Raast Account Info
  payload += formatEmvTag('52', '5411'); // Merchant Category Code (General Grocery/Service)
  payload += formatEmvTag('53', '586'); // Currency Code (586 = PKR ISO 4217)

  if (params.amountPkr && params.amountPkr > 0) {
    const amtStr = Math.round(params.amountPkr).toString();
    payload += formatEmvTag('54', amtStr); // Amount
  }

  payload += formatEmvTag('58', 'PK'); // Country Code
  payload += formatEmvTag('59', merchantName); // Merchant Name
  payload += formatEmvTag('60', merchantCity); // Merchant City
  payload += formatEmvTag('62', tag62Sub01); // Additional reference info

  // Tag 63: CRC with 4 placeholder zeroes, then computed
  payload += '6304';
  const checksum = computeCrc16Ccitt(payload);

  return `${payload.slice(0, -4)}6304${checksum}`;
}

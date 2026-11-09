import crypto from 'crypto';

// Encryption key resolution: 32 bytes for AES-256-GCM
const ENCRYPTION_SECRET = process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET || 'pabandi-default-pii-secret-key-32bytes!';
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

/**
 * Encrypt a phone number or PII string at rest using AES-256-GCM.
 * Formatted as: iv:authTag:ciphertext
 */
export function encryptPii(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted PII string.
 */
export function decryptPii(cipherBlob: string): string {
  if (!cipherBlob) return '';
  // If not encrypted format, return as-is
  if (!cipherBlob.includes(':')) return cipherBlob;
  
  try {
    const [ivHex, authTagHex, encryptedHex] = cipherBlob.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return cipherBlob;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, never crash, return redacted placeholder
    return '[Encrypted PII]';
  }
}

/**
 * Mask a phone number for logs and technician views:
 * e.g. +923001234567 -> +92******567 or +15551234 -> +1******234
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.trim();
  if (clean.length <= 6) return '******';
  const prefix = clean.slice(0, 3);
  const suffix = clean.slice(-3);
  return `${prefix}${'*'.repeat(Math.max(4, clean.length - 6))}${suffix}`;
}

/**
 * Mask an address for public or external logging:
 * Redacts street number, preserves city/neighborhood
 */
export function maskAddress(address: string): string {
  if (!address) return '';
  // Replace leading street numbers: "1248 Industrial Blvd, Suite 400" -> "**** Industrial Blvd, Suite 400"
  return address.replace(/^\d+/, '****');
}


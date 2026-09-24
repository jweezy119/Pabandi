"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
function requireEncryptionKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (!envKey) {
        const isProd = process.env.NODE_ENV === 'production';
        if (isProd) {
            throw new Error('ENCRYPTION_KEY is not set in the environment. ' +
                'This is required in production — wallet secrets and other encrypted data ' +
                'cannot be decrypted without a stable key. Set a 64-character hex string.');
        }
        // Dev-only fallback: deterministic per-process so developer experience isn't
        // broken, but still warn because any persisted ciphertext will be undecodable
        // after a restart even in dev.
        console.warn('[encryption] ENCRYPTION_KEY not set — using per-process random key. ' +
            'Any encrypted data persists across restarts ONLY if this env var is configured.');
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    if (envKey.length !== 64) {
        throw new Error(`ENCRYPTION_KEY must be a 64-character hex string (got ${envKey.length} chars).`);
    }
    return envKey;
}
// Resolved once at module load — stable across the process lifetime.
// In production this throws if missing; in dev it warns and falls back.
const ENCRYPTION_KEY = requireEncryptionKey();
const IV_LENGTH = 16;
/**
 * Encrypts a string (like a base58 secret key) into an encrypted hex string.
 */
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
            'In production this must be set explicitly in the environment — ' +
            'the fallback randomBytes() would make decryption impossible after a restart.');
    }
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}
/**
 * Decrypts the encrypted hex string back to the original string.
 */
function decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format.');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
    }
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
//# sourceMappingURL=encryption.js.map
import { redactSecrets } from '../security/aiGuard';

const redactPII = (data: any): any => {
  // Strings get value-shaped redaction, not key-based: upstream API errors
  // frequently REPEAT a credential in the message body ("Invalid key: sk-..."),
  // and key-name matching never sees it.
  if (typeof data === 'string') return redactSecrets(data);
  if (typeof data !== 'object' || data === null) return data;
  if (Array.isArray(data)) return data.map(redactPII);

  const result = { ...data };
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'apiKey', 'secret', 'privatekey', 'api_key', 'email', 'phone', 'authorization'];

  for (const key of Object.keys(result)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]';
    } else if (typeof result[key] === 'object') {
      result[key] = redactPII(result[key]);
    } else if (typeof result[key] === 'string') {
      result[key] = redactSecrets(result[key]);
    }
  }
  return result;
};

const getRequestId = (req?: any): string | undefined => {
  if (!req) return undefined;
  return req.requestId || (req as any).headers?.['x-request-id'];
};

export const logger = {
  info: (msg: any, ...meta: any[]) => {
    const reqId = getRequestId();
    const prefix = reqId ? `[${reqId}]` : '';
    console.log(`${prefix} [INFO]`, redactPII(msg), ...meta.map(redactPII));
  },
  error: (msg: any, ...meta: any[]) => {
    const reqId = getRequestId();
    const prefix = reqId ? `[${reqId}]` : '';
    console.error(`${prefix} [ERROR]`, redactPII(msg), ...meta.map(redactPII));
  },
  warn: (msg: any, ...meta: any[]) => {
    const reqId = getRequestId();
    const prefix = reqId ? `[${reqId}]` : '';
    console.warn(`${prefix} [WARN]`, redactPII(msg), ...meta.map(redactPII));
  },
  debug: (msg: any, ...meta: any[]) => {
    const reqId = getRequestId();
    const prefix = reqId ? `[${reqId}]` : '';
    console.debug(`${prefix} [DEBUG]`, redactPII(msg), ...meta.map(redactPII));
  },
  add: () => {}
};

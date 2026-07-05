const redactPII = (data: any): any => {
  if (typeof data !== 'object' || data === null) return data;
  if (Array.isArray(data)) return data.map(redactPII);

  const result = { ...data };
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'apiKey', 'email', 'phone'];

  for (const key of Object.keys(result)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]';
    } else if (typeof result[key] === 'object') {
      result[key] = redactPII(result[key]);
    }
  }
  return result;
};

export const logger = {
  info: (msg: any, ...meta: any[]) => console.log(`[INFO]`, redactPII(msg), ...meta.map(redactPII)),
  error: (msg: any, ...meta: any[]) => console.error(`[ERROR]`, redactPII(msg), ...meta.map(redactPII)),
  warn: (msg: any, ...meta: any[]) => console.warn(`[WARN]`, redactPII(msg), ...meta.map(redactPII)),
  debug: (msg: any, ...meta: any[]) => console.debug(`[DEBUG]`, redactPII(msg), ...meta.map(redactPII)),
  add: () => {}
};

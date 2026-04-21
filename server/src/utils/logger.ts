export const logger = {
  info: (msg: any, ...meta: any[]) => console.log(`[INFO]`, msg, ...meta),
  error: (msg: any, ...meta: any[]) => console.error(`[ERROR]`, msg, ...meta),
  warn: (msg: any, ...meta: any[]) => console.warn(`[WARN]`, msg, ...meta),
  debug: (msg: any, ...meta: any[]) => console.debug(`[DEBUG]`, msg, ...meta),
  add: () => {}
};

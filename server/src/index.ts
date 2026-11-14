/**
 * Pabandi Entrypoint (Compatibility Forwarder)
 * Boots HTTP server via ./server and exposes app/server exports.
 */
import httpServer from './server';
export { app } from './app';
export { httpServer };
export default httpServer;

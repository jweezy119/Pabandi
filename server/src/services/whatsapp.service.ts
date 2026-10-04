// openwaBaseUrl is re-exported so routes can name the configured gateway in a
// "cannot reach OpenWA" response without importing the implementation module directly.
export { openwaService, openwaBaseUrl } from './openwa.service';
export { evolutionAPI } from './evolution.service';
export { WhatsAppService, whatsAppService } from './pabandiWhatsApp.service';
export type { WhatsAppProvider } from './whatsapp.provider';

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openwaAfterHoursService = exports.OpenWAAfterHoursService = void 0;
const openwa_plugins_service_1 = require("./openwa.plugins.service");
const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_COOLDOWN_SEC = 3600;
const DEFAULT_AWAY_MESSAGE = `We're closed right now. We'll reply when we reopen.`;
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
class OpenWAAfterHoursService {
    constructor() {
        this.cachedBusiness = null;
    }
    getPluginConfig() {
        const catalog = (0, openwa_plugins_service_1.getPluginCatalog)();
        const matched = (0, openwa_plugins_service_1.findPluginsByKeywords)(['after-hours'], catalog);
        const plugin = matched[0];
        if (!plugin)
            return null;
        const config = {
            schedule: {},
            timezone: DEFAULT_TIMEZONE,
            awayMessage: plugin.name || DEFAULT_AWAY_MESSAGE,
            cooldownSec: Number.isFinite(Number(plugin.version?.split('.')[0])) ? Number(plugin.version?.split('.')[0]) || DEFAULT_COOLDOWN_SEC : DEFAULT_COOLDOWN_SEC,
            respondInGroups: false,
        };
        return config;
    }
    getBusinessConfig(business) {
        const normalized = {
            id: business.id || '',
            timezone: business.timezone || DEFAULT_TIMEZONE,
            settings: business.settings || null,
        };
        if (this.cachedBusiness && this.cachedBusiness.id === normalized.id) {
            return this.cachedBusiness.config;
        }
        const pluginConfig = this.getPluginConfig();
        const businessConfig = this.parseBusinessOverrides(normalized);
        const merged = {
            schedule: businessConfig.schedule || pluginConfig?.schedule || {},
            timezone: businessConfig.timezone || pluginConfig?.timezone || DEFAULT_TIMEZONE,
            awayMessage: businessConfig.awayMessage || pluginConfig?.awayMessage || DEFAULT_AWAY_MESSAGE,
            cooldownSec: businessConfig.cooldownSec || pluginConfig?.cooldownSec || DEFAULT_COOLDOWN_SEC,
            respondInGroups: pluginConfig?.respondInGroups ?? false,
        };
        this.cachedBusiness = { id: normalized.id, config: merged };
        return merged;
    }
    isAfterHoursNow(business) {
        const config = this.getBusinessConfig(business);
        const now = new Date();
        const day = DAY_ORDER[now.getDay() === 0 ? 6 : now.getDay() - 1];
        const dayConfig = config.schedule[day];
        if (!dayConfig || dayConfig.closed)
            return true;
        const minutesNow = this.toMinutes(now);
        if (dayConfig.open == null && dayConfig.close == null)
            return false;
        if (dayConfig.open == null || dayConfig.close == null)
            return false;
        const open = this.toMinutesFromHHMM(dayConfig.open);
        const close = this.toMinutesFromHHMM(dayConfig.close);
        if (open == null || close == null)
            return false;
        if (close <= open) {
            return minutesNow < open && minutesNow > close;
        }
        return minutesNow < open || minutesNow >= close;
    }
    getAwayMessage(business) {
        const config = this.getBusinessConfig(business);
        return config.awayMessage || DEFAULT_AWAY_MESSAGE;
    }
    parseBusinessOverrides(business) {
        const overrides = {
            schedule: {},
            timezone: business.timezone || DEFAULT_TIMEZONE,
            awayMessage: '',
            cooldownSec: DEFAULT_COOLDOWN_SEC,
            respondInGroups: false,
        };
        try {
            const raw = (business.settings && business.settings.afterHoursJson) || null;
            if (!raw)
                return overrides;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (parsed.schedule && typeof parsed.schedule === 'object') {
                    overrides.schedule = parsed.schedule;
                }
                if (parsed.timezone && typeof parsed.timezone === 'string') {
                    overrides.timezone = parsed.timezone;
                }
                if (parsed.awayMessage && typeof parsed.awayMessage === 'string') {
                    overrides.awayMessage = parsed.awayMessage;
                }
                if (Number.isFinite(parsed.cooldownSec)) {
                    overrides.cooldownSec = Math.max(0, Number(parsed.cooldownSec));
                }
                if (parsed.respondInGroups === true) {
                    overrides.respondInGroups = true;
                }
            }
        }
        catch {
            // ignore malformed business after-hours overrides
        }
        return overrides;
    }
    toMinutes(date) {
        return date.getHours() * 60 + date.getMinutes();
    }
    toMinutesFromHHMM(value) {
        if (!value || typeof value !== 'string')
            return null;
        const match = value.match(/^(\d{1,2}):(\d{2})$/);
        if (!match)
            return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes))
            return null;
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59)
            return null;
        return hours * 60 + minutes;
    }
}
exports.OpenWAAfterHoursService = OpenWAAfterHoursService;
exports.openwaAfterHoursService = new OpenWAAfterHoursService();
//# sourceMappingURL=openwa.after-hours.service.js.map
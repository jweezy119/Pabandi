export interface AfterHoursScheduleEntry {
    open?: string;
    close?: string;
    closed?: boolean;
}
export type AfterHoursSchedule = Record<string, AfterHoursScheduleEntry>;
export interface AfterHoursConfig {
    schedule: AfterHoursSchedule;
    timezone: string;
    awayMessage: string;
    cooldownSec: number;
    respondInGroups: boolean;
}
export interface BusinessLike {
    id?: string;
    timezone?: string | null;
    settings?: any | null;
}
export declare class OpenWAAfterHoursService {
    private cachedBusiness;
    getPluginConfig(): AfterHoursConfig | null;
    getBusinessConfig(business: BusinessLike): AfterHoursConfig;
    isAfterHoursNow(business: BusinessLike): boolean;
    getAwayMessage(business: BusinessLike): string;
    private parseBusinessOverrides;
    private toMinutes;
    private toMinutesFromHHMM;
}
export declare const openwaAfterHoursService: OpenWAAfterHoursService;
//# sourceMappingURL=openwa.after-hours.service.d.ts.map
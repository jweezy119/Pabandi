export interface OutreachCatalogPlugin {
    id: string;
    name: string;
    version?: string;
    status?: string;
    description?: string;
    keywords?: string[];
    homepage?: string;
    repoPath?: string;
}
export interface OutreachCatalog {
    plugins: OutreachCatalogPlugin[];
}
export interface OutreachContext {
    baseMessage: string;
    businessName: string;
    reservationDate?: string;
    reservationTime?: string;
    guests?: number;
    claimUrl?: string;
}
export declare const loadPluginCatalog: () => OutreachCatalog;
export declare const clearPluginCatalogCache: () => void;
export declare const getPluginCatalog: () => OutreachCatalog;
export declare const scorePlugin: (plugin: OutreachCatalogPlugin, keywords: string[], context?: Record<string, string>) => {
    id: string;
    name: string;
    version: string | undefined;
    description: string;
    homepage: string;
    score: number;
};
export declare const selectPlugins: (keywords: string[], context?: Record<string, string>, limit?: number) => {
    id: string;
    name: string;
    version: string | undefined;
    description: string;
    homepage: string;
    score: number;
}[];
export declare const findPluginsByKeywords: (keywords: string[], catalog?: OutreachCatalog) => OutreachCatalogPlugin[];
export declare const buildPluginSummary: (plugins: ReturnType<typeof selectPlugins>[number][]) => string;
export declare const buildPluginFooters: (plugins: OutreachCatalogPlugin[]) => string;
export declare const buildOutreachMessageFromCatalog: (context: OutreachContext) => string;
//# sourceMappingURL=openwa.plugins.service.d.ts.map
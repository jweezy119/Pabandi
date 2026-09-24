export interface PluginConfigRecord {
    pluginId: string;
    enabled: boolean;
    config: Record<string, unknown>;
    updatedAt: string;
}
export declare const listAdminPlugins: () => {
    id: string;
    name: string;
    version: string | undefined;
    status: string | undefined;
    description: string | undefined;
    keywords: string[] | undefined;
    homepage: string | undefined;
    repoPath: string | undefined;
    enabled: boolean;
    updatedAt: string;
}[];
export declare const getAdminPlugin: (pluginId: string) => {
    id: string;
    name: string;
    version: string | undefined;
    status: string | undefined;
    description: string | undefined;
    keywords: string[] | undefined;
    homepage: string | undefined;
    repoPath: string | undefined;
    config: Record<string, unknown>;
    enabled: boolean;
    updatedAt: string;
} | null;
export declare const updateAdminPlugin: (pluginId: string, payload?: {
    enabled?: boolean;
    config?: Record<string, unknown>;
}) => {
    record: PluginConfigRecord;
    changed: boolean;
    effect: string;
};
export declare const getEffectivePluginConfigs: () => Record<string, {
    enabled: boolean;
    config: Record<string, unknown>;
}>;
//# sourceMappingURL=openwa_admin.service.d.ts.map
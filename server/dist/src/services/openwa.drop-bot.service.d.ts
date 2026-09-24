export declare const openwaDropBotService: {
    isDropEngineCommand(message: string): boolean;
    handleDropEngineCommand(businessId: string, customerPhone: string, message: string): Promise<string>;
    handleDropCommand(businessId: string, message: string): Promise<string>;
    handleBuyCommand(businessId: string, customerPhone: string, message: string): Promise<string>;
    handleCatalogCommand(businessId: string): Promise<string>;
};
//# sourceMappingURL=openwa.drop-bot.service.d.ts.map
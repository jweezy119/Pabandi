type BotCommand = {
    command: string;
    description: string;
};
interface SendMessageOptions {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    reply_markup?: any;
}
export declare class TelegramService {
    private bots;
    private businessIdByToken;
    initialize(botToken: string, businessId: string): Promise<{
        success: boolean;
        username?: string;
        error?: string;
    }>;
    sendMessage(businessId: string, chatId: string, message: string, options?: SendMessageOptions): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    sendInlineKeyboard(businessId: string, chatId: string, message: string, buttons: {
        text: string;
        callback_data: string;
    }[][]): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    sendPhoto(businessId: string, chatId: string, photo: string | Buffer, caption?: string): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    setCommands(businessId: string, commands: BotCommand[]): Promise<boolean>;
    processCommand(businessId: string, chatId: string, command: string, args: string[]): Promise<void>;
    handleUpdate(businessId: string, update: any): Promise<void>;
    stopBot(businessId: string): Promise<void>;
    getBotInfo(businessId: string): Promise<{
        isActive: boolean;
        username?: string;
    }>;
    isBotActive(businessId: string): boolean;
    private handleCommand;
    private showMenu;
    private handleIncomingMessage;
    private handleCallbackQuery;
    private logMessage;
}
export declare const telegramService: TelegramService;
export {};
//# sourceMappingURL=telegram.service.d.ts.map
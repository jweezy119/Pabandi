export type CampaignSendResult = {
    campaignId: string;
    sent: number;
    failed: number;
    errors: string[];
};
export declare const campaignService: {
    /**
     * Send a campaign to all its recipients.
     * Supports EMAIL and SMS (SMS requires provider config).
     */
    sendCampaign(campaignId: string): Promise<CampaignSendResult>;
    /**
     * Send a single SMS. Currently a stub; integrate Twilio/Vonage/etc.
     */
    sendSMS({ to, body }: {
        to: string;
        body: string;
    }): Promise<boolean>;
};
//# sourceMappingURL=campaign.service.d.ts.map
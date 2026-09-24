"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const notification_service_1 = require("./notification.service");
exports.campaignService = {
    /**
     * Send a campaign to all its recipients.
     * Supports EMAIL and SMS (SMS requires provider config).
     */
    async sendCampaign(campaignId) {
        const result = { campaignId, sent: 0, failed: 0, errors: [] };
        try {
            const campaign = await database_1.prisma.campaign.findUnique({
                where: { id: campaignId },
                include: { recipients: true },
            });
            if (!campaign) {
                result.errors.push('Campaign not found');
                return result;
            }
            if (campaign.status === 'SENDING') {
                result.errors.push('Campaign already in progress');
                return result;
            }
            await database_1.prisma.campaign.update({
                where: { id: campaignId },
                data: { status: 'SENDING', startedAt: new Date() },
            });
            for (const recipient of campaign.recipients) {
                try {
                    if (campaign.type === 'EMAIL' || campaign.type === 'MIXED') {
                        const sent = await notification_service_1.notificationService.sendEmail({
                            to: recipient.email || '',
                            subject: campaign.subject || campaign.name,
                            html: campaign.body || '',
                        });
                        if (sent) {
                            await database_1.prisma.campaignRecipient.update({
                                where: { id: recipient.id },
                                data: { status: 'SENT', sentAt: new Date() },
                            });
                            result.sent++;
                        }
                        else {
                            await database_1.prisma.campaignRecipient.update({
                                where: { id: recipient.id },
                                data: { status: 'FAILED', error: 'Email send failed' },
                            });
                            result.failed++;
                            result.errors.push(`Recipient ${recipient.id}: email send failed`);
                        }
                    }
                    if (campaign.type === 'SMS' || campaign.type === 'MIXED') {
                        const smsSent = await exports.campaignService.sendSMS({
                            to: recipient.phone || '',
                            body: campaign.body || '',
                        });
                        if (smsSent) {
                            await database_1.prisma.campaignRecipient.update({
                                where: { id: recipient.id },
                                data: { status: 'SENT', sentAt: new Date() },
                            });
                            result.sent++;
                        }
                        else {
                            await database_1.prisma.campaignRecipient.update({
                                where: { id: recipient.id },
                                data: { status: 'FAILED', error: 'SMS send failed' },
                            });
                            result.failed++;
                            result.errors.push(`Recipient ${recipient.id}: SMS send failed`);
                        }
                    }
                }
                catch (e) {
                    result.failed++;
                    result.errors.push(`Recipient ${recipient.id}: ${e.message}`);
                }
            }
            await database_1.prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    status: result.failed === 0 ? 'COMPLETED' : 'FAILED',
                    completedAt: new Date(),
                    sentCount: result.sent,
                },
            });
        }
        catch (e) {
            logger_1.logger.error('[campaign] send failed', e);
            result.errors.push(`Global: ${e.message}`);
            await database_1.prisma.campaign.update({
                where: { id: campaignId },
                data: { status: 'FAILED', completedAt: new Date() },
            }).catch(() => { });
        }
        return result;
    },
    /**
     * Send a single SMS. Currently a stub; integrate Twilio/Vonage/etc.
     */
    async sendSMS({ to, body }) {
        const provider = process.env.SMS_PROVIDER; // TWILIO | VONAGE | CUSTOM
        if (!provider) {
            logger_1.logger.warn('[sms] no provider configured');
            return false;
        }
        if (provider === 'TWILIO') {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const from = process.env.TWILIO_FROM_NUMBER;
            if (!accountSid || !authToken || !from) {
                logger_1.logger.warn('[sms] Twilio not configured');
                return false;
            }
            try {
                const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                    method: 'POST',
                    headers: { Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64') },
                    body: new URLSearchParams({ To: to, From: from, Body: body }),
                });
                if (!res.ok) {
                    const text = await res.text();
                    logger_1.logger.error('[sms] Twilio failed', res.status, text);
                    return false;
                }
                return true;
            }
            catch (e) {
                logger_1.logger.error('[sms] Twilio error', e);
                return false;
            }
        }
        logger_1.logger.warn('[sms] provider not implemented', provider);
        return false;
    },
};
//# sourceMappingURL=campaign.service.js.map
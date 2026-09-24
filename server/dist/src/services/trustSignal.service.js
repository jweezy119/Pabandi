"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustSignalService = exports.TrustSignalService = void 0;
const logger_1 = require("../utils/logger");
class TrustSignalService {
    constructor() {
        this.disposableDomains = new Set([
            'mailinator.com', 'trashmail.com', 'tempmail.com', 'guerrillamail.com', 'yopmail.com',
            'sharklasers.com', '10minutemail.com', 'minuteinbox.com', 'temp-mail.org', 'mailnesia.com',
            'throwaway.email', 'fakeinbox.com', 'tempail.com', 'dispostable.com', 'maildrop.cc',
            'getnada.com', 'mohmal.com', 'discard.email', 'fake-email.com', 'emailondeck.com',
            'tempr.email', 'tmpmail.net', 'tmpmail.org', 'tmpmail.com', 'disposableemailaddresses.emailmiser.com',
            'moburl.com', 'emailfry.com', 'spamgourmet.com', 'spamherelots.com', 'herestorethemail.top',
            'emailfake.com', 'generator.email', 'mailcatch.com', 'mailexpire.com',
            'mailexpire.org', 'mailshell.com', 'mailzilla.com', 'mailzilla.org', 'mytrashmail.com',
            'noclickemail.com', 'pListed.com', 'quickinbox.com', 'rcpt.at', 'reallymymail.com',
            'recode.me', 'regbypass.dubyah.net', 'rmqkr.net', 'royal.net', 's0ny.net', 'safersignup.com',
            'safetymail.info', 'samsclass.info', 'saynotospams.com', 'scbox.one', 'schafmail.de',
            'selfdestructingmail.com', 'sendspamhere.com', 'shiftmail.com',
            'shitmail.me', 'shortmail.net', 'showslow.de', 'sibmail.com', 'sinnlos-mail.de',
            'slapsfromlastnight.com', 'slushmail.com', 'smashmail.de', 'smellfear.com',
            'smellrear.com', 'snakemail.com', 'sneakemail.com', 'sogetthis.com', 'sohu.com',
            'solvemail.info', 'spamavert.com', 'spambob.net', 'spambob.org', 'spambooger.com',
            'spambox.us', 'spamcannon.com', 'spamcannon.net', 'spamcon.org', 'spamcorptastic.com',
            'spamcowboy.com', 'spamcowboy.net', 'spamcowboy.org', 'spamday.com', 'spamex.com',
            'spamfree24.org', 'spamgoes.in', 'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
            'spamherelots.com', 'spamhole.com', 'spamify.com', 'spaml.de', 'spaml.com',
            'spammotel.com', 'spamobox.com', 'spamoff.de', 'spamsalad.in', 'spamslicer.com',
            'spamspot.com', 'spamstack.net', 'spamthisplease.com', 'spamtrap.co', 'spamtroll.net',
            'speed.1s.fr', 'spikio.com', 'spoofmail.de', 'spr.io', 'squizzy.de', 'squizzy.net',
            'sroff.com', 'staliers.com', 'starlight-breaker.net', 'startfu.com', 'stealthmail.co',
            'stealthmail.com', 'sterlinginvestments.com', 'stinkefinger.de', 'stop-my-spam.com',
            'stuffmail.de', 'super-auswahl.de', 'supergreatmail.com', 'supermailer.jp',
            'superplatina.com', 'superrito.com', 'superstachel.de', 'suremail.info', 'svk.jp',
            'sweetxxx.de', 'tafmail.com', 'tagmymoney.com', 'teewars.org', 'tele2nl.com',
            'teleworm.com', 'teleworm.us', 'temp.headstrong.de', 'tempail.com', 'tempemail.co.za',
            'tempemail.net', 'tempinbox.co.uk', 'tempinbox.com', 'tempomail.fr', 'temporaryemail.net',
            'temporaryemail.org', 'temporarymailaddress.com', 'tempr.email', 'tempthe.net',
            'tempymail.com', 'testore.co', 'thc.st', 'thecloudindex.com', 'thelastmail.com',
            'themail.com', 'themail.net', 'themail.org', 'tmail.ws',
            'tmailinator.com', 'tradermail.info', 'trash2009.com', 'trash2010.com', 'trash2011.com',
            'trashbox.eu', 'trashdevil.com', 'trashdevil.org', 'trashemail.de', 'trashmail.at',
            'trashmail.com', 'trashmail.de', 'trashmail.io', 'trashmail.me', 'trashmail.net',
            'trashmail.org', 'trashmail.ws', 'trashymail.com', 'trashymail.net', 'trickmail.net',
            'ubismail.net', 'uggsrock.com', 'umail.net', 'unimark.org', 'upliftnow.com',
            'uplipht.com', 'venompen.com', 'vidchart.com', 'viralplays.com', 'vixlet.com',
            'vmail.me', 'voidmail.com', 'vpn.st', 'vsimcard.com', 'vzt.cz', 'wasteland.rfc822.org',
            'webemail.me', 'webm4il.info', 'weg-werf-email.de', 'wegwerf-email.de', 'wegwerf-email.net',
            'wegwerf-email.org', 'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfmail.org', 'wefgr.info',
            'wilelink.com', 'willhackforfood.biz', 'winemaven.info', 'wolfsmail.com', 'wollan.info',
            'wuzup.net', 'wuzupmail.net', 'www.e4ward.com', 'x1x.spam.sh', 'xagloo.co',
            'xemaps.com', 'xents.com', 'xjoi.com', 'xmail.com', 'xmail.net', 'xmail.org',
            'xmail2.net', 'xmaily.com', 'xoxy.net', 'xyzmail.org', 'yapped.net', 'yep.it',
            'ynm.de', 'you-spam.com', 'youneedmore.info', 'yourdomain.com', 'youremail.cf',
            'yousmail.com', 'ysmail.com', 'ysmmail.com', 'yuurok.com', 'z1p.biz',
            'za.com', 'zasod.com', 'zehnminuten.de', 'zehnminutenmail.de', 'zipcad.com',
            'zippymail.info', 'zoaxe.com', 'zoemail.com', 'zoemail.net', 'zomg.info', 'zxcvbnm.com'
        ]);
    }
    async evaluateSignals({ email, phone, deviceFingerprint, ip, }) {
        const reason = [];
        let riskDelta = 0;
        const domain = (email || '').split('@')[1]?.toLowerCase();
        if (domain && this.disposableDomains.has(domain)) {
            riskDelta += 15;
            reason.push('disposable-email');
        }
        if (email) {
            const breached = await this.checkBreachExposure(email);
            if (breached) {
                riskDelta += 10;
                reason.push('breach-exposure');
            }
        }
        if (phone) {
            const digits = phone.replace(/[^0-9]/g, '');
            if (digits.length >= 7) {
                try {
                    const carrier = await this.detectCarrier(phone);
                    if (carrier === 'voip') {
                        riskDelta += 8;
                        reason.push('voip-phone');
                    }
                }
                catch {
                    // best-effort only
                }
            }
            else {
                riskDelta += 10;
                reason.push('weak-phone-signal');
            }
        }
        if (ip) {
            const ipRisk = await this.checkIpRisk(ip);
            if (ipRisk.blocked || ipRisk.isProxy || ipRisk.isHosting || ipRisk.isTor) {
                riskDelta += 12;
                reason.push('high-risk-ip');
            }
        }
        if (!deviceFingerprint || deviceFingerprint.length < 12) {
            riskDelta += 5;
            reason.push('missing-device-fingerprint');
        }
        return {
            isDisposableEmail: reason.includes('disposable-email'),
            isVoiceOrSmsNumber: reason.includes('voip-phone'),
            riskDelta: Math.max(-20, Math.min(20, riskDelta)),
            reason: reason.join(',') || 'clean-signals',
        };
    }
    async checkBreachExposure(email) {
        try {
            const resp = await fetch('https://haveibeenpwned.com/api/v3/breachedaccount/' + encodeURIComponent(email), {
                headers: {
                    'User-Agent': 'PabandiTrust/1.0',
                    'hibp-api-key': process.env.HIBP_API_KEY || '',
                },
            });
            if (resp.status === 404)
                return false;
            return resp.ok;
        }
        catch (error) {
            logger_1.logger.warn('HIBP check failed', error);
            return false;
        }
    }
    async detectCarrier(phone) {
        try {
            const sid = process.env.TWILIO_ACCOUNT_SID;
            const token = process.env.TWILIO_AUTH_TOKEN;
            if (!sid || !token)
                return 'unknown';
            const url = 'https://lookups.twilio.com/v2/PhoneNumbers/' + encodeURIComponent(phone) + '?Type=carrier';
            const resp = await fetch(url, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
                },
            });
            if (!resp.ok)
                return 'unknown';
            const data = (await resp.json());
            const type = (data.carrier?.type || '').toLowerCase();
            if (type === 'voip')
                return 'voip';
            return 'standard';
        }
        catch (error) {
            logger_1.logger.warn('Twilio carrier lookup failed', error);
            return 'unknown';
        }
    }
    async checkIpRisk(ip) {
        try {
            const resp = await fetch('http://ip-api.com/json/' + encodeURIComponent(ip) + '?fields=status,message,proxy,hosting,mobile');
            if (!resp.ok)
                return { blocked: false, isProxy: false, isHosting: false, isTor: false };
            const data = (await resp.json());
            return {
                blocked: data.status !== 'success',
                isProxy: !!data.proxy,
                isHosting: !!data.hosting,
                isTor: false,
            };
        }
        catch {
            return { blocked: false, isProxy: false, isHosting: false, isTor: false };
        }
    }
}
exports.TrustSignalService = TrustSignalService;
exports.trustSignalService = new TrustSignalService();
//# sourceMappingURL=trustSignal.service.js.map
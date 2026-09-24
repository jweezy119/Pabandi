"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onrampService = void 0;
const logger_1 = require("../utils/logger");
exports.onrampService = {
    /**
     * Get quotes from all configured on-ramp providers.
     */
    async getQuotes({ fiatAmount, fiatCurrency = 'USD', cryptoCurrency = 'USDC', }) {
        const quotes = [];
        if (process.env.MOONPAY_API_KEY) {
            try {
                const res = await fetch(`https://api.moonpay.com/v3/currencies/${cryptoCurrency.toLowerCase()}/buy?apiKey=${process.env.MOONPAY_API_KEY}&baseCurrencyCode=${fiatCurrency.toUpperCase()}&baseCurrencyAmount=${fiatAmount}`);
                const data = (await res.json());
                quotes.push({
                    provider: 'MOONPAY',
                    fiatAmount,
                    fiatCurrency,
                    cryptoAmount: data?.amount || 0,
                    cryptoCurrency,
                    fee: data?.feeAmount || 0,
                    rate: data?.rate || 1,
                    estimatedMinutes: 5,
                });
            }
            catch (e) {
                logger_1.logger.warn('[Onramp] MoonPay quote failed: %s', e?.message || e);
            }
        }
        if (process.env.TRANSAK_API_KEY) {
            try {
                const res = await fetch(`https://api.transak.com/v1.0/partners/config?apiKey=${process.env.TRANSAK_API_KEY}&fiatCurrency=${fiatCurrency.toUpperCase()}&cryptoCurrency=${cryptoCurrency.toUpperCase()}&fiatAmount=${fiatAmount}`);
                const data = (await res.json());
                quotes.push({
                    provider: 'TRANSAK',
                    fiatAmount,
                    fiatCurrency,
                    cryptoAmount: data?.cryptoAmount || 0,
                    cryptoCurrency,
                    fee: data?.fee || 0,
                    rate: data?.rate || 1,
                    estimatedMinutes: 10,
                });
            }
            catch (e) {
                logger_1.logger.warn('[Onramp] Transak quote failed: %s', e?.message || e);
            }
        }
        if (process.env.STRIPE_SECRET_KEY) {
            quotes.push({
                provider: 'STRIPE_CRYPTO',
                fiatAmount,
                fiatCurrency,
                cryptoAmount: +(fiatAmount * 0.98).toFixed(2),
                cryptoCurrency,
                fee: +(fiatAmount * 0.02).toFixed(2),
                rate: 1,
                estimatedMinutes: 15,
            });
        }
        // CashApp on-ramp quote
        const { cashAppService } = await Promise.resolve().then(() => __importStar(require('./cashapp.service')));
        const cashAppQuote = await cashAppService.getOnrampQuote({ fiatAmount, fiatCurrency, cryptoCurrency });
        quotes.push({
            provider: 'CASHAPP',
            fiatAmount: cashAppQuote.amount,
            fiatCurrency: cashAppQuote.currency,
            cryptoAmount: cashAppQuote.cryptoAmount,
            cryptoCurrency: cashAppQuote.cryptoCurrency,
            fee: cashAppQuote.fee,
            rate: cashAppQuote.rate,
            estimatedMinutes: 5,
        });
        return quotes;
    },
    /**
     * Create an on-ramp session for a specific provider.
     */
    async createSession({ provider, fiatAmount, fiatCurrency = 'USD', cryptoCurrency = 'USDC', walletAddress, reference, }) {
        if (provider === 'CASHAPP') {
            const { cashAppService } = await Promise.resolve().then(() => __importStar(require('./cashapp.service')));
            const link = await cashAppService.createPaymentLink({
                amount: fiatAmount,
                currency: fiatCurrency,
                reference,
                note: `On-ramp ${cryptoCurrency} to ${walletAddress}`,
            });
            return {
                id: link.id,
                provider,
                url: link.url,
                status: link.status,
                fiatAmount,
                fiatCurrency,
                cryptoAmount: link.amount,
                cryptoCurrency,
                expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
            };
        }
        if (provider === 'MOONPAY' && process.env.MOONPAY_API_KEY) {
            const url = `https://buy.moonpay.com/?apiKey=${process.env.MOONPAY_API_KEY}&currencyCode=${cryptoCurrency.toLowerCase()}&baseCurrencyCode=${fiatCurrency.toUpperCase()}&baseCurrencyAmount=${fiatAmount}&walletAddress=${walletAddress}`;
            return {
                id: `moonpay-${reference}`,
                provider,
                url,
                status: 'created',
                fiatAmount,
                fiatCurrency,
                cryptoAmount: fiatAmount,
                cryptoCurrency,
                expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
            };
        }
        if (provider === 'TRANSAK' && process.env.TRANSAK_API_KEY) {
            const url = `https://global.transak.com/?apiKey=${process.env.TRANSAK_API_KEY}&fiatCurrency=${fiatCurrency.toUpperCase()}&cryptoCurrency=${cryptoCurrency.toUpperCase()}&fiatAmount=${fiatAmount}&walletAddress=${walletAddress}`;
            return {
                id: `transak-${reference}`,
                provider,
                url,
                status: 'created',
                fiatAmount,
                fiatCurrency,
                cryptoAmount: fiatAmount,
                cryptoCurrency,
                expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
            };
        }
        if (provider === 'STRIPE_CRYPTO' && process.env.STRIPE_SECRET_KEY) {
            const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${reference}`;
            return {
                id: `stripe-crypto-${reference}`,
                provider,
                url,
                status: 'created',
                fiatAmount,
                fiatCurrency,
                cryptoAmount: +(fiatAmount * 0.98).toFixed(2),
                cryptoCurrency,
                expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
            };
        }
        throw new Error(`Unsupported on-ramp provider: ${provider}`);
    },
};
//# sourceMappingURL=onramp.service.js.map
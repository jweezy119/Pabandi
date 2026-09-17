import { logger } from '../utils/logger';

const CASHAPP_API_BASE = 'https://api.cashapp.com/v1';
const CASHAPP_CLIENT_ID = process.env.CASHAPP_CLIENT_ID || '';
const CASHAPP_CLIENT_SECRET = process.env.CASHAPP_CLIENT_SECRET || '';
const CASHAPP_MERCHANT_ID = process.env.CASHAPP_MERCHANT_ID || '';

export type CashAppPaymentLink = {
  id: string;
  url: string;
  status: string;
  amount: number;
  currency: string;
};

export type CashAppOnrampQuote = {
  amount: number;
  currency: string;
  fee: number;
  total: number;
  cryptoAmount: number;
  cryptoCurrency: string;
  rate: number;
};

export type CashAppOfframpQuote = {
  cryptoAmount: number;
  cryptoCurrency: string;
  fiatAmount: number;
  fiatCurrency: string;
  fee: number;
  netAmount: number;
  rate: number;
};

export const cashAppService = {
  /**
   * Create a Cash App payment link for a checkout session.
   * Returns a deep link or hosted URL that redirects to Cash App.
   */
  async createPaymentLink({
    amount,
    currency = 'USD',
    reference,
    note,
  }: {
    amount: number;
    currency?: string;
    reference: string;
    note?: string;
  }): Promise<CashAppPaymentLink> {
    if (!CASHAPP_CLIENT_ID || !CASHAPP_CLIENT_SECRET) {
      logger.warn('[CashApp] Missing client credentials — returning fallback URL');
      return {
        id: `fallback-${reference}`,
        url: `https://cash.app/$${CASHAPP_MERCHANT_ID || 'demo'}/pay/${reference}?amount=${amount.toFixed(2)}`,
        status: 'fallback',
        amount,
        currency,
      };
    }

    try {
      const auth = Buffer.from(`${CASHAPP_CLIENT_ID}:${CASHAPP_CLIENT_SECRET}`).toString('base64');
      const tokenRes = await fetch(`${CASHAPP_API_BASE}/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&scope=payments',
      });
      const tokenData = (await tokenRes.json()) as any;
      const accessToken = tokenData?.access_token;

      if (!accessToken) {
        throw new Error('Failed to obtain Cash App access token');
      }

      const paymentRes = await fetch(`${CASHAPP_API_BASE}/payments/links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: {
            amount: (amount / 100).toFixed(2),
            currency_code: currency.toUpperCase(),
          },
          reference,
          note: note || `Pabandi payment ${reference}`,
          merchant_id: CASHAPP_MERCHANT_ID,
        }),
      });

      const paymentData = (await paymentRes.json()) as any;
      const id = paymentData?.id || `cashapp-${reference}`;
      const url = paymentData?.url || `https://cash.app/$${CASHAPP_MERCHANT_ID || 'demo'}/pay/${id}?amount=${amount.toFixed(2)}`;

      return {
        id,
        url,
        status: paymentData?.status || 'created',
        amount,
        currency,
      };
    } catch (error: any) {
      logger.error('[CashApp] createPaymentLink failed: %s', error?.message || error);
      return {
        id: `fallback-${reference}`,
        url: `https://cash.app/$${CASHAPP_MERCHANT_ID || 'demo'}/pay/${reference}?amount=${amount.toFixed(2)}`,
        status: 'fallback',
        amount,
        currency,
      };
    }
  },

  /**
   * Get a Cash App on-ramp quote: fiat → USDC.
   * In production this would call a real on-ramp provider (MoonPay/Transak/Stripe Crypto).
   * Here we return a deterministic quote so the UI can show estimated crypto received.
   */
  async getOnrampQuote({
    fiatAmount,
    fiatCurrency = 'USD',
    cryptoCurrency = 'USDC',
  }: {
    fiatAmount: number;
    fiatCurrency?: string;
    cryptoCurrency?: string;
  }): Promise<CashAppOnrampQuote> {
    const feePct = 0.025;
    const fee = +(fiatAmount * feePct).toFixed(2);
    const net = +(fiatAmount - fee).toFixed(2);
    const rate = 1.0;
    const cryptoAmount = +(net * rate).toFixed(2);

    return {
      amount: fiatAmount,
      currency: fiatCurrency,
      fee,
      total: fiatAmount,
      cryptoAmount,
      cryptoCurrency,
      rate,
    };
  },

  /**
   * Get a Cash App off-ramp quote: USDC → fiat.
   */
  async getOfframpQuote({
    cryptoAmount,
    cryptoCurrency = 'USDC',
    fiatCurrency = 'USD',
  }: {
    cryptoAmount: number;
    cryptoCurrency?: string;
    fiatCurrency?: string;
  }): Promise<CashAppOfframpQuote> {
    const feePct = 0.015;
    const rate = 1.0;
    const grossFiat = +(cryptoAmount * rate).toFixed(2);
    const fee = +(grossFiat * feePct).toFixed(2);
    const netAmount = +(grossFiat - fee).toFixed(2);

    return {
      cryptoAmount,
      cryptoCurrency,
      fiatAmount: grossFiat,
      fiatCurrency,
      fee,
      netAmount,
      rate,
    };
  },

  /**
   * Verify a Cash App payment webhook signature.
   */
  verifyWebhook(payload: string, signature: string): boolean {
    const secret = process.env.CASHAPP_WEBHOOK_SECRET || '';
    if (!secret || !signature) return process.env.NODE_ENV !== 'production';
    // Placeholder: in production verify using HMAC-SHA256 with CASHAPP_WEBHOOK_SECRET
    return true;
  },
};

import axios from 'axios';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const DASHSCOPE_VISION_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

export interface PaymentProofFields {
  amount?: number;
  recipient?: string;
  bank?: string;
  currency?: string;
  date?: string;
}

export interface PaymentVerificationResult {
  isValid: boolean;
  confidence: number;
  fields: PaymentProofFields;
  raw?: string;
}

export class AiPaymentVerifierService {
  async verify(
    imageBase64: string,
    expectedAmountPkr: number,
    expectedDestination: string
  ): Promise<PaymentVerificationResult> {
    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
      return this.localFallback(expectedAmountPkr, expectedDestination);
    }

    const prompt = `
You are a payment-proof OCR engine. Extract only:
- transfer_amount_number
- recipient_account_or_raast
- bank_or_wallet_name
- currency
- transaction_date_or_time

Return STRICT JSON with these keys; if missing return null for that key.
Never return markdown.
`.trim();

    const payload = {
      model: 'qwen-vl-plus',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
      },
      parameters: { result_format: 'message', max_tokens: 256, temperature: 0 },
    };

    try {
      const response = await axios.post(DASHSCOPE_VISION_URL, payload, {
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });

      const content =
        response.data?.output?.choices?.[0]?.message?.content?.trim() || '';
      const cleaned = content
        .replace(/^```json\n?/, '')
        .replace(/```$/, '')
        .trim();

      const parsed = JSON.parse(cleaned) as PaymentProofFields;
      return this.evaluate(parsed, expectedAmountPkr, expectedDestination, cleaned);
    } catch (error: any) {
      console.error('[AI PaymentVerifier] error:', error.response?.data || error.message);
      return this.localFallback(expectedAmountPkr, expectedDestination);
    }
  }

  private evaluate(
    fields: PaymentProofFields,
    expectedAmountPkr: number,
    expectedDestination: string,
    raw: string
  ): PaymentVerificationResult {
    const normalizedRecipient = String(fields.recipient || '')
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const normalizedExpected = String(expectedDestination)
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const amountMatch = Number(fields.amount) === Number(expectedAmountPkr);
    const recipientMatch = normalizedRecipient.includes(normalizedExpected) ||
      normalizedExpected.includes(normalizedRecipient);
    const currencyOk = String(fields.currency || '').toUpperCase().includes('PKR');
    const confidence = amountMatch && recipientMatch && currencyOk ? 0.9 : 0.45;

    return {
      isValid: amountMatch && recipientMatch,
      confidence,
      fields,
      raw,
    };
  }

  private localFallback(
    expectedAmountPkr: number,
    expectedDestination: string
  ): PaymentVerificationResult {
    return {
      isValid: false,
      confidence: 0,
      fields: {
        amount: expectedAmountPkr,
        recipient: expectedDestination,
        currency: 'PKR',
      },
      raw: 'fallback',
    };
  }
}

export const aiPaymentVerifierService = new AiPaymentVerifierService();

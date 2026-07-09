# Payment Gateway Integration Guide

This document outlines how to integrate payment gateways for the Global Booking Platform, with support for USD and international payment methods.

## Supported Payment Methods

### 1. Stripe (International)

Stripe is recommended for international credit/debit card payments.

#### Setup Steps:

1. **Create Stripe Account**
   - Sign up at https://stripe.com
   - Get API keys from Dashboard

2. **Configure Environment Variables**
   ```env
   PAYMENT_GATEWAY=stripe
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Install Dependencies**
   ```bash
   cd server
   npm install stripe
   ```

4. **Update Payment Controller**
   - Implement Stripe payment intent creation
   - Handle webhook events
   - Process refunds

### 2. PayPal (Global)

PayPal is a widely accepted payment method for international transactions.

#### Setup Steps:

1. **Merchant Account**
   - Register at https://paypal.com
   - Get API credentials

2. **Integration**
   - Use PayPal API for payment processing
   - Implement redirect to PayPal checkout
   - Handle callback URLs

3. **Environment Variables**
   ```env
   PAYPAL_CLIENT_ID=your_client_id
   PAYPAL_CLIENT_SECRET=your_secret
   PAYPAL_MODE=sandbox
   ```

### 3. Safepay (SE Asia / Middle East)

Safepay supports checkout flows for regional payment methods.

#### Setup Steps:

1. **Merchant Account**
   - Register at https://getsafepay.com
   - Get API credentials

2. **Integration**
   - Use Safepay checkout API
   - Implement payment initiation
   - Handle payment callbacks

3. **Environment Variables**
   ```env
   SAFEPAY_API_KEY=your_api_key
   SAFEPAY_ENVIRONMENT=sandbox
   ```

### 4. Crypto/Stablecoin (Optional)

For Web3-enabled users, Solana USDC is supported via on-chain escrow.

#### Setup Steps:
   - Connect Phantom wallet
   - Route USDC payments through smart contract escrow

## Implementation Structure

### Payment Service Layer

Create `server/src/services/payment.service.ts`:

```typescript
import Stripe from 'stripe';

export class PaymentService {
  private stripe: Stripe | null = null;

  constructor() {
    if (process.env.PAYMENT_GATEWAY === 'stripe') {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16',
      });
    }
  }

  async createPaymentIntent(amount: number, currency: string = 'USD') {
    if (this.stripe) {
      return await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
      });
    }
    // Integrate PayPal, Safepay, or crypto/stablecoin payment flows here
  }

  async processWebhook(signature: string, payload: any) {
    if (this.stripe) {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      return event;
    }
    // Handle other payment gateway webhooks
  }
}
```

### Update Payment Controller

Modify `server/src/controllers/payment.controller.ts` to use the payment service:

```typescript
import { PaymentService } from '../services/payment.service';

const paymentService = new PaymentService();

// In createPayment function:
const paymentIntent = await paymentService.createPaymentIntent(amount, 'USD');
```

## Deposit Handling

### Deposit Requirements

When AI detects high no-show risk:
1. Calculate deposit amount based on:
   - Business deposit settings
   - Risk score
   - Reservation value

2. Request payment before confirmation

3. Hold deposit until:
   - Reservation is completed
   - No-show occurs (deposit retained)
   - Cancellation (refund per policy)

### Refund Processing

Implement refund logic:
- **On-time cancellation**: Full refund
- **Late cancellation**: Partial/no refund per policy
- **No-show**: Deposit retained
- **Business cancellation**: Full refund

## Security Considerations

1. **PCI-DSS Compliance**
   - Never store full card numbers
   - Use payment gateway tokens
   - Secure webhook endpoints

2. **Data Security**
   - Encrypt sensitive payment data
   - Use HTTPS for all transactions
   - Validate webhook signatures

3. **Fraud Prevention**
   - Implement rate limiting
   - Monitor suspicious transactions
   - Use 3D Secure when available

## Testing

### Test Mode

1. Use test API keys
2. Test all payment scenarios:
   - Successful payment
   - Failed payment
   - Refund processing
   - Webhook handling

### Test Cards (Stripe)

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

## Webhook Configuration

### Stripe Webhooks

1. Set up webhook endpoint: `/api/v1/payments/webhook`
2. Configure in Stripe Dashboard
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`

### Local Testing

Use Stripe CLI:
```bash
stripe listen --forward-to localhost:5000/api/v1/payments/webhook
```

## Production Checklist

- [ ] Payment gateway credentials configured
- [ ] Webhook endpoints secured
- [ ] SSL certificate installed
- [ ] Test all payment methods
- [ ] Refund process tested
- [ ] Error handling implemented
- [ ] Logging and monitoring set up
- [ ] Compliance verified

## Support

For payment integration issues:
- Refer to payment gateway documentation
- Check server logs for errors
- Verify webhook configuration
- Test in staging environment

---

**Note**: Payment integration requires merchant accounts and API access from respective payment providers. Ensure all regulatory requirements are met before going live.

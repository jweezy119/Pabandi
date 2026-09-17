import axios from 'axios';

// US Payment Methods Configuration
const US_PAYMENT_METHODS = {
  // Card payments (Stripe integration)
  credit_card: {
    name: 'Credit Card',
    processor: 'stripe',
    api_key: 'pk_test_',
    supported_types: ['visa', 'mastercard', 'amex', 'discover']
  },
  
  // PayPal
  paypal: {
    name: 'PayPal',
    processor: 'paypal',
    api_key: 'pp_xxx',
    supported_methods: ['credit_card', 'debit_card', 'bank_transfer']
  },
  
  // Bank Transfer (ACH)
  bank_transfer: {
    name: 'Bank Transfer (ACH)',
    processor: 'stripe',
    api_key: 'pt_test_',
    supported_methods: ['ach']
  },
  
  // Apple Pay / Google Pay
  digital_wallet: {
    name: 'Digital Wallet (Apple Pay/Google Pay)',
    processor: 'stripe',
    api_key: 'pw_xxx',
    supported_methods: ['apple_pay', 'google_pay']
  },
  
  // Cash On Arrival (Onramp)
  cash_on_arrival: {
    name: 'Cash on Arrival (Onramp)',
    processor: 'stripe',
    api_key: 'co_a_xxx',
    supported_methods: ['cash']
  }
};

class PaymentService {
  private apiBase = '/api/v1';
  private paymentMethods = {};

  constructor() {
    this.initializePaymentMethods();
  }

  /**
   * Initialize all supported payment methods
   */
  private initializePaymentMethods() {
    Object.keys(US_PAYMENT_METHODS).forEach(method => {
      this.paymentMethods[method] = US_PAYMENT_METHODS[method];
    });
  }

  /**
   * Process a payment using a specific method
   * @param applicationId - The application ID
   * @param amount - Amount to charge
   * @param paymentMethod - Payment method identifier
   * @returns Payment result
   */
  async processPayment(
    applicationId: string,
    amount: number,
    paymentMethod: string
  ): Promise<PaymentResult> {
    const methodConfig = this.paymentMethods[paymentMethod];
    if (!methodConfig) {
      throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }

    const response = await axios.post(`${this.apiBase}/payments/applications/${applicationId}`, {
      amount,
      paymentMethod: methodConfig.name,
      purpose: `Mortgage application ${applicationId}`,
      currency: 'USD'
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  /**
   * Handle onramp payment (cash collection)
   * Converts physical cash to digital payment
   * @param applicationId - The application ID
   * @param amount - Amount received in cash
   * @returns Onramp payment confirmation
   */
  async processOnrampPayment(
    applicationId: string,
    amount: number
  ): Promise<OnrampPayment> {
    const response = await axios.post(`${this.apiBase}/payments/onramp/cash`, {
      applicationId,
      amount,
      currency: 'USD',
      notes: 'Cash on arrival'
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  /**
   * Process a bank transfer (ACH) payment
   * @param applicationId - The application ID
   * @param amount - Amount to transfer
   * @returns Payment result
   */
  async processBankTransfer(
    applicationId: string,
    amount: number
  ): Promise<PaymentResult> {
    const response = await axios.post(`${this.apiBase}/payments/applications/${applicationId}`, {
      amount,
      paymentMethod: 'bank_transfer',
      purpose: `Mortgage application ${applicationId}`,
      currency: 'USD'
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  /**
   * Refund a payment
   * @param paymentId - The payment ID to refund
   * @returns Refund result
   */
  async refundPayment(paymentId: string): Promise<RefundResult> {
    const response = await axios.post(`${this.apiBase}/payments/{paymentId}/refund`, {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  /**
   * Get available payment methods for a client
   * @param clientId - Client ID
   * @returns Array of available payment methods
   */
  getAvailablePaymentMethods(clientId: string): string[] {
    const client = this.crmService.getClient(clientId);
    if (!client) throw new Error(`Client ${clientId} not found`);

    return Object.keys(this.paymentMethods).filter(m => 
      client.paymentMethods?.includes(m) || m !== 'cash_on_arrival'
    );
  }

  /**
   * Get payment history for a client
   * @param clientId - Client ID
   * @returns Payment history array
   */
  async getPaymentHistory(clientId: string): Promise<Array<any>> {
    const history = await axios.get(`${this.apiBase}/payments/client/${clientId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    return history.data;
  }
}

export default PaymentService;
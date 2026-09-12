import axios from 'axios';

const API_BASE = '/api/v1';

export class PaymentService {
  /**
   * Process a payment for a mortgage application
   * @param applicationId - The mortgage application ID
   * @param amount - Amount to charge
   * @param paymentMethod - Payment method (card, bank_transfer, etc.)
   * @returns Payment result
   */
  async processPayment(applicationId: string, amount: number, paymentMethod: string): Promise<PaymentResult> {
    const token = localStorage.getItem('token');
    
    const response = await axios.post(`${API_BASE}/payments/applications/${applicationId}`, {
      amount,
      paymentMethod,
      purpose: `Mortgage application ${applicationId}`
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
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
    const token = localStorage.getItem('token');
    
    const response = await axios.post(`${API_BASE}/payments/{paymentId}/refund`, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  }
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
  status: 'charged' | 'failed' | 'refunded';
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
}
import { io } from 'socket.io-client';
import { MortgageCRMService } from '../src/crm/mortgageService';

export class NotificationService {
  private socket: any;
  private mortgageService: MortgageCRMService;

  constructor() {
    this.mortgageService = new MortgageCRMService(
      null, // sitaraApi - would need to be injected in practice
      null  // pabandiUser
    );
    this.initSocket();
  }

  private initSocket() {
    // Initialize Socket.IO connection for real-time notifications
    this.socket = io('http://localhost:3000');
    
    this.socket.on('mortgage.status.update', (data) => {
      console.log('Mortgage status updated:', data);
      // Emit notification to frontend
      this.emitNotification(`Mortgage status updated to ${data.status}`, data);
    });
    
    this.socket.on('payment.processed', (data) => {
      console.log('Payment processed:', data);
      this.emitNotification(`Payment of $${data.amount} processed for mortgage ${data.mortgageId}`, data);
    });
  }

  /**
   * Send a notification about a mortgage status change
   * @param recipientId - User ID to notify
   * @param message - Notification message
   * @param type - Notification type (info, alert, success)
   */
  sendNotification(recipientId: string, message: string, type: string = 'info') {
    if (this.socket) {
      this.socket.emit('notification', {
        userId: recipientId,
        message,
        type,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send a payment confirmation notification
   * @param recipientId - User ID
   * @param paymentId - Payment ID
   * @param amount - Amount paid
   */
  sendPaymentNotification(recipientId: string, paymentId: string, amount: number) {
    this.sendNotification(recipientId, `Payment of $${amount} processed`, 'success');
  }

  /**
   * Listen for mortgage events and forward to notifications
   */
  onMortgageEvents(callback: (event: string, data: any) => void) {
    this.socket.on('mortgage.*', callback);
  }
}

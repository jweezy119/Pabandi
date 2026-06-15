import axios from 'axios';
import { logger } from '../utils/logger';

class OdooService {
  private url: string;
  private db: string;
  private username: string;
  private apiKey: string;
  private uid: number | null = null;

  constructor() {
    this.url = process.env.ODOO_URL || '';
    this.db = process.env.ODOO_DB || '';
    this.username = process.env.ODOO_USERNAME || '';
    this.apiKey = process.env.ODOO_API_KEY || '';
  }

  private isConfigured(): boolean {
    return !!(this.url && this.db && this.username && this.apiKey);
  }

  private async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    
    if (!this.isConfigured()) {
      throw new Error('Odoo is not fully configured in environment variables.');
    }

    try {
      const response = await axios.post(`${this.url}/jsonrpc`, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'common',
          method: 'authenticate',
          args: [this.db, this.username, this.apiKey, {}]
        },
        id: Math.floor(Math.random() * 1000000)
      });

      if (response.data.error) {
        throw new Error(response.data.error.data.message || 'Authentication failed');
      }

      this.uid = response.data.result;
      if (!this.uid) {
        throw new Error('Failed to retrieve UID from Odoo');
      }

      logger.info(`Successfully authenticated with Odoo CRM (UID: ${this.uid})`);
      return this.uid;
    } catch (error: any) {
      logger.error('Odoo Authentication Error:', error.message || error);
      throw error;
    }
  }

  private async executeKw(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    const uid = await this.authenticate();

    try {
      const response = await axios.post(`${this.url}/jsonrpc`, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [this.db, uid, this.apiKey, model, method, args, kwargs]
        },
        id: Math.floor(Math.random() * 1000000)
      });

      if (response.data.error) {
        throw new Error(response.data.error.data.message || `Failed to execute ${method} on ${model}`);
      }

      return response.data.result;
    } catch (error: any) {
      logger.error(`Odoo execute_kw Error (${model}.${method}):`, error.message || error);
      throw error;
    }
  }

  public async syncNewBusiness(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    businessName: string;
  }): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn('Skipping Odoo sync: Odoo credentials are not configured.');
      return;
    }

    try {
      // 1. Create a Contact (res.partner) for the Business
      const partnerId = await this.executeKw('res.partner', 'create', [[{
        name: data.businessName,
        email: data.email,
        phone: data.phone || '',
        is_company: true,
        company_type: 'company'
      }]]);

      // 2. Create a Contact (res.partner) for the Individual Person
      const personId = await this.executeKw('res.partner', 'create', [[{
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone || '',
        parent_id: partnerId,
        is_company: false,
        type: 'contact'
      }]]);

      // 3. Create a Lead/Opportunity (crm.lead)
      await this.executeKw('crm.lead', 'create', [[{
        name: `New Pabandi Registration: ${data.businessName}`,
        partner_id: partnerId,
        email_from: data.email,
        phone: data.phone || '',
        contact_name: `${data.firstName} ${data.lastName}`,
        description: `Automated sync from Pabandi backend.\nBusiness: ${data.businessName}\nOwner: ${data.firstName} ${data.lastName}`,
        type: 'lead'
      }]]);

      logger.info(`Successfully synced business ${data.businessName} to Odoo CRM.`);
    } catch (error: any) {
      logger.error(`Failed to sync business ${data.businessName} to Odoo:`, error.message || error);
    }
  }
}

export const odooService = new OdooService();

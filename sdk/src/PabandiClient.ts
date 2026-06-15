import axios, { AxiosInstance } from 'axios';
import { BusinessResource } from './resources/Business';
import { AuthResource } from './resources/Auth';
import { ReliabilityResource } from './resources/Reliability';

export interface PabandiClientOptions {
  apiKey?: string;
  bearerToken?: string;
  environment?: 'production' | 'development' | 'local';
}

export class PabandiClient {
  private client: AxiosInstance;
  
  public business: BusinessResource;
  public auth: AuthResource;
  public reliability: ReliabilityResource;

  constructor(options: PabandiClientOptions) {
    let baseURL = 'https://pabandi-backend-97129395003.asia-south1.run.app/api/v1';
    
    if (options.environment === 'development') {
      baseURL = 'https://dev.api.pabandi.com/api/v1'; // Example
    } else if (options.environment === 'local') {
      baseURL = 'http://localhost:5000/api/v1';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.apiKey) {
      headers['x-api-key'] = options.apiKey;
    }
    if (options.bearerToken) {
      headers['Authorization'] = `Bearer ${options.bearerToken}`;
    }

    this.client = axios.create({
      baseURL,
      headers,
    });

    this.business = new BusinessResource(this.client);
    this.auth = new AuthResource(this.client);
    this.reliability = new ReliabilityResource(this.client);
  }
}

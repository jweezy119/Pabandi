import { AxiosInstance } from 'axios';

export class BusinessResource {
  constructor(private client: AxiosInstance) {}

  async list(params?: any) {
    const response = await this.client.get('/businesses', { params });
    return response.data;
  }

  async getById(id: string) {
    const response = await this.client.get(`/businesses/${id}`);
    return response.data;
  }

  async getMyBusiness() {
    const response = await this.client.get('/businesses/me');
    return response.data;
  }

  async register(data: any) {
    const response = await this.client.post('/businesses/register', data);
    return response.data;
  }

  async getCustomers() {
    const response = await this.client.get('/businesses/me/customers');
    return response.data;
  }
}

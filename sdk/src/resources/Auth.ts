import { AxiosInstance } from 'axios';

export class AuthResource {
  constructor(private client: AxiosInstance) {}

  async register(data: any) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(data: any) {
    const response = await this.client.post('/auth/login', data);
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }
}

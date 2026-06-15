import { AxiosInstance } from 'axios';

export class ReliabilityResource {
  constructor(private client: AxiosInstance) {}

  async getMatrix(userId: string) {
    const response = await this.client.get(`/reliability/matrix/${userId}`);
    return response.data;
  }

  async verifyIdentity(data: any) {
    const response = await this.client.post('/reliability/verify', data);
    return response.data;
  }
}

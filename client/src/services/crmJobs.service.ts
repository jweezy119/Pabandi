import { apiClient } from './api';

export const crmJobsService = {
  getJobs: async (filters: any = {}) => {
    const response = await apiClient.get('/crm/jobs', { params: filters });
    return response.data;
  },

  getJob: async (jobId: string) => {
    const response = await apiClient.get(`/crm/jobs/${jobId}`);
    return response.data;
  },

  createJob: async (jobData: any) => {
    const response = await apiClient.post('/crm/jobs', jobData);
    return response.data;
  },

  updateJobStatus: async (jobId: string, status: string) => {
    const response = await apiClient.patch(`/crm/jobs/${jobId}/status`, { status });
    return response.data;
  },

  assignWorker: async (jobId: string, employeeId: string) => {
    const response = await apiClient.post(`/crm/jobs/${jobId}/assign`, { employeeId });
    return response.data;
  },

  getJobsByClient: async (clientId: string) => {
    const response = await apiClient.get(`/crm/clients/${clientId}/jobs`);
    return response.data;
  }
};

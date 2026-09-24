import axios from 'axios';
import { API_BASE_URL } from './api';

export const crmJobsService = {
  getJobs: async (filters: any = {}) => {
    const response = await axios.get(`${API_BASE_URL}/crm/jobs`, { params: filters });
    return response.data;
  },

  getJob: async (jobId: string) => {
    const response = await axios.get(`${API_BASE_URL}/crm/jobs/${jobId}`);
    return response.data;
  },

  createJob: async (jobData: any) => {
    const response = await axios.post(`${API_BASE_URL}/crm/jobs`, jobData);
    return response.data;
  },

  updateJobStatus: async (jobId: string, status: string) => {
    const response = await axios.patch(`${API_BASE_URL}/crm/jobs/${jobId}/status`, { status });
    return response.data;
  },

  assignWorker: async (jobId: string, employeeId: string) => {
    const response = await axios.post(`${API_BASE_URL}/crm/jobs/${jobId}/assign`, { employeeId });
    return response.data;
  },

  getJobsByClient: async (clientId: string) => {
    const response = await axios.get(`${API_BASE_URL}/crm/clients/${clientId}/jobs`);
    return response.data;
  }
};

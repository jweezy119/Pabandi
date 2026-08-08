import axios from 'axios';

const API_URL = '/api/v1';

export const jobsService = {
  getJobDetails: async (jobId: string) => {
    const response = await axios.get(`${API_URL}/jobs/${jobId}`);
    return response.data.data;
  },

  applyForJob: async (jobId: string, resumeUrl?: string) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_URL}/jobs/${jobId}/apply`,
      { resumeUrl },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  }
};

import axios from 'axios';

const API_URL = '/api/v1';

export const bookingService = {
  /**
   * Creates a reservation/escrow lock for a freelance milestone
   */
  createFreelanceBooking: async (businessId: string, estimatedHours: number, description: string, hourlyRate: number) => {
    const token = localStorage.getItem('token');
    
    // We send a generic POST to reservations, but we specify it's for a freelancer
    // The backend will catch the business category and auto-format the dates and calculate totals
    const payload = {
      businessId,
      // Pass today's date and a default time since freelance milestones aren't strictly calendar events
      reservationDate: new Date().toISOString().split('T')[0],
      reservationTime: '12:00',
      numberOfGuests: 1, // required by schema, but irrelevant for freelance
      customerName: 'Freelance Client', // backend uses user profile to fill this anyway
      notes: `Freelance Milestone: ${description}\nEstimated Hours: ${estimatedHours}\nHourly Rate: $${hourlyRate}/hr`,
      isFreelanceEscrow: true,
      estimatedHours,
      hourlyRate
    };

    const response = await axios.post(`${API_URL}/reservations`, payload, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  }
};

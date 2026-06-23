import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { businessService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useQueryClient } from 'react-query';

export default function BusinessRegister() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'ECOMMERCE',
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await businessService.createBusiness(formData);
      const updatedUser = response.data?.data?.user;
      if (updatedUser) {
        useAuthStore.getState().setUser({
          ...useAuthStore.getState().user!,
          ...updatedUser,
        });
      }
      if (response.data?.data?.business) {
        queryClient.setQueryData('my-business', response.data.data.business);
      } else {
        queryClient.invalidateQueries('my-business');
      }
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.data?.message?.includes('already has a business')) {
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setUser({ ...currentUser, role: 'BUSINESS_OWNER' });
        }
        queryClient.invalidateQueries('my-business');
        navigate('/dashboard');
        return;
      }
      const rawErrorMsg = err.response?.data?.message;
      const debugDetails = rawErrorMsg || (err.message ? `[${err.name}: ${err.message}]` : JSON.stringify(err));
      setError(`Failed to register business. Details: ${debugDetails}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="card-surface">
        <h2 className="text-2xl font-bold mb-6 text-on-surface font-headline">Register Your Business</h2>
        
        {error && (
          <div className="bg-error-container text-on-error-container border border-error/20 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant mb-1">
              Business Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="input-field"
              placeholder="Your Business / Platform Name"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-on-surface-variant mb-1">
              Category *
            </label>
            <select
              id="category"
              name="category"
              required
              value={formData.category}
              onChange={handleChange}
              className="input-field"
            >
              <option value="ECOMMERCE">E-Commerce Platform</option>
              <option value="MARKETPLACE">Online Marketplace</option>
              <option value="LIVE_SELLER">Live Seller</option>
              <option value="RESTAURANT">Restaurant</option>
              <option value="SALON">Salon</option>
              <option value="SPA">Spa</option>
              <option value="CLINIC">Clinic</option>
              <option value="HOSPITAL">Hospital</option>
              <option value="FITNESS_CENTER">Fitness Center</option>
              <option value="EVENT_VENUE">Event Venue</option>
              <option value="FREELANCE">Freelance</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-on-surface-variant mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="input-field"
              placeholder="Tell customers about your business..."
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-on-surface-variant mb-1">
              Address *
            </label>
            <input
              id="address"
              name="address"
              type="text"
              required
              value={formData.address}
              onChange={handleChange}
              className="input-field"
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-on-surface-variant mb-1">
                City *
              </label>
              <input
                id="city"
                name="city"
                type="text"
                required
                value={formData.city}
                onChange={handleChange}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-on-surface-variant mb-1">
                Phone *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                className="input-field"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-on-surface-variant mb-1">
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="input-field"
              placeholder="business@example.com"
            />
          </div>

          <div>
            <label htmlFor="website" className="block text-sm font-medium text-on-surface-variant mb-1">
              Website (optional)
            </label>
            <input
              id="website"
              name="website"
              type="url"
              value={formData.website}
              onChange={handleChange}
              className="input-field"
              placeholder="https://yourwebsite.com"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Registering...' : 'Register Business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

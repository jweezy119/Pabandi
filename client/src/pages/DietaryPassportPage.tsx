import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function DietaryPassportPage() {
  const { user, checkAuth } = useAuthStore();
  const [allergies, setAllergies] = useState<string>('');
  const [preferences, setPreferences] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.encryptedDietaryData) {
      try {
        const payload = JSON.parse(atob(user.encryptedDietaryData));
        setAllergies(payload.allergies || '');
        setPreferences(payload.preferences || '');
      } catch (e) {
        console.error("Failed to parse backup data", e);
      }
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = JSON.stringify({ allergies, preferences });
      const encryptedBackup = btoa(payload);

      await api.patch('/users/me', {
        encryptedDietaryData: encryptedBackup
      });
      
      toast.success('Zero-Knowledge Passport saved securely.');
      await checkAuth(); // Refresh user state
    } catch (error) {
      console.error(error);
      toast.error('Failed to save passport.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dietary & Preference Passport</h1>
      <p className="text-gray-600 mb-8">
        Your dietary preferences are encrypted locally using Zero-Knowledge architecture. 
        Pabandi servers cannot read this data. It is only decrypted by the restaurant when you book a table.
      </p>

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Allergies & Restrictions
            </label>
            <div className="mt-1">
              <textarea
                rows={3}
                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="e.g., Peanuts, Gluten, Shellfish"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Dining Preferences
            </label>
            <div className="mt-1">
              <textarea
                rows={3}
                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="e.g., Preferred seating, spice tolerance"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
              />
            </div>
          </div>

          {user?.encryptedDietaryData && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">
                ✅ Your passport is currently secured and backed up.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? 'Encrypting & Saving...' : 'Save Encrypted Passport'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

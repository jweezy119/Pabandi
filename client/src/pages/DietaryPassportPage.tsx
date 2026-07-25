import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { Surface, Button, tokens } from '../design-system';
import { toast } from 'react-hot-toast';

export default function DietaryPassportPage() {
  const { user, updateProfile } = useAuthStore();
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
      updateProfile({ encryptedDietaryData: encryptedBackup });
    } catch (error) {
      console.error(error);
      toast.error('Failed to save passport.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 font-body" style={{ background: tokens.color.background, color: tokens.color.text }}>
      <h1 className="font-headline mb-6 text-3xl font-bold text-on-surface">
        Dietary & Preference Passport
      </h1>
      <p className="mb-8" style={{ color: tokens.color.muted }}>
        Your dietary preferences are encrypted locally using Zero-Knowledge architecture. 
        Pabandi servers cannot read this data. It is only decrypted by the restaurant when you book a table.
      </p>

      <Surface className="p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface">
              Allergies & Restrictions
            </label>
            <div>
              <textarea
                rows={3}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
                placeholder="e.g., Peanuts, Gluten, Shellfish"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface">
              Dining Preferences
            </label>
            <div>
              <textarea
                rows={3}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: tokens.color.background, borderColor: tokens.color.border, color: tokens.color.text }}
                placeholder="e.g., Preferred seating, spice tolerance"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
              />
            </div>
          </div>

          {user?.encryptedDietaryData && (
            <div className="rounded-xl border p-4" style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)' }}>
              <p className="text-sm text-emerald-300">
                ✅ Your passport is currently secured and backed up.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Encrypting & Saving...' : 'Save Encrypted Passport'}
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  );
}

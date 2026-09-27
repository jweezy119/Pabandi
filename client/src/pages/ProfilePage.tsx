import React from 'react';
import { PageTransition } from '../components/PageTransition';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/primitives/Button';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user } = useAuthStore();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Profile updated');
  };

  return (
    <ErrorBoundary>
      <PageTransition>
        <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-8">
          
          <header>
            <h1 className="text-3xl font-bold text-[var(--warm-ink)] font-headline tracking-tight">
              Personal Profile
            </h1>
            <p className="text-[var(--soft-stone)] mt-1">
              Manage your account settings and preferences.
            </p>
          </header>

          <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)]">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] border-b border-[rgba(191,179,163,0.2)] pb-4">
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--warm-ink)]">Full Name</label>
                <input 
                  type="text" 
                  defaultValue={user?.name || ''}
                  className="w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--atmosphere)] text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--warm-ink)]">Email Address</label>
                <input 
                  type="email" 
                  defaultValue={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.2)] bg-[rgba(191,179,163,0.1)] text-[var(--soft-stone)] cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--warm-ink)]">Phone Number</label>
                <input 
                  type="tel" 
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--atmosphere)] text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--warm-ink)]">Timezone</label>
                <select className="w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--atmosphere)] text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]">
                  <option>UTC (Coordinated Universal Time)</option>
                  <option>EST (Eastern Standard Time)</option>
                  <option>PST (Pacific Standard Time)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[rgba(191,179,163,0.2)]">
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>

        </div>
      </PageTransition>
    </ErrorBoundary>
  );
}

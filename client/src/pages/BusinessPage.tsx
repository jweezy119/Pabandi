import React from 'react';
import { PageTransition } from '../components/PageTransition';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Button } from '../components/primitives/Button';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function BusinessPage() {
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Business profile updated');
  };

  return (
    <ErrorBoundary>
      <PageTransition>
        <div className="max-w-4xl mx-auto p-6 lg:p-10 space-y-8">
          
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--warm-ink)] font-headline tracking-tight">
                Business Settings
              </h1>
              <p className="text-[var(--soft-stone)] mt-1">
                Manage your organization details, billing, and team.
              </p>
            </div>
            <Link to="/contact/settings" className="px-4 py-2 bg-white rounded-xl shadow-sm border border-[rgba(191,179,163,0.2)] text-sm font-semibold text-[var(--warm-ink)] hover:bg-[rgba(0,0,0,0.02)] transition-colors">
              Advanced Settings →
            </Link>
          </header>

          <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-3xl shadow-sm border border-[rgba(191,179,163,0.2)]">
            <h2 className="text-lg font-bold text-[var(--warm-ink)] border-b border-[rgba(191,179,163,0.2)] pb-4">
              Organization Info
            </h2>
            
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-[var(--atmosphere)] border-2 border-dashed border-[rgba(191,179,163,0.4)] flex items-center justify-center text-[var(--soft-stone)] hover:border-[var(--clay)] hover:text-[var(--clay)] transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[32px]">add_photo_alternate</span>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--warm-ink)]">Business Logo</h3>
                <p className="text-sm text-[var(--soft-stone)]">Recommended 512x512 PNG or JPG.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--warm-ink)]">Business Name</label>
                <input 
                  type="text" 
                  defaultValue="My Organization"
                  className="w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--atmosphere)] text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--warm-ink)]">Industry / Vertical</label>
                <select className="w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--atmosphere)] text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]">
                  <option>Cleaning Services</option>
                  <option>Property Management</option>
                  <option>Freelance / Consulting</option>
                  <option>Logistics</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-[var(--warm-ink)]">Business Address</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--atmosphere)] text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--warm-ink)]">Tax ID / EIN</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-[rgba(191,179,163,0.4)] bg-[var(--atmosphere)] text-[var(--warm-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)]"
                />
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

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { ClaySkeletonCard } from '../components/primitives/ClaySkeleton';

/**
 * Trust & Verification Hub — /background-check
 *
 * Premium Warm Clay entry point for identity verification. Users and agents
 * verify their identity, link government registries, and boost their Pabandi
 * Trust Score to unlock higher-paying jobs and zero-deposit bookings.
 *
 * Commit 1: shell + theme + skeleton.
 * Commit 2: breadcrumb, verification cards, mode-based back navigation, Coming Soon toasts.
 */
export default function BackgroundCheckPage() {
  const [loading] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--warm-sand)]/30 px-3 py-1.5 mb-4">
              <Shield className="h-5 w-5 text-[var(--clay)]" />
              <span className="font-label text-xs font-bold uppercase text-[var(--clay)] tracking-wider">
                Trust & Safety
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold font-headline tracking-tight">
              Trust & Verification Hub
            </h1>
            <p className="mt-3 text-lg text-[var(--soft-stone)] leading-relaxed">
              Verify your identity, link government registries, and boost your Pabandi Trust Score to unlock higher-paying jobs and zero-deposit bookings.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <ClaySkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

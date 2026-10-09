import React from 'react';
import { useLocation, Link } from 'react-router-dom';

export default function PlaceholderPage() {
  const location = useLocation();
  const path = location.pathname;

  let title = 'Section';
  if (path.includes('live-selling')) title = 'Live Selling';
  else if (path.includes('freelancers')) title = 'Freelancers';
  else if (path.includes('gigs')) title = 'Gig Board';
  else if (path.includes('hospitality')) title = 'Hospitality';
  else if (path.includes('passports')) title = 'Trust Passports';
  else if (path.includes('deposits')) title = 'Protected Deposit';
  else if (path.includes('escrow')) title = 'Escrow';
  else if (path.includes('cashout')) title = 'Cash Out';
  else if (path.includes('technology')) title = 'Technology';
  else if (path.includes('contact-us')) title = 'Contact Us';
  else if (path.includes('blog')) title = 'Blog';
  else if (path.includes('privacy')) title = 'Privacy Policy';
  else if (path.includes('terms')) title = 'Terms of Service';

  return (
    <div className="min-h-screen bg-[var(--cream)] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--clay)]/20 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-3xl text-[var(--clay)]">layers</span>
      </div>
      <h1 className="font-headline font-bold text-4xl text-[var(--warm-ink)] mb-4">Undergoing Integration</h1>
      <p className="font-body text-lg text-on-surface-variant max-w-md mb-8">
        We are currently upgrading the Pabandi ecosystem. Standalone features (like {title}) are being integrated directly into our 5 core OS layers (Contact, Booking, Property, Freight, Capital) for a seamless experience. Check back soon.
      </p>
      <Link to="/dashboard" className="px-6 py-3 rounded-xl bg-[var(--clay)] text-white font-bold hover:shadow-lg hover:-translate-y-1 transition-all">
        Back to Dashboard
      </Link>
    </div>
  );
}

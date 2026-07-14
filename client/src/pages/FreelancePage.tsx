import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function FreelancePage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const qs = location.search.includes('category=FREELANCE') ? location.search : '?category=FREELANCE';
    navigate({ pathname: '/search', search: qs }, { replace: true });
  }, [navigate, location.search]);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body pt-12">
      <div className="max-w-4xl mx-auto px-4 text-sm text-on-surface-variant">Redirecting to freelancers...</div>
    </div>
  );
}

// Sitara OS — Footer

import { Link } from 'react-router-dom';

export default function SitaraFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">★</span>
              </div>
              <span className="font-bold text-xl text-white">Sitara</span>
            </div>
            <p className="text-sm">
              The booking OS for the service economy. Secured by trust, powered by stars.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">For Guests</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/sitara" className="hover:text-white">Discover</Link></li>
              <li><Link to="/sitara/my-bookings" className="hover:text-white">My Bookings</Link></li>
              <li><Link to="/sitara/star-card" className="hover:text-white">Star Card</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">For Operators</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/sitara/operator" className="hover:text-white">Dashboard</Link></li>
              <li><Link to="/sitara/operator/units" className="hover:text-white">Units</Link></li>
              <li><Link to="/sitara/operator/star-finder" className="hover:text-white">Star Finder</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">For Tenants</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/sitara/tenant" className="hover:text-white">Portal</Link></li>
              <li><Link to="/sitara/tenant/payments" className="hover:text-white">Payments</Link></li>
              <li><Link to="/sitara/tenant/maintenance" className="hover:text-white">Maintenance</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 text-sm text-center">
          <p>© 2026 Sitara OS · Powered by Pabandi · Trust layer for the service economy</p>
        </div>
      </div>
    </footer>
  );
}

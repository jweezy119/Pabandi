// Sitara OS — Main Layout
// Shared layout with Sitara branding

import { Outlet } from 'react-router-dom';
import SitaraHeader from './SitaraHeader';
import SitaraFooter from './SitaraFooter';

export default function SitaraLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SitaraHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SitaraFooter />
    </div>
  );
}

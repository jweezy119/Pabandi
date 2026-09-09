// Sitara OS — Consumer Layout
// Layout for guest/consumer-facing pages

import { Outlet } from 'react-router-dom';
import SitaraHeader from '../../components/SitaraHeader';
import SitaraFooter from '../../components/SitaraFooter';

export default function ConsumerLayout() {
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

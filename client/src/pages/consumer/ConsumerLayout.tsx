import { Outlet } from 'react-router-dom';
import ConsumerBottomNav from '../../components/consumer/ConsumerBottomNav';

export default function ConsumerLayout() {
  return (
  <div className="min-h-screen bg-amber-50 pb-[env(safe-area-inset-bottom)]">
    <Outlet />
    <ConsumerBottomNav />
  </div>
  );
}

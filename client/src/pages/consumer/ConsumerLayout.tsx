import { Outlet } from 'react-router-dom';
import BottomNav from '../../components/BottomNav';

export default function ConsumerLayout() {
  return (
    <div className="min-h-screen bg-amber-50 pb-[env(safe-area-inset-bottom)]">
      <Outlet />
      <BottomNav />
    </div>
  );
}

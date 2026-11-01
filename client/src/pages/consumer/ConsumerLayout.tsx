import { Outlet } from 'react-router-dom';
import ConsumerBottomNav from '../../components/consumer/ConsumerBottomNav';

export default function ConsumerLayout() {
  return (
    <div className="min-h-screen bg-amber-50">
      <Outlet />
      <ConsumerBottomNav />
    </div>
  );
}

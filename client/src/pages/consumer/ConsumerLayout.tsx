import { Outlet } from 'react-router-dom';
import BottomNav from '../../components/BottomNav';
import { PageTransition } from '../../components/PageTransition';

export default function ConsumerLayout() {
  return (
    <div className="h-dvh-shell flex flex-col bg-[var(--cream)] overflow-hidden">
      <main className="flex-1 overflow-y-auto overscroll-y-contain mobile-safe-bottom">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <BottomNav />
    </div>
  );
}

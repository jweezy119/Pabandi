import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

function CRMMobileTab({ to, icon, label, current }: { to: string; icon: string; label: string; current: boolean }) {
  return (
    <a
      href={to}
      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-2xl transition-all touch-target ${
        current ? 'text-primary bg-primary-container/30 scale-[1.05]' : 'text-on-surface-variant hover:text-primary active:scale-95'
      }`}
    >
      <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: current ? "'FILL' 1" : "'FILL' 0" }}>
        {icon}
      </span>
      <span className="font-body text-[10px] font-semibold tracking-wide">{label}</span>
    </a>
  );
}

export default function CRMMobileLayout() {
  const location = useLocation();
  const path = location.pathname;
  const isSales = path.startsWith('/sales-crm');
  const base = isSales ? '/sales-crm' : '/property-manager';

  return (
    <div className="min-h-screen pb-20">
      <main className="max-w-3xl mx-auto">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 w-full z-50 bg-surface-bright/80 backdrop-blur-xl border-t border-outline-variant/10 safe-area-pb">
        <div className="flex justify-around items-center px-1 py-1.5 max-w-md mx-auto">
          <CRMMobileTab to={`${base}`} icon="dashboard" label="Home" current={path === base} />
          <CRMMobileTab to={`${base}/pipeline`} icon="view_kanban" label="Pipeline" current={path.startsWith(`${base}/pipeline`)} />
          <CRMMobileTab to={`${base}/contacts`} icon="people" label="Contacts" current={path.startsWith(`${base}/contacts`)} />
          <CRMMobileTab to={`${base}/tasks`} icon="checklist" label="Tasks" current={path.startsWith(`${base}/tasks`)} />
          <CRMMobileTab to={`${base}/ai`} icon="auto_awesome" label="AI" current={path.startsWith(`${base}/ai`)} />
        </div>
      </nav>
    </div>
  );
}

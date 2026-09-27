import React from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/primitives/Card';

const navItems = [
  { path: '/contact', label: 'Dashboard', icon: 'dashboard', end: true },
  { path: '/contact/clients', label: 'Clients', icon: 'groups' },
  { path: '/contact/deals', label: 'Deals', icon: 'handshake' },
  { path: '/contact/jobs', label: 'Jobs', icon: 'work' },
  { path: '/contact/activities', label: 'Activities', icon: 'notifications' },
  { path: '/contact/team', label: 'Team', icon: 'badge' },
  { path: '/contact/reports', label: 'Reports', icon: 'analytics' },
  { path: '/contact/settings', label: 'Settings', icon: 'settings' },
];

export function SettingsHubPage() {
  const navigate = useNavigate();

  const settingsCards = [
    { id: 'profile', icon: 'storefront', title: 'Business Profile', desc: 'Name, logo, address, timezone', path: '/contact/settings/profile' },
    { id: 'modules', icon: 'extension', title: 'Modules', desc: 'Toggle features and CRM modules', path: '/contact/settings/modules' },
    { id: 'custom-fields', icon: 'text_fields', title: 'Custom Fields', desc: 'Define fields for CRM records', path: '/contact/settings/custom-fields' },
    { id: 'pipeline', icon: 'view_kanban', title: 'Pipeline Settings', desc: 'Manage deal stages and probabilities', path: '/contact/settings/pipeline' },
    { id: 'services', icon: 'design_services', title: 'Service Catalog', desc: 'Manage your offered services', path: '/contact/settings/services' },
    { id: 'payment', icon: 'payments', title: 'Payment & Escrow', desc: 'Deposit rules and invoicing preferences', path: '/contact/settings/payment' },
    { id: 'trust', icon: 'verified_user', title: 'Trust Settings', desc: 'Thresholds, escrow triggers, scores', path: '/contact/settings/trust' },
    { id: 'notifications', icon: 'notifications_active', title: 'Notifications', desc: 'Email, SMS, and in-app alerts', path: '/contact/settings/notifications' },
    { id: 'api-keys', icon: 'key', title: 'API Keys', desc: 'Generate and manage API keys', path: '/contact/settings/api-keys' },
    { id: 'webhooks', icon: 'webhook', title: 'Webhooks', desc: 'Event subscriptions and delivery logs', path: '/contact/settings/webhooks' },
  ];

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" navItems={navItems}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="clay-heading pb-2">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Settings Hub</h1>
          <p className="text-sm text-[var(--soft-stone)] mt-0.5">Manage your workspace configuration</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settingsCards.map(card => (
            <Card 
              key={card.id} 
              padding="lg" 
              className="cursor-pointer hover:shadow-md transition-shadow group flex items-start gap-4"
              onClick={() => navigate(card.path)}
            >
              <div className="w-10 h-10 rounded-full bg-[var(--clay)]/10 flex items-center justify-center text-[var(--clay)] group-hover:bg-[var(--clay)] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[20px]">{card.icon}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--warm-ink)]">{card.title}</h3>
                <p className="text-xs text-[var(--soft-stone)] mt-1 leading-relaxed">{card.desc}</p>
              </div>
              <span className="material-symbols-outlined text-[var(--soft-stone)] opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

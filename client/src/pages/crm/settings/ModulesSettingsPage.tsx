import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card, Button, Chip } from '../../../components/primitives';
import { useBusinessSettings } from '../../../hooks/useBusinessSettings';

const MODULES = [
  {
    id: 'contact',
    name: 'ContactOS',
    description: 'Your CRM — track clients, deals, invoices',
    icon: 'contacts',
    accentColor: 'clay',
    route: '/contact',
    isDefault: true,
    verticals: ['all'],
    subFeatures: [
      { id: 'clients', name: 'Clients', description: 'Manage your customers', defaultOn: true },
      { id: 'deals', name: 'Deals', description: 'Track sales pipeline', defaultOn: true },
      { id: 'invoices', name: 'Invoices', description: 'Bill your clients', defaultOn: true },
      { id: 'activities', name: 'Activities', description: 'Log calls and notes', defaultOn: true },
      { id: 'tasks', name: 'Tasks', description: 'Manage to-dos', defaultOn: true },
      { id: 'companies', name: 'Companies', description: 'B2B Accounts', defaultOn: false },
      { id: 'jobs', name: 'Jobs & Scheduling', description: 'Service orders', defaultOn: false },
      { id: 'escrow', name: 'Escrow', description: 'Secure payments', defaultOn: false },
      { id: 'reliability', name: 'Reliability Reports', description: 'Trust scores', defaultOn: true },
    ],
  },
  {
    id: 'booking',
    name: 'BookingOS',
    description: 'Booking & discovery platform',
    icon: 'calendar_today',
    accentColor: 'sage',
    route: '/booking',
    isDefault: false,
    verticals: ['salon', 'consulting'],
    subFeatures: []
  },
  {
    id: 'freight',
    name: 'FreightOS',
    description: 'Freight & logistics platform',
    icon: 'local_shipping',
    accentColor: 'sky-wash',
    route: '/freight',
    isDefault: false,
    verticals: ['logistics'],
    subFeatures: []
  },
  {
    id: 'property',
    name: 'PropertyOS',
    description: 'Property management platform',
    icon: 'apartment',
    accentColor: 'ochre',
    route: '/property',
    isDefault: false,
    verticals: ['real_estate'],
    subFeatures: []
  },
  {
    id: 'ledger',
    name: 'LedgerOS',
    description: 'Finance & accounting',
    icon: 'account_balance',
    accentColor: 'dusty-rose',
    route: '/ledger',
    isDefault: false,
    verticals: ['all'],
    subFeatures: []
  }
];



export default function ModulesSettingsPage() {
  const { settings, toggleModule, toggleFeature } = useBusinessSettings();
  const [previewText, setPreviewText] = useState<string | null>(null);

  const handleToggleFeature = (moduleId: string, featureId: string, featureName: string) => {
    toggleFeature(moduleId, featureId);
    if (!settings.enabledFeatures[moduleId]?.includes(featureId)) {
      setPreviewText(`This adds: ${featureName} to your CRM.`);
      setTimeout(() => setPreviewText(null), 3000);
    }
  };

  const handleToggleModule = (moduleId: string, moduleName: string) => {
    toggleModule(moduleId);
    if (!settings.enabledModules.includes(moduleId)) {
      setPreviewText(`This adds: ${moduleName} to PabandiOS.`);
      setTimeout(() => setPreviewText(null), 3000);
    }
  };

  return (
    <>
      <Helmet>
        <title>Module Settings — Contact OS</title>
      </Helmet>
      <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
        <div className="max-w-3xl mx-auto space-y-8 py-4 clay-fade">
          <div className="clay-heading">
            <h1 className="text-3xl font-bold" style={{ color: 'var(--warm-ink)' }}>Clay Modularity</h1>
            <p className="text-[var(--soft-stone)] mt-2">
              Your CRM adapts to your business. Turn features on or off as needed. A cleaner workspace means faster work.
            </p>
          </div>

          {previewText && (
            <div className="p-4 bg-[var(--sage)]/20 border border-[var(--sage)] rounded-2xl text-[var(--warm-ink)] text-sm font-bold animate-pulse">
              {previewText}
            </div>
          )}

          {MODULES.map(mod => {
            const isModuleEnabled = settings.enabledModules.includes(mod.id);
            const isContact = mod.id === 'contact';

            return (
              <Card key={mod.id} hover={false} className={`p-6 ${!isModuleEnabled && !isContact ? 'opacity-70' : ''} clay-rise`}>
                <div className="flex items-center justify-between mb-6 clay-heading">
          <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white clay-stat-icon" style={{ backgroundColor: `var(--${mod.accentColor})` }}>
                      <span className="material-symbols-outlined">{mod.icon}</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: 'var(--warm-ink)' }}>{mod.name.toUpperCase()}</h2>
                      <p className="text-sm text-[var(--soft-stone)]">{mod.description}</p>
                    </div>
                  </div>
                  {!isContact && (
                    <Button variant={isModuleEnabled ? 'secondary' : 'primary'} onClick={() => handleToggleModule(mod.id, mod.name)}>
                      {isModuleEnabled ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </div>

                {mod.subFeatures.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-[rgba(191,179,163,0.3)]">
                    {mod.subFeatures.map((feat, i) => {
                      const isFeatEnabled = settings.enabledFeatures[mod.id]?.includes(feat.id);
                      return (
                        <div key={feat.id} className={`flex items-center justify-between p-3 rounded-xl transition-all clay-card--interactive clay-table-row clay-rise`} style={{ animationDelay: `${i * 40}ms`, boxShadow: isFeatEnabled ? 'var(--shadow-soft)' : 'none' }}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--warm-ink)] text-sm">{feat.name}</span>
                              {feat.defaultOn && <Chip label="Always On" variant="neutral" size="sm" />}
                            </div>
                            <p className="text-xs text-[var(--soft-stone)] mt-1">{feat.description}</p>
                          </div>

                          <div
                            className={`clay-toggle-track w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                              isFeatEnabled ? 'bg-[var(--clay)]' : 'bg-[var(--soft-stone)]/30'
                            }`}
                            onClick={() => handleToggleFeature(mod.id, feat.id, feat.name)}
                          >
                            <div className={`clay-toggle-thumb w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                              isFeatEnabled ? 'translate-x-6' : 'translate-x-0'
                            }`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </DashboardLayout>
    </>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { hospitalityService } from '../services/api';
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  PlusIcon,
  BeakerIcon,
  GlobeAltIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import PropertyConnectWizard from './PropertyConnectWizard';

const PROVIDER_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  beds24: { label: 'Beds24', color: '#10b981', badge: 'OPEN API' },
  cloudbeds: { label: 'Cloudbeds', color: '#6366f1', badge: 'OAUTH' },
  lodgify: { label: 'Lodgify', color: '#f59e0b', badge: 'REST API' },
  manual: { label: 'Custom', color: '#64748b', badge: 'WEBHOOK' },
};

const TYPE_ICONS: Record<string, string> = {
  hotel: '🏨',
  guesthouse: '🏡',
  riad: '🕌',
  safari_camp: '⛺',
  experience: '🏄',
  vacation_rental: '🏢',
  other: '🏠',
};

export default function HospitalityPropertiesPanel() {
  const qc = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);

  const { data, isLoading } = useQuery('hospitality-properties', () => hospitalityService.getProperties());

  const testMutation = useMutation(
    (propertyId: string) => hospitalityService.testBooking(propertyId),
    {
      onSuccess: () => {
        alert('✅ Test booking event sent successfully!');
      },
      onError: () => {
        alert('Test booking failed — property may not be connected yet.');
      },
    }
  );

  const properties = data?.data?.properties || [];

  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 mb-6 animate-pulse">
        <div className="h-6 w-56 bg-surface-container-high rounded mb-2"></div>
        <div className="h-4 w-72 bg-surface-container-high rounded mb-6"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-28 bg-surface-container-high rounded-xl"></div>
          <div className="h-28 bg-surface-container-high rounded-xl"></div>
          <div className="h-28 bg-surface-container-high rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface tracking-tight flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-primary" />
              Hospitality Properties
            </h2>
            <p className="font-body text-xs text-on-surface-variant mt-1">
              PMS-connected properties with Pabandi escrow protection.
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg bg-primary text-on-primary hover:opacity-90 transition-opacity shadow-sm"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Connect Property
          </button>
        </div>

        {properties.length === 0 ? (
          <div className="rounded-xl p-8 text-center bg-surface border border-dashed border-outline-variant">
            <GlobeAltIcon className="h-10 w-10 mx-auto mb-3 text-outline" />
            <p className="font-headline text-sm font-bold mb-1 text-on-surface">No properties connected</p>
            <p className="font-body text-[11px] text-on-surface-variant mb-4">
              Connect your hotel or guesthouse PMS to start protecting bookings with escrow.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 font-body text-xs font-bold px-4 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary transition-colors"
            >
              <BoltIcon className="h-4 w-4" />
              Connect First Property
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((prop: any) => {
              const config = PROVIDER_CONFIG[prop.provider] || PROVIDER_CONFIG.manual;
              const typeIcon = TYPE_ICONS[prop.propertyType] || TYPE_ICONS.other;
              const isTesting = testMutation.isLoading && testMutation.variables === prop.id;

              return (
                <div
                  key={prop.id}
                  className="rounded-xl p-4 border bg-surface hover:bg-surface-container-low transition-colors"
                  style={{ borderColor: `${config.color}25` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{typeIcon}</span>
                      <div>
                        <p className="font-body text-sm font-bold text-on-surface leading-tight">{prop.propertyName}</p>
                        <p className="font-body text-[10px] text-on-surface-variant">{prop.country || 'Global'}</p>
                      </div>
                    </div>
                    <span
                      className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: `${config.color}15`, color: config.color, border: `1px solid ${config.color}30` }}
                    >
                      {config.badge}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center gap-1 font-label text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container">
                      <CheckCircleIcon className="h-3 w-3" />
                      {prop.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="font-label text-[9px] text-on-surface-variant capitalize">
                      {(prop.propertyType || 'other').replace('_', ' ')}
                    </span>
                  </div>

                  <button
                    onClick={() => testMutation.mutate(prop.id)}
                    disabled={isTesting}
                    className="w-full py-2 rounded-lg font-body text-[11px] font-bold border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <span className="animate-spin rounded-full h-3 w-3 border-2 border-current/30 border-t-current" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <BeakerIcon className="h-3.5 w-3.5" />
                        Test Booking
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Property Connect Wizard Modal */}
      {showWizard && (
        <PropertyConnectWizard
          onClose={() => {
            setShowWizard(false);
            qc.invalidateQueries('hospitality-properties');
          }}
        />
      )}
    </>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { hospitalityService } from '../services/api';
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  CheckIcon,
  PlusIcon,
  GlobeAltIcon,
  BoltIcon,
  ClockIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
import PropertyConnectWizard from './PropertyConnectWizard';


const TYPE_ICONS: Record<string, string> = {
  hotel: '🏨',
  guesthouse: '🏡',
  riad: '🕌',
  safari_camp: '⛺',
  experience: '🏄',
  vacation_rental: '🏢',
  other: '🏠',
};

type Reminder = {
  id: string;
  propertyName: string;
  guestName: string;
  time: string;
  sent: boolean;
};

export default function HospitalityPropertiesPanel() {
  const qc = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [verifying, setVerifying] = useState(false);

  const { data: propertiesData, isLoading: propertiesLoading } = useQuery(
    'hospitality-properties',
    () => hospitalityService.getProperties()
  );
  const { data: healthData, refetch: refetchHealth } = useQuery(
    'hospitality-health',
    () => hospitalityService.getHealth(),
  );

  const properties = propertiesData?.data?.properties || [];
  const health = healthData?.data || null;

  const markReminderSent = (id: string) =>
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, sent: true } : r)));

  const markCheckedIn = (id: string) =>
    setReminders((prev) => prev.filter((r) => r.id !== id));

  const upcomingCount = reminders.filter((r) => !r.sent).length;

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await refetchHealth();
    } finally {
      setVerifying(false);
    }
  };

  if (propertiesLoading) {
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
              Connect your Airbnb calendar so new bookings block this calendar automatically.
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
          <div className="rounded-xl border bg-surface overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/30">
              <div className="col-span-6 sm:col-span-5">Property</div>
              <div className="col-span-3 sm:col-span-3">Status</div>
              <div className="col-span-3 sm:col-span-4">Connection</div>
            </div>
            <div className="divide-y divide-outline-variant/20">
              {properties.map((prop: any) => {
                const typeIcon = TYPE_ICONS[prop.propertyType] || TYPE_ICONS.other;
                const connection = Boolean(health);
                const verified = Boolean(health);

                return (
                  <div key={prop.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
                    <div className="col-span-6 sm:col-span-5">
                      <p className="font-body text-sm font-bold text-on-surface leading-tight">{prop.propertyName}</p>
                      <p className="font-body text-[10px] text-on-surface-variant">{prop.country || 'Global'} · {typeIcon} {(prop.propertyType || 'other').replace('_', ' ')}</p>
                    </div>
                    <div className="col-span-3 sm:col-span-3">
                      <span className="inline-flex items-center gap-1 font-label text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container">
                        <CheckCircleIcon className="h-3 w-3" />
                        {prop.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="col-span-3 sm:col-span-4 flex items-center gap-2 justify-end">
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {connection ? (verified ? 'Verified' : 'Connected') : 'Not connected'}
                      </span>
                      {connection && verified && <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-headline text-sm font-bold text-on-surface flex items-center gap-2">
              <SignalIcon className="h-4 w-4 text-primary" />
              Connection Health
            </h3>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {health ? (
                <>
                  <span className="font-semibold">{health.totalProperties}</span> property{health.totalProperties === 1 ? '' : 'ies'} · <span className="font-semibold">{health.totalProperties > 0 ? 'PMS active' : 'waiting for connection'}</span>
                  <span className="ml-2 text-on-surface-variant">{new Date(health.lastSyncAt).toLocaleString()}</span>
                </>
              ) : (
                'No connection status yet.'
              )}
            </p>
          </div>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="rounded-xl text-[11px] font-bold px-3 py-2 border border-outline-variant/30 bg-white/5 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {verifying ? (
              <>
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current/30 border-t-current" />
                Verifying...
              </>
            ) : (
              <>
                <SignalIcon className="h-3.5 w-3.5" />
                Verify Connection
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-semibold text-on-surface-variant">
          <div className="rounded-lg bg-surface border border-outline-variant/20 px-3 py-2">Connected: {health?.hasConnections ? 'Yes' : 'No'}</div>
          <div className="rounded-lg bg-surface border border-outline-variant/20 px-3 py-2">Properties: {String(health?.totalProperties ?? 0)}</div>
          <div className="rounded-lg bg-surface border border-outline-variant/20 px-3 py-2">Tested: {String(health?.tested ?? false)}</div>
          <div className="rounded-lg bg-surface border border-outline-variant/20 px-3 py-2">Verified: {health?.verifiedAt ? new Date(health.verifiedAt).toLocaleString() : '—'}</div>
        </div>
      </div>

      {/* Availability & check-in reminders */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4 text-primary" />
              Upcoming Guest Flow
            </h3>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {upcomingCount > 0 ? `${upcomingCount} upcoming action${upcomingCount === 1 ? '' : 's'} requiring attention.` : 'No open actions right now.'}
            </p>
          </div>
          {upcomingCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <BellAlertIcon className="h-3.5 w-3.5" />
              Action needed
            </span>
          )}
        </div>

        {reminders.length === 0 ? (
          <div className="rounded-xl p-6 text-center bg-surface border border-dashed border-outline-variant">
            <ClockIcon className="h-8 w-8 mx-auto mb-2 text-outline" />
            <p className="font-headline text-sm font-bold text-on-surface">No upcoming reservations</p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Check-in reminders appear here after live webhook events and property connections.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-outline-variant/10"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <CalendarDaysIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-headline text-sm font-bold text-on-surface">{reminder.guestName}</p>
                    <p className="text-[11px] text-on-surface-variant">{reminder.propertyName}</p>
                    <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">{reminder.time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  {!reminder.sent ? (
                    <button
                      onClick={() => markReminderSent(reminder.id)}
                      className="inline-flex items-center gap-2 font-body text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      <BellAlertIcon className="h-3.5 w-3.5" />
                      Send reminder
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckIcon className="h-3.5 w-3.5" />
                      Reminder sent
                    </span>
                  )}

                  <button
                    onClick={() => markCheckedIn(reminder.id)}
                    className="inline-flex items-center gap-2 font-body text-[11px] font-bold px-3 py-2 rounded-lg bg-emerald-600/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/20 transition-colors"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Checked in
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

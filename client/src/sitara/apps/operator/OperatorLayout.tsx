// Sitara OS — Operator Layout
// Nav is driven by business type (see utils/operatorProfile) — a salon sees
// Appointments + Clients, a rental sees Units + Tenants, never mixed.
// Shell: sidebar on desktop, top bar + bottom tabs on mobile.
import { useEffect, useState } from 'react';
import { useSitaraStore } from '../../store/sitaraStore';
import { sitaraApi } from '../../api/sitaraApi';
import { profileForCategory, OperatorProfile } from '../../utils/operatorProfile';
import DashboardShell from '../../components/DashboardShell';

export default function OperatorLayout() {
  const { user } = useSitaraStore();
  const [profile, setProfile] = useState<OperatorProfile>(profileForCategory(null));

  useEffect(() => {
    let cancelled = false;
    sitaraApi
      .myBusiness()
      .then((biz) => {
        if (!cancelled && biz?.category) setProfile(profileForCategory(biz.category));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell
      title={profile.title}
      nav={profile.nav}
      footerTitle={user?.name || 'Operator'}
      footerSub={user?.email || ''}
      avatarLetter={user?.name.charAt(0).toUpperCase() || 'O'}
    />
  );
}

import React, { useState } from 'react';
import { Surface, Button, Badge, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';

interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface SecuritySetting {
  id: string;
  label: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  action?: string;
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'profile' | 'notifications' | 'security' | 'billing' | 'ai'>('profile');
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: '',
  });
  const [notifications, setNotifications] = useState<NotificationPreference[]>([
    { id: '1', label: 'Rent Reminders', description: 'Get notified before rent is due', enabled: true },
    { id: '2', label: 'Maintenance Updates', description: 'Status changes on maintenance requests', enabled: true },
    { id: '3', label: 'New Listings', description: 'Properties matching your criteria', enabled: false },
    { id: '4', label: 'Market Insights', description: 'Weekly market intelligence reports', enabled: true },
    { id: '5', label: 'AI Recommendations', description: 'Personalized property recommendations', enabled: true },
    { id: '6', label: 'Payment Confirmations', description: 'Receipts for rent payments', enabled: true },
  ]);
  const [security] = useState<SecuritySetting[]>([
    { id: '1', label: 'Two-Factor Authentication', description: 'Add an extra layer of security', status: 'inactive', action: 'Enable' },
    { id: '2', label: 'Email Verified', description: 'Your email is verified', status: 'active' },
    { id: '3', label: 'Wallet Connected', description: 'Phantom wallet linked', status: 'active' },
    { id: '4', label: 'Login Alerts', description: 'Get notified of new logins', status: 'active' },
  ]);
  const [saved, setSaved] = useState(false);

  const saveProfile = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleNotification = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n));
  };

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[var(--warm-ink)] font-headline">Settings</h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.textDim }}>Manage your account, notifications, and preferences</p>
          </div>
          {saved && <Badge tone="success">✓ Saved</Badge>}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['profile', 'notifications', 'security', 'billing', 'ai'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap ${tab === t ? 'bg-[var(--clay)]/20 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.2)]'}`}>
              {t === 'ai' ? '🤖 AI' : t}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <Surface className="p-4 md:p-6">
            <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">👤 Profile Information</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--soft-stone)] mb-1 block">First Name</label>
                  <input value={profile.firstName} onChange={e => setProfile({ ...profile, firstName: e.target.value })} className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
                </div>
                <div>
                  <label className="text-xs text-[var(--soft-stone)] mb-1 block">Last Name</label>
                  <input value={profile.lastName} onChange={e => setProfile({ ...profile, lastName: e.target.value })} className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--soft-stone)] mb-1 block">Email</label>
                <input value={profile.email} readOnly className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-lg px-3 py-2 text-sm text-[var(--soft-stone)] outline-none cursor-not-allowed" />
              </div>
              <div>
                <label className="text-xs text-[var(--soft-stone)] mb-1 block">Phone</label>
                <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 (555) 000-0000" className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              </div>
              <Button onClick={saveProfile} className="w-full">Save Changes</Button>
            </div>
          </Surface>
        )}

        {/* Notifications Tab */}
        {tab === 'notifications' && (
          <Surface className="p-4 md:p-6">
            <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">🔔 Notification Preferences</h3>
            <div className="space-y-3">
              {notifications.map(notif => (
                <div key={notif.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div>
                    <div className="font-semibold text-[var(--warm-ink)] text-sm">{notif.label}</div>
                    <div className="text-xs text-[var(--soft-stone)]">{notif.description}</div>
                  </div>
                  <button
                    onClick={() => toggleNotification(notif.id)}
                    className={`w-12 h-6 rounded-full transition-all ${notif.enabled ? 'bg-[var(--sage)]' : 'bg-[var(--warm-sand)]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-all ${notif.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {/* Security Tab */}
        {tab === 'security' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">🔒 Security Settings</h3>
              <div className="space-y-3">
                {security.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]">
                    <div>
                      <div className="font-semibold text-[var(--warm-ink)] text-sm">{item.label}</div>
                      <div className="text-xs text-[var(--soft-stone)]">{item.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={item.status === 'active' ? 'success' : item.status === 'pending' ? 'warning' : 'info'}>{item.status}</Badge>
                      {item.action && <Button size="sm">{item.action}</Button>}
                    </div>
                  </div>
                ))}
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">🔑 Change Password</h3>
              <div className="space-y-3">
                <input type="password" placeholder="Current password" className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
                <input type="password" placeholder="New password" className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
                <input type="password" placeholder="Confirm new password" className="w-full bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
                <Button className="w-full">Update Password</Button>
              </div>
            </Surface>
          </div>
        )}

        {/* Billing Tab */}
        {tab === 'billing' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">💳 Payment Methods</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">💳</div>
                    <div>
                      <div className="font-semibold text-[var(--warm-ink)] text-sm">•••• •••• •••• 4242</div>
                      <div className="text-xs text-[var(--soft-stone)]">Expires 12/27</div>
                    </div>
                  </div>
                  <Badge tone="success">Default</Badge>
                </div>
                <Button variant="ghost" className="w-full">+ Add Payment Method</Button>
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">📜 Billing History</h3>
              <div className="space-y-2">
                {[
                  { date: 'Sep 1, 2026', description: 'Rent - 123 Main St', amount: '$1,800', status: 'Paid' },
                  { date: 'Aug 1, 2026', description: 'Rent - 123 Main St', amount: '$1,800', status: 'Paid' },
                  { date: 'Jul 1, 2026', description: 'Rent - 123 Main St', amount: '$1,800', status: 'Paid' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--warm-sand)]">
                    <div>
                      <div className="text-sm text-[var(--warm-ink)]">{item.description}</div>
                      <div className="text-xs text-[var(--soft-stone)]">{item.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--warm-ink)]">{item.amount}</div>
                      <Badge tone="success">{item.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}

        {/* AI Tab */}
        {tab === 'ai' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">🤖 AI Preferences</h3>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div className="font-semibold text-[var(--warm-ink)] text-sm mb-1">AI Property Matching</div>
                  <div className="text-xs text-[var(--soft-stone)] mb-2">Let AI recommend properties based on your preferences and behavior</div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-6 rounded-full bg-[var(--sage)] cursor-pointer">
                      <div className="w-5 h-5 rounded-full bg-white shadow translate-x-6" />
                    </div>
                    <span className="text-xs text-[var(--sage)]">Enabled</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div className="font-semibold text-[var(--warm-ink)] text-sm mb-1">Market Intelligence</div>
                  <div className="text-xs text-[var(--soft-stone)] mb-2">Receive AI-powered market insights and predictions</div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-6 rounded-full bg-[var(--sage)] cursor-pointer">
                      <div className="w-5 h-5 rounded-full bg-white shadow translate-x-6" />
                    </div>
                    <span className="text-xs text-[var(--sage)]">Enabled</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)]">
                  <div className="font-semibold text-[var(--warm-ink)] text-sm mb-1">Predictive Maintenance</div>
                  <div className="text-xs text-[var(--soft-stone)] mb-2">Get maintenance predictions before issues occur</div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-6 rounded-full bg-[var(--warm-sand)] cursor-pointer">
                      <div className="w-5 h-5 rounded-full bg-white shadow translate-x-0.5" />
                    </div>
                    <span className="text-xs text-[var(--soft-stone)]">Disabled</span>
                  </div>
                </div>
              </div>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-[var(--warm-ink)] mb-4">📊 AI Usage</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center">
                  <div className="text-lg font-bold text-[var(--clay)]">12</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Valuations</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center">
                  <div className="text-lg font-bold text-[var(--sage)]">5</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Searches</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center">
                  <div className="text-lg font-bold text-[var(--muted-ochre)]">3</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>Reports</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--warm-sand)] text-center">
                  <div className="text-lg font-bold text-[var(--dusty-rose)]">8</div>
                  <div className="text-xs" style={{ color: tokens.color.textDim }}>AI Chats</div>
                </div>
              </div>
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;

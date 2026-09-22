import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Surface, Button, tokens } from '../design-system';
import { useSitaraStore } from '../sitara/store/sitaraStore';

type Tab = 'all' | 'bookings' | 'mudarabah' | 'promos' | 'system';

interface Notification {
  id: string;
  type: Tab;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  action?: { label: string; link: string };
  icon: string;
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: sitaraUser } = useSitaraStore();
  const [tab, setTab] = useState<Tab>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const notifs: Notification[] = [];

      if (sitaraUser?.starTier) {
        notifs.push({
          id: 'star-tier',
          type: 'system',
          title: 'Star Power Active',
          message: `You are currently at ${sitaraUser.starTier} tier with ${sitaraUser.starPower || 0} points. Keep verifying visits to level up!`,
          timestamp: new Date().toISOString(),
          read: false,
          action: { label: 'View Star Card', link: '/sitara/star-card' },
          icon: '⭐',
        });
      }

      notifs.push({
        id: 'booking-tip',
        type: 'bookings',
        title: 'Pro Tip: Check in on time',
        message: 'Guests who check in on time earn more Star Power and build trust with businesses.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: false,
        action: { label: 'My Bookings', link: '/sitara/my-bookings' },
        icon: '📅',
      });

      notifs.push({
        id: 'mudarabah-intro',
        type: 'mudarabah',
        title: 'New: Mudarabah Profit Sharing',
        message: 'Invest in real businesses and earn from real revenue — Sharia-compliant, transparent, no interest.',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        read: false,
        action: { label: 'Explore Pools', link: '/mudarabah' },
        icon: '💰',
      });

      notifs.push({
        id: 'promos-intro',
        type: 'promos',
        title: 'Refer & Earn PAB',
        message: 'Share Pabandi with businesses and customers. Earn signup bounties and commission on bookings.',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        read: true,
        action: { label: 'Become a Partner', link: '/refer' },
        icon: '🤝',
      });

      setNotifications(notifs);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [sitaraUser]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markAsRead = (id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const filteredNotifications = tab === 'all' ? notifications : notifications.filter((n) => n.type === tab);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '📬' },
    { id: 'bookings', label: 'Bookings', icon: '📅' },
    { id: 'mudarabah', label: 'Mudarabah', icon: '💰' },
    { id: 'promos', label: 'Promos', icon: '🤝' },
    { id: 'system', label: 'System', icon: '⚙️' },
  ];

  const timeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: 'var(--cream)', fontFamily: tokens.font.body }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Notifications</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--soft-stone)' }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                tab === t.id ? 'bg-[var(--clay)]/15 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'
              }`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--clay)] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-[var(--soft-stone)]">Loading...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Surface className="p-8 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-[var(--soft-stone)]">No notifications in this category.</p>
          </Surface>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((n) => (
              <Surface key={n.id} className={`p-4 transition-all ${!n.read ? 'border-l-4 border-[var(--clay)] bg-[var(--clay)]/5' : ''}`}
                onClick={() => { markAsRead(n.id); if (n.action) navigate(n.action.link); }}>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{n.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[var(--warm-ink)] text-sm">{n.title}</h3>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                    </div>
                    <p className="text-sm text-[var(--soft-stone)] mb-2">{n.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--soft-stone)]">{timeAgo(n.timestamp)}</span>
                      {n.action && (
                        <Button size="sm" variant="ghost" onClick={() => navigate(n.action!.link)}>
                          {n.action.label} →
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;

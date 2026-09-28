import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Surface, Button, tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';
import apiClient from '../services/api';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon, ClockIcon, CreditCardIcon, TicketIcon, EnvelopeOpenIcon, CheckIcon } from '@heroicons/react/24/outline';

type FilterTab = 'all' | 'unread';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  invoice_paid: <CheckCircleIcon className="w-5 h-5 text-[var(--sage)]" />,
  invoice_overdue: <ExclamationCircleIcon className="w-5 h-5 text-[var(--terracotta)]" />,
  trust_score_changed: <ArrowPathIcon className="w-5 h-5 text-[var(--clay)]" />,
  job_completed: <CheckCircleIcon className="w-5 h-5 text-[var(--sage)]" />,
  task_due: <ClockIcon className="w-5 h-5 text-[var(--terracotta)]" />,
  payment_claimed: <CreditCardIcon className="w-5 h-5 text-[var(--clay)]" />,
  support_reply: <TicketIcon className="w-5 h-5 text-[var(--muted-ochre)]" />,
};

const typeLabels: Record<string, string> = {
  invoice_paid: 'Invoice Paid',
  invoice_overdue: 'Invoice Overdue',
  trust_score_changed: 'Trust Score Changed',
  job_completed: 'Job Completed',
  task_due: 'Task Due',
  payment_claimed: 'Payment Claimed',
  support_reply: 'Support Reply',
};

function timeAgo(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<FilterTab>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/notifications?page=${page}&limit=20&filter=${tab}`);
      if (res.data.success) {
        setNotifications(res.data.data);
        setTotalPages(res.data.pagination.totalPages);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/notifications/unread-count');
      if (res.data.success) {
        setUnreadCount(res.data.count);
      }
    } catch (e) {
      console.error('Failed to load unread count:', e);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  const markAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/api/v1/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark as read', e);
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.post('/api/v1/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const filteredNotifications = tab === 'all' ? notifications : notifications.filter(n => !n.read);

  return (
    <div className="min-h-screen pb-24 md:pb-10" style={{ background: 'var(--cream)', fontFamily: tokens.font.body }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 clay-fade">
          <div>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Notifications</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--soft-stone)' }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllRead}>
            <CheckIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mark all read</span>
          </Button>}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 clay-fade clay-delay-1">
          {(['all', 'unread'] as FilterTab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                tab === t ? 'bg-[var(--clay)]/15 text-[var(--clay)] border border-[var(--clay)]/30' : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:bg-[var(--warm-sand)]'
              }`}>
              {t === 'all' ? <EnvelopeOpenIcon className="w-4 h-4" /> : <ExclamationCircleIcon className="w-4 h-4" />}
              {t === 'all' ? 'All' : 'Unread'}
              {tab === 'unread' && unreadCount > 0 && (
                <span className="w-5 h-5 min-w-5 rounded-full bg-[var(--terracotta)] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 clay-fade">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--clay)] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-[var(--soft-stone)]">Loading...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Surface className="p-8 text-center clay-fade clay-delay-1">
            <CheckCircleIcon className="w-16 h-16 text-[var(--sage)] mx-auto mb-4 opacity-50" />
            <p className="text-[var(--soft-stone)]">You're all caught up</p>
            <p className="text-xs text-[var(--soft-stone)]/70 mt-2">No {tab === 'unread' ? 'unread ' : ''}notifications</p>
          </Surface>
        ) : (
          <div className="space-y-3 clay-fade clay-delay-1">
            {filteredNotifications.map(n => (
              <Surface
                key={n.id}
                className={`p-4 transition-all ${!n.read ? 'border-l-4 border-[var(--clay)] bg-[var(--clay)]/5' : ''}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {typeIcons[n.type] || <EnvelopeOpenIcon className="w-5 h-5 text-[var(--soft-stone)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--soft-stone)]/70 px-2 py-0.5 rounded bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)]">
                          {typeLabels[n.type] || n.type}
                        </span>
                        <h3 className={`font-semibold text-sm ${!n.read ? 'text-[var(--warm-ink)]' : 'text-[var(--warm-ink)]/80'}`}>
                          {n.title}
                        </h3>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-[var(--clay)] flex-shrink-0" />}
                      </div>
                    </div>
                    {n.body && (
                      <p className="text-sm text-[var(--soft-stone)] mt-2 line-clamp-3">{n.body}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-[var(--soft-stone)]">{timeAgo(n.createdAt)}</span>
                      {n.actionUrl && (
                        <Button size="sm" variant="ghost" onClick={() => { navigate(n.actionUrl!); }}>
                          View →
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 clay-fade clay-delay-2">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="text-sm text-[var(--soft-stone)]">Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
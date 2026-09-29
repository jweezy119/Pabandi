import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { XMarkIcon, CheckCircleIcon, EnvelopeOpenIcon, ExclamationCircleIcon, CheckIcon, ClockIcon, ArrowPathIcon, CreditCardIcon, TicketIcon } from '@heroicons/react/24/outline';
import apiClient from '../services/api';
import { ClayDrawer } from './primitives/ClayDrawer';
import { Button } from './primitives/Button';
import toast from 'react-hot-toast';

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

function timeAgo(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications?limit=20');
      if (res.data.success) {
        setNotifications(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await apiClient.get('/notifications/unread-count');
      if (res.data.success) {
        setUnreadCount(res.data.count);
      }
    } catch (e) {
      console.error('Failed to fetch unread count', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await apiClient.patch(`/notifications/${notification.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        console.error('Failed to mark read', e);
      }
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
    setOpen(false);
  };

  const markAllRead = async () => {
    try {
      await apiClient.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error('Failed to mark all as read');
    }
  };

  const viewAll = () => {
    navigate('/notifications');
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-[var(--warm-sand)] transition-colors touch-target"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      >
        <BellIcon className="w-5 h-5 text-[var(--warm-ink)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 min-w-5 rounded-full bg-[var(--terracotta)] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <ClayDrawer isOpen={open} onClose={() => setOpen(false)} position="right" className="w-full md:w-96">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-[rgba(191,179,163,0.3)]">
            <h2 className="font-headline font-bold text-[var(--warm-ink)]">Notifications</h2>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead}>
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={viewAll}>
                <span className="hidden sm:inline">View all</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-[var(--soft-stone)]">
                <div className="animate-spin w-8 h-8 border-2 border-[var(--clay)] border-t-transparent rounded-full mx-auto mb-4" />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-16 h-16 text-[var(--sage)] mx-auto mb-4 opacity-50" />
                <p className="text-[var(--soft-stone)]">You're all caught up</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(191,179,163,0.2)]">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${
                      !n.read ? 'bg-[var(--clay)]/5' : ''
                    } hover:bg-[var(--warm-sand)]/30`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {typeIcons[n.type] || <EnvelopeOpenIcon className="w-5 h-5 text-[var(--soft-stone)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-semibold text-sm ${!n.read ? 'text-[var(--warm-ink)]' : 'text-[var(--warm-ink)]/80'}`}>
                          {n.title}
                        </h3>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-[var(--clay)] ml-2 flex-shrink-0" />}
                      </div>
                      {n.body && (
                        <p className="text-xs text-[var(--soft-stone)] mt-1 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-[var(--soft-stone)]/70 mt-2">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[rgba(191,179,163,0.3)]">
            <Button variant="outline" className="w-full" onClick={viewAll}>
              View all notifications
            </Button>
          </div>
        </div>
      </ClayDrawer>
    </>
  );
}

export default NotificationBell;
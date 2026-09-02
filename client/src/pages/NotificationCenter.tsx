import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Surface, Button, tokens } from '../design-system';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  time: string;
  read: boolean;
  link?: string;
  icon: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  link?: string;
}

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Simulate notifications
    setNotifications([
      { id: '1', type: 'success', message: 'Escrow #esc-123 funded — $250 locked', time: '2 min ago', read: false, link: '/escrow', icon: '🔒' },
      { id: '2', type: 'info', message: 'New tenant application from Sarah M.', time: '1 hour ago', read: false, link: '/applications', icon: '📋' },
      { id: '3', type: 'success', message: 'Earned +15 PAB for completing a sale', time: '2 hours ago', read: true, link: '/token', icon: '💰' },
      { id: '4', type: 'warning', message: 'Background check completed for John D. — MEDIUM risk', time: '3 hours ago', read: true, link: '/background-check', icon: '🔍' },
      { id: '5', type: 'info', message: 'Maintenance request "Kitchen leak" assigned to Carlos R.', time: '5 hours ago', read: true, link: '/maintenance', icon: '🔧' },
    ]);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const onboardingSteps: OnboardingStep[] = [
    { id: '1', title: 'Complete Your Profile', description: 'Add your name, photo, and verification', icon: '👤', completed: false, link: '/settings' },
    { id: '2', title: 'Connect Wallet', description: 'Link your Phantom or Solflare wallet', icon: '👻', completed: false, link: '/wallet' },
    { id: '3', title: 'Verify Identity', description: 'KYC for trust score and PAB earnings', icon: '🪪', completed: false, link: '/passport' },
    { id: '4', title: 'List or Find a Property', description: 'Post a listing or browse marketplace', icon: '🏠', completed: false, link: '/marketplace' },
    { id: '5', title: 'Earn Your First PAB', description: 'Complete an action to earn PAB tokens', icon: '💰', completed: false, link: '/token' },
    { id: '6', title: 'Explore AI Tools', description: 'Try property valuation or lease analysis', icon: '🤖', completed: false, link: '/ai/analyze' },
  ];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-100 font-headline">Notifications</h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button onClick={markAllRead} size="sm" variant="ghost">
                Mark all read
              </Button>
            )}
            <Button onClick={() => setShowOnboarding(!showOnboarding)} size="sm">
              {showOnboarding ? 'Hide' : 'Show'} Onboarding
            </Button>
          </div>
        </div>

        {/* Onboarding Wizard */}
        {showOnboarding && (
          <Surface className="p-4 md:p-6 mb-6">
            <h3 className="text-base font-bold text-slate-100 mb-4">🚀 Getting Started</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {onboardingSteps.map((step) => (
                <div
                  key={step.id}
                  onClick={() => step.link && navigate(step.link)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    step.completed
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{step.icon}</span>
                    <span className="text-sm font-semibold text-slate-100">{step.title}</span>
                    {step.completed && <span className="text-emerald-400">✓</span>}
                  </div>
                  <p className="text-xs" style={{ color: tokens.color.muted }}>{step.description}</p>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {/* Notifications List */}
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                markAsRead(notif.id);
                notif.link && navigate(notif.link);
              }}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                notif.read
                  ? 'bg-white/5 border-white/10'
                  : 'bg-indigo-500/10 border-indigo-500/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl">{notif.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-300">{notif.message}</div>
                  <div className="text-xs mt-1" style={{ color: tokens.color.muted }}>{notif.time}</div>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                )}
              </div>
            </div>
          ))}
        </div>

        {notifications.length === 0 && (
          <Surface className="p-8 text-center">
            <div className="text-3xl mb-2">🔔</div>
            <p className="text-slate-400">No notifications yet</p>
          </Surface>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;

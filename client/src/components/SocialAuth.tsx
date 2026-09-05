import React, { useState } from 'react';

const SOCIAL_LOGINS = [
  { id: 'github', name: 'GitHub', icon: '🐙', color: 'bg-gray-800 hover:bg-gray-700', url: '/api/v1/auth/social/github' },
  { id: 'twitter', name: 'Twitter/X', icon: '🐦', color: 'bg-sky-600 hover:bg-sky-500', url: '/api/v1/auth/social/twitter' },
];

const SHARE_CHANNELS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: 'bg-green-600 hover:bg-green-500' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'bg-blue-600 hover:bg-blue-500' },
  { id: 'twitter', name: 'Twitter/X', icon: '🐦', color: 'bg-sky-600 hover:bg-sky-500' },
  { id: 'email', name: 'Email', icon: '📧', color: 'bg-gray-600 hover:bg-gray-500' },
];

export const SocialLoginButtons: React.FC = () => {
  const handleSocialLogin = (url: string) => {
    window.location.href = url;
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-400 text-center">Or continue with</p>
      <div className="flex gap-3">
        {SOCIAL_LOGINS.map((login) => (
          <button
            key={login.id}
            onClick={() => handleSocialLogin(login.url)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition-all ${login.color}`}
          >
            <span>{login.icon}</span>
            <span>{login.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const ShareButtons: React.FC<{ venue: any }> = ({ venue }) => {
  const [copied, setCopied] = useState(false);

  const shareVenue = (channel: string) => {
    const link = `${window.location.origin}/booking/${venue.id}`;
    const text = `Check out ${venue.name}! Book a table with me:`;

    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
      email: `mailto:?subject=${encodeURIComponent(venue.name)}&body=${encodeURIComponent(text + ' ' + link)}`,
    };

    if (channel === 'copy') {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      window.open(urls[channel], '_blank');
    }
  };

  return (
    <div className="flex gap-2">
      {SHARE_CHANNELS.map((channel) => (
        <button
          key={channel.id}
          onClick={() => shareVenue(channel.id)}
          className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-all ${channel.color}`}
        >
          {channel.icon}
        </button>
      ))}
      <button
        onClick={() => shareVenue('copy')}
        className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-all ${copied ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'}`}
      >
        {copied ? '✓' : '🔗'}
      </button>
    </div>
  );
};

export default { SocialLoginButtons, ShareButtons };

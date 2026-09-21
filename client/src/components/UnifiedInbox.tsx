import React, { useState, useEffect, useCallback } from 'react';

type Channel = 'WHATSAPP' | 'TELEGRAM' | 'SMS';

interface ChannelMessage {
  id: string;
  businessId: string;
  customerId: string;
  channel: Channel;
  direction: 'INCOMING' | 'OUTGOING';
  content: string;
  status: string;
  externalId?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  createdAt: string;
}

interface UnifiedInboxProps {
  businessId: string;
}

const CHANNEL_COLORS: Record<Channel, string> = {
  WHATSAPP: 'bg-green-100 text-green-800',
  TELEGRAM: 'bg-blue-100 text-blue-800',
  SMS: 'bg-yellow-100 text-yellow-800',
};

const STATUS_ICONS: Record<string, string> = {
  PENDING: '⏳',
  SENT: '✓',
  DELIVERED: '✓✓',
  FAILED: '❌',
};

export const UnifiedInbox: React.FC<UnifiedInboxProps> = ({ businessId }) => {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [filterChannel, setFilterChannel] = useState<Channel | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterChannel !== 'ALL') params.set('channel', filterChannel);
      const res = await fetch(`/api/v1/channels/${businessId}/messages?${params}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    } finally {
      setLoading(false);
    }
  }, [businessId, filterChannel]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const sendReply = async (message: ChannelMessage) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await fetch('/api/v1/channels/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          customerId: message.customerId,
          message: replyText,
          channels: [message.channel],
        }),
      });
      setReplyText('');
      setReplyingTo(null);
      fetchMessages();
    } catch (e) {
      console.error('Failed to send reply:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with filters */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-bold">📥 Unified Inbox</h2>
        <div className="flex gap-2">
          {(['ALL', 'WHATSAPP', 'TELEGRAM', 'SMS'] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setFilterChannel(ch)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filterChannel === ch
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {ch === 'ALL' ? 'All' : ch}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div className="divide-y max-h-[600px] overflow-y-auto">
        {loading && <div className="p-4 text-center text-gray-500">Loading...</div>}
        {!loading && messages.length === 0 && (
          <div className="p-8 text-center text-gray-400">No messages yet</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_COLORS[msg.channel]}`}>
                  {msg.channel}
                </span>
                <span className={`text-xs ${msg.direction === 'INCOMING' ? 'text-blue-600' : 'text-gray-500'}`}>
                  {msg.direction === 'INCOMING' ? '← In' : '→ Out'}
                </span>
                <span className="text-xs text-gray-500">{STATUS_ICONS[msg.status] || msg.status}</span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(msg.createdAt).toLocaleString('en-PK', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-800">{msg.content}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">To: {msg.customerId}</span>
              {msg.direction === 'INCOMING' && (
                <button
                  onClick={() => setReplyingTo(msg.id)}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Reply
                </button>
              )}
            </div>

            {/* Reply box */}
            {replyingTo === msg.id && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type reply..."
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && sendReply(msg)}
                />
                <button
                  onClick={() => sendReply(msg)}
                  disabled={sending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sending ? '...' : 'Send'}
                </button>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UnifiedInbox;

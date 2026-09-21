import React, { useState } from 'react';

interface TelegramSetupProps {
  businessId: string;
  onSetup?: (data: { botUsername: string; isActive: boolean }) => void;
}

export const TelegramSetup: React.FC<TelegramSetupProps> = ({ businessId, onSetup }) => {
  const [botToken, setBotToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<{ isActive: boolean; username?: string } | null>(null);

  const testConnection = async () => {
    if (!botToken) {
      setError('Please enter a bot token');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, botToken }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`✅ Connected to @${data.data.botUsername}`);
        setBotStatus({ isActive: true, username: data.data.botUsername });
        onSetup?.(data.data);
      } else {
        setError(data.error || 'Failed to connect');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  const disableBot = async () => {
    setLoading(true);
    try {
      await fetch(`/api/v1/telegram/${businessId}`, { method: 'DELETE' });
      setBotStatus({ isActive: false });
      setSuccess('Bot disabled');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/v1/telegram/${businessId}/status`);
      const data = await res.json();
      if (data.success) {
        setBotStatus(data.data);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-md">
      <h2 className="text-xl font-bold mb-4">🤖 Telegram Bot Setup</h2>
      <p className="text-sm text-gray-600 mb-4">
        Create a bot via @BotFather on Telegram and paste the token below.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Bot Token</label>
          <input
            type="text"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
        {success && <div className="text-green-600 text-sm bg-green-50 p-2 rounded">{success}</div>}

        <div className="flex gap-2">
          <button
            onClick={testConnection}
            disabled={testing}
            className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test & Connect'}
          </button>
          <button
            onClick={checkStatus}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Status
          </button>
        </div>

        {botStatus && (
          <div className="bg-gray-50 p-3 rounded text-sm">
            <p>Status: <span className={botStatus.isActive ? 'text-green-600' : 'text-red-600'}>
              {botStatus.isActive ? '✅ Active' : '❌ Inactive'}
            </span></p>
            {botStatus.username && <p>Username: @{botStatus.username}</p>}
          </div>
        )}

        {botStatus?.isActive && (
          <button
            onClick={disableBot}
            disabled={loading}
            className="w-full bg-red-100 text-red-700 py-2 rounded-md hover:bg-red-200"
          >
            Disable Bot
          </button>
        )}
      </div>

      <div className="mt-6 text-xs text-gray-500">
        <p className="font-semibold mb-1">Bot Commands:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>/start - Welcome message</li>
          <li>/menu - Show business menu</li>
          <li>/book - Book a table</li>
          <li>/pay - Make payment</li>
          <li>/status - Check status</li>
          <li>/help - Show help</li>
        </ul>
      </div>
    </div>
  );
};

export default TelegramSetup;

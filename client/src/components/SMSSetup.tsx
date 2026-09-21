import React, { useState } from 'react';

interface SMSSetupProps {
  businessId: string;
  onSetup?: (data: { provider: string; from: string }) => void;
}

export const SMSSetup: React.FC<SMSSetupProps> = ({ businessId, onSetup }) => {
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioFrom, setTwilioFrom] = useState('');
  const [vonageKey, setVonageKey] = useState('');
  const [vonageSecret, setVonageSecret] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const testSMS = async () => {
    if (!testNumber) {
      setError('Please enter a test phone number (+92 format)');
      return;
    }
    setSendingTest(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testNumber,
          message: 'Test SMS from Pabandi! آپ کا پیغام موصول ہوا!',
          businessId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`✅ SMS sent via ${data.data.provider}! Cost: PKR ${data.data.cost?.toFixed(2)}`);
        onSetup?.({ provider: data.data.provider, from: twilioFrom });
      } else {
        setError(data.error || 'Failed to send SMS');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSendingTest(false);
    }
  };

  const saveCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      // Store credentials via env-based config endpoint (simplified)
      const res = await fetch('/api/v1/sms/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twilioSid, twilioToken, twilioFrom,
          vonageKey, vonageSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('✅ Credentials saved');
      } else {
        setError(data.error || 'Failed to save credentials');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-lg">
      <h2 className="text-xl font-bold mb-4">📱 SMS Setup</h2>
      <p className="text-sm text-gray-600 mb-4">
        Configure Twilio (primary) and Vonage (fallback) for SMS messaging.
      </p>

      <div className="space-y-4">
        {/* Twilio Section */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3 text-blue-700">Twilio (Primary)</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={twilioSid}
              onChange={(e) => setTwilioSid(e.target.value)}
              placeholder="Account SID"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <input
              type="password"
              value={twilioToken}
              onChange={(e) => setTwilioToken(e.target.value)}
              placeholder="Auth Token"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <input
              type="text"
              value={twilioFrom}
              onChange={(e) => setTwilioFrom(e.target.value)}
              placeholder="From Number (e.g. +1234567890)"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        {/* Vonage Section */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-sm mb-3 text-gray-700">Vonage (Optional Fallback)</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={vonageKey}
              onChange={(e) => setVonageKey(e.target.value)}
              placeholder="Vonage API Key"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <input
              type="password"
              value={vonageSecret}
              onChange={(e) => setVonageSecret(e.target.value)}
              placeholder="Vonage API Secret"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        {/* Test SMS */}
        <div className="border rounded-lg p-4 bg-green-50">
          <h3 className="font-semibold text-sm mb-3 text-green-700">Test SMS</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="+923001234567"
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
            <button
              onClick={testSMS}
              disabled={sendingTest}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {sendingTest ? 'Sending...' : 'Send Test'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Phone numbers must be in +92 format</p>
        </div>

        {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
        {success && <div className="text-green-600 text-sm bg-green-50 p-2 rounded">{success}</div>}

        <button
          onClick={saveCredentials}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Credentials'}
        </button>
      </div>
    </div>
  );
};

export default SMSSetup;

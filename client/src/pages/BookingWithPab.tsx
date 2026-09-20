import React, { useState } from 'react';

interface AgentReward {
  id: string;
  agentId: string;
  taskType: string;
  taskValue: number;
  rewardPab: number;
  status: string;
  createdAt: string;
}

export const BookingWithPab: React.FC = () => {
  const [bookingId, setBookingId] = useState('');
  const [bookingValue, setBookingValue] = useState('');
  const [agentId, setAgentId] = useState('');
  const [taskType, setTaskType] = useState('');
  const [taskValue, setTaskValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'bookings' | 'rewards'>('bookings');

  const apiCall = async (url: string, method: string, body?: any) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const createBooking = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await apiCall('/api/v1/booking-pab/create', 'POST', {
        bookingId,
        bookingValue: parseFloat(bookingValue),
      });
      if (result.success) {
        setMessage(`Booking created! Deposit: ${result.depositAmount.toFixed(2)} PAB`);
        setBookingId('');
        setBookingValue('');
      } else {
        setMessage(result.error || 'Failed to create booking');
      }
    } catch {
      setMessage('Network error');
    }
    setLoading(false);
  };

  const checkin = async (id: string) => {
    setLoading(true);
    const result = await apiCall('/api/v1/booking-pab/checkin', 'POST', { bookingId: id });
    if (result.success) {
      setMessage(`Check-in complete! Received ${result.totalReturned.toFixed(2)} PAB (deposit + reward)`);
    } else {
      setMessage(result.error || 'Check-in failed');
    }
    setLoading(false);
  };

  const cancel = async (id: string) => {
    setLoading(true);
    const result = await apiCall('/api/v1/booking-pab/cancel', 'POST', { bookingId: id });
    if (result.success) {
      setMessage(`Cancelled! Refunded ${result.refunded.toFixed(2)} PAB`);
    } else {
      setMessage(result.error || 'Cancellation failed');
    }
    setLoading(false);
  };

  const distributeReward = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await apiCall('/api/v1/agent-rewards/distribute', 'POST', {
        agentId,
        taskType,
        taskValue: parseFloat(taskValue),
      });
      if (result.success) {
        setMessage(`Reward distributed! ${result.rewardAmount.toFixed(2)} PAB sent to agent`);
        setAgentId('');
        setTaskType('');
        setTaskValue('');
      } else {
        setMessage(result.error || 'Distribution failed');
      }
    } catch {
      setMessage('Network error');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-white mb-6">PAB Utility Dashboard</h2>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-blue-900/50 border border-blue-500 text-blue-200">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'bookings' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          Bookings
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'rewards' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          Agent Rewards
        </button>
      </div>

      {activeTab === 'bookings' && (
        <div>
          {/* Create Booking */}
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Create Booking with PAB</h3>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Booking ID</label>
                <input
                  type="text"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  className="w-full mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  placeholder="e.g., booking_abc123"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Booking Value (USD)</label>
                <input
                  type="number"
                  value={bookingValue}
                  onChange={(e) => setBookingValue(e.target.value)}
                  className="w-full mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  placeholder="100"
                />
                {bookingValue && (
                  <div className="mt-2 text-sm">
                    <span className="text-yellow-400">PAB Deposit (10%): {(parseFloat(bookingValue) * 0.1).toFixed(2)} PAB</span>
                    <span className="ml-4 text-green-400">Reward on check-in (1%): {(parseFloat(bookingValue) * 0.01).toFixed(2)} PAB</span>
                  </div>
                )}
              </div>
              <button
                onClick={createBooking}
                disabled={loading || !bookingId || !bookingValue}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-white font-bold"
              >
                {loading ? 'Processing...' : 'Create Booking'}
              </button>
            </div>
          </div>

          {/* Booking Policies */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-3">Policies</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>✅ <strong>Check-in:</strong> Deposit returned + 1% reward</li>
              <li>❌ <strong>No-show:</strong> 50% to business, 50% burned</li>
              <li>🔄 <strong>Cancel before 24h:</strong> Full deposit refund</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'rewards' && (
        <div>
          {/* Distribute Reward */}
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Distribute Agent Reward</h3>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Agent ID</label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  placeholder="agent_xxx"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Task Type</label>
                <input
                  type="text"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  placeholder="e.g., data_labeling, content_creation"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Task Value (USD)</label>
                <input
                  type="number"
                  value={taskValue}
                  onChange={(e) => setTaskValue(e.target.value)}
                  className="w-full mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  placeholder="50"
                />
                {taskValue && (
                  <div className="mt-2 text-sm text-green-400">
                    PAB Reward (2%): {(parseFloat(taskValue) * 0.02).toFixed(2)} PAB
                  </div>
                )}
              </div>
              <button
                onClick={distributeReward}
                disabled={loading || !agentId || !taskType || !taskValue}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-white font-bold"
              >
                {loading ? 'Processing...' : 'Distribute Reward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingWithPab;

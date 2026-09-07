import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Surface } from '../../design-system';

export const CheckInsPage: React.FC = () => {
  const navigate = useNavigate();
  const [error] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Check-Ins</h2>
          <p className="text-sm text-white/60">Manage QR codes and active check-ins</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/booking')}>
          Back to Discover
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Surface className="p-4 text-center">
          <p className="text-2xl font-bold text-white">0</p>
          <p className="text-xs text-white/60">Active Now</p>
        </Surface>
        <Surface className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">0</p>
          <p className="text-xs text-white/60">Today's Total</p>
        </Surface>
        <Surface className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">0</p>
          <p className="text-xs text-white/60">Pending</p>
        </Surface>
        <Surface className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">0 min</p>
          <p className="text-xs text-white/60">Avg Duration</p>
        </Surface>
      </div>

      <Surface className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/checkin')}
            className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[24px] text-indigo-400 mb-2">qr_code_scanner</span>
            <p className="text-sm font-semibold text-white">Scan QR to Check In</p>
            <p className="text-xs text-white/60">Open scanner for customers</p>
          </button>
          <button
            onClick={() => alert('Manual check-in: Enter reservation ID or code')}
            className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[24px] text-green-400 mb-2">person_add</span>
            <p className="text-sm font-semibold text-white">Manual Check-In</p>
            <p className="text-xs text-white/60">Enter code manually</p>
          </button>
          <button
            onClick={() => alert('Enable location services for auto check-in')}
            className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[24px] text-blue-400 mb-2">location_on</span>
            <p className="text-sm font-semibold text-white">Location Check-In</p>
            <p className="text-xs text-white/60">Auto-detect when nearby</p>
          </button>
        </div>
      </Surface>

      <Surface className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">How Check-In Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-indigo-400">1</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Customer Books</p>
              <p className="text-xs text-white/60">Reservation confirmed with unique code</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-green-400">2</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Check In</p>
              <p className="text-xs text-white/60">Scan QR or verify location</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-blue-400">3</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Check Out</p>
              <p className="text-xs text-white/60">Auto-release table when done</p>
            </div>
          </div>
        </div>
      </Surface>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
};

export default CheckInsPage;

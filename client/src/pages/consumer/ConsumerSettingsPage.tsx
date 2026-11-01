import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function ConsumerSettingsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);

  return (
    <div className="min-h-screen bg-amber-50 text-amber-900 font-sans">
      <div className="px-4 py-4 bg-amber-50">
        <button
          onClick={() => navigate('/app')}
          className="w-10 h-10 rounded-lg bg-white border border-amber-200 flex items-center justify-center text-amber-500 font-bold shadow-sm"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-amber-900 mt-2">Settings</h1>
      </div>

      <div className="px-4">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
            <h3 className="font-bold text-amber-900 text-sm mb-4">Account</h3>
            <div className="flex items-center justify-between py-4 border-b border-amber-100">
              <div>
                <p className="font-medium text-amber-900 text-sm">{user?.firstName || 'Consumer'}</p>
                <p className="text-xs text-amber-600">{user?.email}</p>
              </div>
              <span className="w-3 h-3 rounded-full bg-green-700"></span>
            </div>
            <div className="flex items-center justify-between py-4 border-b border-amber-100">
              <div>
                <p className="font-medium text-amber-900 text-sm">Wallet Address</p>
                <p className="text-xs text-amber-600 truncate max-w-xs ml-2 mt-1">
                  {user?.walletAddress || 'Not connected'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
            <h3 className="font-bold text-amber-900 text-sm mb-4">Preferences</h3>
            <div className="flex items-center justify-between py-4 border-b border-amber-100">
              <div>
                <p className="font-medium text-amber-900 text-sm">Push Notifications</p>
                <p className="text-xs text-amber-600">Get notified about escrow updates</p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className="relative w-14 h-7 rounded-full bg-amber-200"
              >
                <span className="sr-only">Notifications toggle</span>
              </button>
            </div>
            <div className="flex items-center justify-between py-4 border-t border-amber-100">
              <div>
                <p className="font-medium text-amber-900 text-sm">Biometric Login</p>
                <p className="text-xs text-amber-600">Unlock with Face ID or fingerprint</p>
              </div>
              <button
                onClick={() => setBiometric(!biometric)}
                className="relative w-14 h-7 rounded-full bg-amber-200"
              >
                <span className="sr-only">Biometric toggle</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
            <h3 className="font-bold text-amber-900 text-sm mb-4">Support</h3>
            <div className="space-y-2">
              <button onClick={() => navigate('/app/passport')} className="w-full text-left py-3 text-sm font-medium text-amber-500">
                View My Trust Passport
              </button>
              <button className="w-full text-left py-3 text-sm font-medium text-amber-600">
                Help Center
              </button>
              <button className="w-full text-left py-3 text-sm font-medium text-amber-600">
                Terms of Service
              </button>
              <button className="w-full text-left py-3 text-sm font-medium text-amber-600">
                Privacy Policy
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('token');
              navigate('/');
            }}
            className="w-full py-4 rounded-xl bg-red-100 text-red-600 font-bold shadow-sm hover:bg-red-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="pb-24" />
    </div>
  );
}

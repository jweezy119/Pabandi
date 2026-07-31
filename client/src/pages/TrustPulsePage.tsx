import { TrustPulse } from '../components/TrustPulse';
import { useAuthStore } from '../store/authStore';

export const TrustPulsePage = () => {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Live Trust Pulse</h1>
          <p className="text-xs text-zinc-500">Real-time trust score, tier, and 30-day velocity.</p>
        </div>

        {user?.id ? (
          <TrustPulse userId={user.id} />
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-[#121212] p-4 text-xs text-zinc-400">
            Sign in to see your Live Trust Pulse.
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-[#121212] p-4 text-xs text-zinc-500">
          Pulse updates every 30s. Score changes from escrow, disputes, and social signals are reflected automatically.
        </div>
      </div>
    </div>
  );
};

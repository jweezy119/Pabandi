import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, CheckCircle, ExternalLink, Award } from 'lucide-react';

export default function TrustPassportPage() {
  const { passportId } = useParams();
  const [passport, setPassport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/trust/passport/${passportId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setPassport(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [passportId]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!passport) return <div className="p-8 text-center">Passport not found</div>;

  return (
    <div className="min-h-screen bg-[var(--cream)] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-[rgba(191,179,163,0.3)] overflow-hidden">
          <div className="bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)] p-8 text-[var(--warm-ink)]">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                <Shield className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{passport.displayName}</h1>
                <p className="opacity-90">@{passport.handle}</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Trust Scores</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-[var(--warm-sand)]/20 rounded-xl text-center">
                  <div className="text-2xl font-bold text-[var(--clay)]">{passport.scores?.payment || 500}</div>
                  <div className="text-sm text-[var(--soft-stone)]">Payment</div>
                </div>
                <div className="p-4 bg-[var(--warm-sand)]/20 rounded-xl text-center">
                  <div className="text-2xl font-bold text-[var(--clay)]">{passport.scores?.showUp || 500}</div>
                  <div className="text-sm text-[var(--soft-stone)]">Show Up</div>
                </div>
                <div className="p-4 bg-[var(--warm-sand)]/20 rounded-xl text-center">
                  <div className="text-2xl font-bold text-[var(--clay)]">{passport.scores?.delivery || 500}</div>
                  <div className="text-sm text-[var(--soft-stone)]">Delivery</div>
                </div>
              </div>
            </div>

            {(passport.onchainAgentId || passport.onchainIdentityRegistered) && (
              <div>
                <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4 flex items-center gap-2">
                  <Award className="w-6 h-6 text-[var(--clay)]" />
                  Onchain Identity (ERC-8004)
                </h2>
                <div className="p-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-bold text-green-700">Verified ERC-8004 Agent</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-semibold text-[var(--warm-ink)]">Agent ID: </span>
                      <code className="text-sm bg-white px-2 py-1 rounded">{passport.onchainAgentId}</code>
                    </div>
                    <a
                      href={`https://etherscan.io/address/${passport.onchainAgentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[var(--clay)] hover:underline"
                    >
                      View on Etherscan <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-xs text-[var(--soft-stone)] mt-3">
                    This agent's identity is portable and trusted across the broader AI agent ecosystem via ERC-8004.
                  </p>
                </div>
              </div>
            )}

            {passport.badges && passport.badges.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-4">Badges</h2>
                <div className="flex flex-wrap gap-2">
                  {passport.badges.map((badge: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-[var(--clay)]/10 text-[var(--clay)] rounded-full text-sm font-semibold">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

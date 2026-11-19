import React, { useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface ConciergeProposal {
  proposedBusinessId: string;
  businessName: string;
  businessSlug: string | null;
  category: string;
  city: string;
  reservationDate: string | null;
  reservationTime: string | null;
  numberOfGuests: number | null;
  depositAmount: number;
  currency: string;
  escrowEnabled: boolean;
  trustBand: string;
  rating: number;
  reviewCount: number;
  matchScore: number;
  reasons: string[];
}

interface ConciergeResponse {
  message: string;
  intent: string;
  language: string;
  proposal: ConciergeProposal | null;
  alternatives: Array<{
    proposedBusinessId: string;
    businessName: string;
    matchScore: number;
    trustBand: string;
  }>;
  provider: string | null;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  proposal?: ConciergeProposal;
  alternatives?: ConciergeResponse['alternatives'];
}

const SUGGESTIONS = [
  'Find a romantic Italian place for 2 on Friday at 7pm',
  'Book a table for 4 this weekend',
  'I want sushi near downtown tonight',
  'Show me a highly-rated spa for a massage',
  'Need a barber for a haircut tomorrow morning',
];

export default function GlobalAIConciergeWidget() {
  const { isAuthenticated, wallet } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const userMsg = trimmed;
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setQuery('');
    setShowSuggestions(false);
    setLoading(true);

    try {
      const response = await api.post('/ai/concierge', {
        query: userMsg,
        walletAddress: wallet?.address || undefined,
      });

      const data: ConciergeResponse = response.data.data || response.data;

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: data.message,
          proposal: data.proposal ?? undefined,
          alternatives: data.alternatives,
        },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to get response from AI Concierge.';
      toast.error(msg);
      console.error('[Concierge]', err);
    } finally {
      setLoading(false);
    }
  }, [query, wallet?.address]);

  if (!isAuthenticated) return null;

  const handleBook = (proposal: ConciergeProposal) => {
    if (!proposal?.proposedBusinessId) {
      toast.error("No valid business to book.");
      return;
    }
    const params = new URLSearchParams();
    if (proposal.reservationDate) params.set('date', proposal.reservationDate);
    if (proposal.reservationTime) params.set('time', proposal.reservationTime);
    if (proposal.numberOfGuests) params.set('guests', String(proposal.numberOfGuests));
    params.set('concierge', 'true');
    navigate(`/booking/${proposal.proposedBusinessId}?${params.toString()}`);
    setIsOpen(false);
  };

  const handleSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] md:bottom-6 right-4 md:right-6 z-50">
      {isOpen ? (
        <div className="bg-[var(--surface)] shadow-2xl rounded-2xl w-[calc(100vw-2rem)] sm:w-80 md:w-96 flex flex-col h-[500px] max-h-[calc(100vh-120px)] border border-[var(--soft-stone)]/10 overflow-hidden">
          <div className="bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)] p-4 flex justify-between items-center">
            <h3 className="text-[var(--cream)] font-bold flex items-center gap-2">
              <span className="text-xl">✨</span> Pabandi Concierge
            </h3>
            <div className="flex items-center gap-3">
              {wallet?.address && (
                <div className="flex items-center gap-1 bg-[var(--cream)]/20 px-2 py-1 rounded-md text-[10px] font-bold text-[var(--terracotta)] uppercase tracking-wider">
                  <span>◎</span> Wallet Connected
                </div>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--cream)]/80 hover:text-[var(--cream)] transition-colors"
                aria-label="Close concierge"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-[var(--background)] flex flex-col gap-3">
            {messages.length === 0 && showSuggestions && (
              <div className="text-center text-[var(--muted)] mt-10 space-y-3">
                <p className="text-4xl">👋</p>
                <p className="text-[var(--text-primary)] font-medium">Hi! I'm your Pabandi Concierge.</p>
                <p className="text-sm text-[var(--muted)]">
                  Tell me what you're looking for — a restaurant, salon, spa, or any service —
                  and I'll find trusted businesses with escrow-protected booking.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(s)}
                      className="text-xs px-3 py-1.5 rounded-full border border-[var(--soft-stone)]/20 bg-[var(--surface)] text-[var(--text-primary)] hover:border-[var(--clay)] hover:bg-[var(--clay)]/10 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {wallet?.address && (
                  <p className="text-xs mt-3 text-[var(--clay)] bg-[var(--clay)]/10 px-3 py-2 rounded-lg font-medium border border-[var(--clay)]/20">
                    Your Solana wallet is connected. Bookings use on-chain escrow + trust passport.
                  </p>
                )}
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)] text-[var(--cream)] rounded-br-none'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--soft-stone)]/10 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.proposal && (
                  <div className="mt-2 p-3 bg-[var(--surface)] border border-[var(--clay)]/20 rounded-lg w-full max-w-[85%] shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-[var(--clay)]">PROPOSED RESERVATION</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--clay)]/10 text-[var(--clay)] font-medium">
                        {msg.proposal.trustBand}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{msg.proposal.businessName}</p>
                    <p className="text-xs text-[var(--muted)]">{msg.proposal.category} • {msg.proposal.city}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-[var(--muted)]">
                      {msg.proposal.reservationDate && (
                        <span>📅 {msg.proposal.reservationDate}</span>
                      )}
                      {msg.proposal.reservationTime && (
                        <span>🕐 {msg.proposal.reservationTime}</span>
                      )}
                      {msg.proposal.numberOfGuests && (
                        <span>👥 {msg.proposal.numberOfGuests} guests</span>
                      )}
                      {msg.proposal.escrowEnabled && (
                        <span className="flex items-center gap-1 text-[var(--sage)]">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Escrow
                        </span>
                      )}
                    </div>
                    {Boolean(msg.proposal.reasons?.length) && (
                      <p className="mt-2 text-xs text-[var(--clay)] font-medium">{msg.proposal.reasons.join(' • ')}</p>
                    )}
                    <button
                      onClick={() => handleBook(msg.proposal!)}
                      className="mt-3 w-full bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)] text-[var(--cream)] text-xs font-bold py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Book Now
                    </button>
                  </div>
                )}

                {Boolean(msg.alternatives?.length) && (
                  <div className="mt-2 p-3 bg-[var(--surface)] border border-[var(--soft-stone)]/10 rounded-lg w-full max-w-[85%]">
                    <p className="text-xs font-medium text-[var(--muted)] mb-2">Other great options</p>
                    <div className="space-y-1.5">
                      {msg.alternatives.slice(0, 3).map((alt, i) => (
                        <button
                          key={`${alt.proposedBusinessId}-${i}`}
                          onClick={() => {
                            const proposal: ConciergeProposal = {
                              proposedBusinessId: alt.proposedBusinessId,
                              businessName: alt.businessName,
                              businessSlug: null,
                              category: '',
                              city: '',
                              reservationDate: null,
                              reservationTime: null,
                              numberOfGuests: null,
                              depositAmount: 0,
                              currency: 'USD',
                              escrowEnabled: false,
                              trustBand: alt.trustBand,
                              rating: 0,
                              reviewCount: 0,
                              matchScore: alt.matchScore,
                              reasons: [],
                            };
                            handleBook(proposal);
                          }}
                          className="w-full text-left p-2 rounded border border-[var(--soft-stone)]/10 hover:border-[var(--clay)]/30 hover:bg-[var(--clay)]/5 transition-all text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[var(--text-primary)]">{alt.businessName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--clay)]/10 text-[var(--clay)]">{alt.trustBand}</span>
                          </div>
                          <p className="text-[11px] text-[var(--muted)] mt-0.5">Match: {Math.round(alt.matchScore * 100)}%</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-[var(--surface)] px-4 py-2 rounded-2xl rounded-bl-none border border-[var(--soft-stone)]/10">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-[var(--clay)] rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-[var(--clay)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-[var(--clay)] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--soft-stone)]/10 bg-[var(--surface)] flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E.g., Find a romantic Italian place for 2 on Friday at 7pm..."
              className="flex-1 px-3 py-2 border border-[var(--soft-stone)]/10 rounded-full text-sm bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--clay)] focus:border-transparent"
              disabled={loading}
              aria-label="Ask the concierge"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)] text-[var(--cream)] rounded-full w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-[var(--clay)] to-[var(--terracotta)] text-[var(--cream)] rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:scale-105 transition-all duration-200"
          aria-label="Open Pabandi Concierge"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}
    </div>
  );
}
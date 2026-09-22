import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const CATEGORIES = ['All', 'Clubs', 'Bars', 'Lounges', 'Events', 'Pop-Ups', 'Raves'];
export const NightlifePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'discover' | 'tickets' | 'reservations' | 'guestlist'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [events, setEvents] = useState<any[]>([]);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      setEvents([]);
      setMyTickets([]);
    } catch (e) {
      console.error('Failed to load events:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Header */}
      <header className="bg-[var(--warm-sand)] border-b border-[rgba(191,179,163,0.3)] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-8 h-8 rounded bg-gradient-to-br from-[var(--dusty-rose)] to-pink-500 flex items-center justify-center text-[var(--warm-ink)] font-bold text-sm">N</div>
              <span className="text-xl font-bold text-[var(--warm-ink)]">Nightmark</span>
              <span className="text-xs text-[var(--soft-stone)] ml-1">by Pabandi</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setActiveTab('discover')} className={`text-sm font-medium ${activeTab === 'discover' ? 'text-[var(--dusty-rose)]' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)]'}`}>Discover</button>
              <button onClick={() => setActiveTab('tickets')} className={`text-sm font-medium ${activeTab === 'tickets' ? 'text-[var(--dusty-rose)]' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)]'}`}>Tickets</button>
              <button onClick={() => setActiveTab('reservations')} className={`text-sm font-medium ${activeTab === 'reservations' ? 'text-[var(--dusty-rose)]' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)]'}`}>Tables</button>
              <button onClick={() => setActiveTab('guestlist')} className={`text-sm font-medium ${activeTab === 'guestlist' ? 'text-[var(--dusty-rose)]' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)]'}`}>Guest List</button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-sm text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">← Pabandi</button>
            {isAuthenticated ? (
              <div className="w-8 h-8 rounded-full bg-[var(--dusty-rose)]/20 flex items-center justify-center text-[var(--dusty-rose)] text-sm font-bold">
                {user?.firstName?.[0] || '?'}
              </div>
            ) : (
              <button onClick={() => navigate('/login')} className="px-4 py-2 bg-[var(--dusty-rose)] text-[var(--warm-ink)] text-sm font-medium rounded hover:bg-[var(--dusty-rose)]">
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Search */}
      {activeTab === 'discover' && (
        <div className="bg-gradient-to-b from-purple-900/30 to-[#0a0a0a] py-12">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-[var(--warm-ink)] mb-2">Tonight & Beyond</h1>
            <p className="text-[var(--soft-stone)] mb-8">Discover events, book tables, skip the line</p>
            
            <div className="bg-[#1a1a1a] rounded-lg p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--soft-stone)]">🔍</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Events, venues, artists..."
                  className="w-full pl-10 pr-4 py-3 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded text-[var(--warm-ink)] placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--soft-stone)]">📅</span>
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-3 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.3)] rounded text-[var(--warm-ink)] focus:outline-none focus:border-purple-500"
                />
              </div>
              <button className="px-8 py-3 bg-[var(--dusty-rose)] text-[var(--warm-ink)] font-medium rounded hover:bg-[var(--dusty-rose)] transition-colors">
                Search
              </button>
            </div>

            {/* Categories */}
            <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-[var(--dusty-rose)] text-[var(--warm-ink)]'
                      : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] border border-[rgba(191,179,163,0.3)] hover:border-purple-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'discover' && (
          <div className="space-y-8">
            {/* Featured Events */}
            <section>
              <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-4">This Week</h2>
              {loading ? (
                <div className="text-center py-12 text-[var(--soft-stone)]">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-[rgba(191,179,163,0.3)]">
                  <div className="text-5xl mb-4">🎵</div>
                  <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-2">No events yet</h3>
                  <p className="text-[var(--soft-stone)]">Be the first to list an event!</p>
                  <button className="mt-4 px-6 py-2 bg-[var(--dusty-rose)] text-[var(--warm-ink)] rounded hover:bg-[var(--dusty-rose)]">
                    List Event
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <EventCard key={event.id} event={event}  />
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming Tables */}
            <section>
              <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-4">VIP Tables Available</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[rgba(191,179,163,0.3)] text-center">
                  <p className="text-[var(--soft-stone)]">No tables listed yet</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--warm-ink)]">Your Tickets</h2>
            {myTickets.length === 0 ? (
              <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-[rgba(191,179,163,0.3)]">
                <div className="text-5xl mb-4">🎫</div>
                <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-2">No tickets yet</h3>
                <p className="text-[var(--soft-stone)]">Your purchased tickets will appear here.</p>
              </div>
            ) : (
              myTickets.map((ticket) => (
                <div key={ticket.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-[rgba(191,179,163,0.3)]">
                  {ticket.eventName} · {ticket.date}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reservations' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--warm-ink)]">Table Reservations</h2>
            <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-[rgba(191,179,163,0.3)]">
              <div className="text-5xl mb-4">🍾</div>
              <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-2">No reservations</h3>
              <p className="text-[var(--soft-stone)]">Reserve a VIP table for you and your crew.</p>
            </div>
          </div>
        )}

        {activeTab === 'guestlist' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--warm-ink)]">Guest List</h2>
            <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-[rgba(191,179,163,0.3)]">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-[var(--warm-ink)] mb-2">No guest list entries</h3>
              <p className="text-[var(--soft-stone)]">Sign up for guest lists to skip the line.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Event Card
// ────────────────────────────────────────────────────────────────────────────
const EventCard: React.FC<{ event: any }> = ({ event }) => {
  const [isSaved, setIsSaved] = useState(false);

  return (
    <div className="bg-[#1a1a1a] rounded-lg overflow-hidden border border-[rgba(191,179,163,0.3)] hover:border-purple-500/50 transition-all cursor-pointer group">
      {/* Image */}
      <div className="relative h-48 bg-[var(--warm-sand)]">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--soft-stone)]">
            <span className="text-4xl">🎵</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
        {/* Save button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsSaved(!isSaved); }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[var(--cream)]/50 flex items-center justify-center hover:bg-[var(--cream)]/70 transition-colors"
        >
          {isSaved ? '💜' : '🤍'}
        </button>
        {/* Date badge */}
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-[var(--dusty-rose)] text-xs font-medium text-[var(--warm-ink)]">
          {event.date || 'TBA'}
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <h3 className="font-bold text-[var(--warm-ink)] group-hover:text-[var(--dusty-rose)] transition-colors mb-1">{event.name}</h3>
        <p className="text-sm text-[var(--soft-stone)] mb-2">{event.venue} · {event.neighborhood}</p>
        <p className="text-sm text-[var(--soft-stone)] mb-3">{event.genres?.join(', ')}</p>
        
        {/* Lineup */}
        {event.lineup && (
          <p className="text-xs text-[var(--soft-stone)] mb-3">
            {event.lineup.map((a: any) => a.name).join(' · ')}
          </p>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-[var(--warm-ink)]">
            {event.price ? `$${event.price}` : 'Free'}
          </span>
          <button className="px-4 py-1.5 bg-[var(--dusty-rose)] text-[var(--warm-ink)] text-sm font-medium rounded hover:bg-[var(--dusty-rose)] transition-colors">
            Get Tickets
          </button>
        </div>
      </div>
    </div>
  );
};

export default NightlifePage;

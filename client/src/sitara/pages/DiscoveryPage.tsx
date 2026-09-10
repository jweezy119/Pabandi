// Sitara OS — Discovery Page
// Map-powered local discovery for guests.
// Loads real platform businesses; falls back to curated mocks offline.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sitaraApi } from '../api/sitaraApi';

const categories = [
  { id: 'restaurant', label: 'Restaurants', icon: '🍽️' },
  { id: 'salon', label: 'Salons', icon: '💇' },
  { id: 'spa', label: 'Spas', icon: '🧖' },
  { id: 'nightlife', label: 'Nightlife', icon: '🍸' },
  { id: 'apartment', label: 'Apartments', icon: '🏢' },
  { id: 'hotel', label: 'Hotels', icon: '🏨' },
];

const mockBusinesses = [
  { id: '1', name: 'The Golden Fork', category: 'restaurant', rating: 4.8, stars: 124, image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400', price: '$$' },
  { id: '2', name: 'Bella Salon', category: 'salon', rating: 4.9, stars: 89, image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400', price: '$$' },
  { id: '3', name: 'Serenity Spa', category: 'spa', rating: 4.7, stars: 56, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400', price: '$$$' },
  { id: '4', name: 'Skyline Lounge', category: 'nightlife', rating: 4.6, stars: 203, image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400', price: '$$$' },
  { id: '5', name: 'CozyNest Rentals', category: 'apartment', rating: 4.5, stars: 42, image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', price: '$$' },
  { id: '6', name: 'Grand Hotel', category: 'hotel', rating: 4.8, stars: 312, image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400', price: '$$$$' },
];

interface BizCard {
  id: string;
  name: string;
  category: string;
  rating: number;
  stars: number;
  image: string;
  price: string;
  real: boolean;
}

const FALLBACK_CARDS: BizCard[] = mockBusinesses.map((b) => ({ ...b, real: false }));

export default function DiscoveryPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cards, setCards] = useState<BizCard[]>(FALLBACK_CARDS);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user's location for real geo-discovery
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          loadRealBusinesses(loc);
        },
        () => {
          // Fallback: use default mock data
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
    }
  }, []);

  async function loadRealBusinesses(loc: { lat: number; lng: number; category?: string }) {
    try {
      const data = await sitaraApi.discover({
        lat: loc.lat,
        lng: loc.lng,
        radius: 2000,
        limit: 12,
        category: loc.category || selectedCategory || undefined,
      });

      if (Array.isArray(data) && data.length > 0) {
        setCards(
          data.map((b: any) => ({
            id: String(b.id),
            name: b.name || 'Unnamed venue',
            category: String(b.category || 'restaurant').toLowerCase(),
            rating: Number(b.rating ?? 4.5),
            stars: Number(b.reviewCount ?? 0),
            image: b.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400',
            price: b.price || '$$',
            real: true,
          }))
        );
      }
    } catch (err) {
      console.warn('Real discovery failed, using fallback:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredBusinesses = selectedCategory
    ? cards.filter((b) => b.category === selectedCategory)
    : cards;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Discover trusted local businesses
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Real geo-located venues ready to book — restaurants, salons, spas, nightlife, and rentals.
          All protected by Sitara's escrow and star power system.
        </p>
        {userLocation && (
          <p className="text-sm text-emerald-600 mt-2">
            📍 Showing venues near your location
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        <button
          onClick={() => {
            setSelectedCategory(null);
            if (userLocation) loadRealBusinesses(userLocation);
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !selectedCategory
              ? 'bg-amber-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              if (userLocation) loadRealBusinesses({ ...userLocation, category: cat.id });
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-amber-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Business Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent" />
            <p className="mt-2 text-slate-500">Discovering venues near you...</p>
          </div>
        ) : (
          filteredBusinesses.map((business) => (
            <Link
              key={business.id}
              to={`/sitara/book/${business.id}`}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="h-48 bg-slate-200">
                <img
                  src={business.image}
                  alt={business.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">{business.name}</h3>
                  <span className="text-sm text-slate-500">{business.price}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-amber-500">★</span>
                  <span>{business.rating}</span>
                  <span>·</span>
                  <span>{business.stars} stars</span>
                  {business.real && (
                    <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      ✓ Live
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// Sitara OS — Discovery Page
// Map-powered local discovery for guests

import { useState } from 'react';
import { Link } from 'react-router-dom';

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

export default function DiscoveryPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredBusinesses = selectedCategory
    ? mockBusinesses.filter((b) => b.category === selectedCategory)
    : mockBusinesses;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Discover trusted local businesses
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Book restaurants, salons, spas, nightlife, and rentals — all protected by Sitara's escrow and star power system.
        </p>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        <button
          onClick={() => setSelectedCategory(null)}
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
            onClick={() => setSelectedCategory(cat.id)}
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
        {filteredBusinesses.map((business) => (
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
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

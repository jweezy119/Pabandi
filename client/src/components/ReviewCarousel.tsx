import { useState, useEffect } from 'react';
import { StarIcon, UserCircleIcon } from '@heroicons/react/24/solid';

interface Review {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  time: string;
  sentimentLabel?: string;
}

export default function ReviewCarousel({ reviews }: { reviews: Review[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [reviews.length]);

  if (!reviews || reviews.length === 0) {
    return (
      <div className="w-full text-center py-8 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <p className="text-sm italic" style={{ color: '#5a7490' }}>No Google Reviews available yet.</p>
      </div>
    );
  }

  const review = reviews[currentIndex];
  const sentimentColor =
    review.sentimentLabel === 'positive' ? { bg: 'rgba(16,185,129,0.12)', text: '#34d399' } :
    review.sentimentLabel === 'negative' ? { bg: 'rgba(239,68,68,0.12)', text: '#f87171' } :
    { bg: 'rgba(255,255,255,0.06)', text: '#7a90a8' };

  return (
    <div className="relative w-full rounded-2xl p-5 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* Reviewer */}
      <div className="flex items-center gap-3 mb-4">
        <UserCircleIcon className="h-10 w-10 flex-shrink-0" style={{ color: '#3d5068' }} />
        <div>
          <h4 className="text-sm font-bold" style={{ color: '#e8edf3' }}>{review.authorName}</h4>
          <div className="flex items-center gap-1 mt-0.5">
            {[...Array(5)].map((_, i) => (
              <StarIcon
                key={i}
                className="h-3.5 w-3.5"
                style={{ color: i < review.rating ? '#fbbf24' : 'rgba(255,255,255,0.1)' }}
              />
            ))}
            <span className="ml-1 text-xs" style={{ color: '#5a7490' }}>
              {new Date(review.time).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Review text */}
      <p className="text-sm leading-relaxed line-clamp-4 italic" style={{ color: '#a0b4c8' }}>
        "{review.text}"
      </p>

      {/* Sentiment badge */}
      {review.sentimentLabel && (
        <div className="mt-4 flex justify-end">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: sentimentColor.bg, color: sentimentColor.text }}>
            AI: {review.sentimentLabel}
          </span>
        </div>
      )}

      {/* Dot indicators */}
      {reviews.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {reviews.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: idx === currentIndex ? '1.5rem' : '0.375rem',
                background: idx === currentIndex ? '#60a5fa' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

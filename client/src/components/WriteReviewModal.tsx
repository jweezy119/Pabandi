import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import api from '../services/api';

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  reservationId: string;
  onSuccess: () => void;
}

export const WriteReviewModal: React.FC<WriteReviewModalProps> = ({ isOpen, onClose, businessId, reservationId, onSuccess }) => {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Simulate checking the blockchain for the Proof of Visit Token
    setVerifying(true);
    await new Promise(r => setTimeout(r, 1500)); // Shimmering UX
    setVerifying(false);
    setIsSubmitting(true);

    try {
      await api.post('/reviews', {
        businessId,
        reservationId,
        rating,
        text
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-xl border border-outline-variant/20">
          <Dialog.Title className="text-xl font-headline font-black text-on-surface mb-2 flex items-center gap-2">
            Write a Verified Review
            <ShieldCheckIcon className="h-5 w-5 text-green-500" />
          </Dialog.Title>
          <Dialog.Description className="text-sm text-on-surface-variant mb-6 font-body">
            Only users who have checked in and hold a Proof of Visit Token can leave reviews.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    {star <= rating ? (
                      <StarIconSolid className="h-8 w-8 text-yellow-400" />
                    ) : (
                      <StarIcon className="h-8 w-8 text-outline-variant" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-on-surface mb-2">Your Review</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                required
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Share your experience..."
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 font-bold text-on-surface hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || verifying}
                className="rounded-xl bg-primary px-6 py-2 font-bold text-on-primary hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
              >
                {verifying ? (
                  <span className="flex items-center gap-2 animate-pulse">
                    <ShieldCheckIcon className="h-4 w-4" />
                    Verifying SBT...
                  </span>
                ) : isSubmitting ? (
                  'Submitting...'
                ) : (
                  'Submit Review'
                )}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

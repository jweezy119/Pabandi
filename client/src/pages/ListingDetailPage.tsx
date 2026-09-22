import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { marketplaceService, escrowService } from '../services/api';

export const ListingDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBookForm, setShowBookForm] = useState(false);
  const [bookForm, setBookForm] = useState({ buyerEmail: '', buyerName: '', scheduledAt: '', notes: '' });
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (id) {
      marketplaceService.getListing(id).then(res => {
        setListing(res.data?.data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id]);

  const handleBook = async () => {
    if (!listing) return;
    setBooking(true);
    try {
      await marketplaceService.bookListing(listing.id, {
        buyerEmail: bookForm.buyerEmail,
        buyerName: bookForm.buyerName,
        scheduledAt: bookForm.scheduledAt,
        notes: bookForm.notes,
      });
      setShowBookForm(false);
      alert('Booking confirmed! The seller will be notified.');
    } catch (e) {
      alert('Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const handleOpenEscrow = async () => {
    if (!listing) return;
    try {
      const res = await escrowService.create({
        itemTitle: listing.title,
        amount: listing.price,
        sellerEmail: listing.sellerEmail,
        buyerEmail: bookForm.buyerEmail,
      });
      const escrowId = res.data?.data?.id;
      if (escrowId) {
        navigate(`/escrow/${escrowId}`);
      }
    } catch (e) {
      alert('Failed to open escrow');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--soft-stone)]">Loading...</div>;
  if (!listing) return <div className="min-h-screen flex items-center justify-center text-[var(--soft-stone)]">Listing not found</div>;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-sm text-[var(--soft-stone)] hover:text-[var(--warm-ink)] mb-4">← Back</button>

        <Surface className="p-4 md:p-6">
          {listing.imageUrls?.[0] && (
            <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-48 md:h-64 object-cover rounded-xl mb-4" />
          )}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[var(--warm-ink)]">{listing.title}</h1>
              <p className="text-sm text-[var(--soft-stone)] mt-1">{listing.city}{listing.state ? `, ${listing.state}` : ''}</p>
            </div>
            <Badge tone="success">{listing.status}</Badge>
          </div>

          <div className="text-3xl font-black text-[var(--sage)] mb-4">${listing.price} <span className="text-sm font-normal text-[var(--soft-stone)]">{listing.currency}</span></div>

          <div className="flex gap-2 mb-4">
            <Badge tone="info">{listing.condition}</Badge>
            <Badge tone="info">{listing.category}</Badge>
            <Badge tone="info">{listing.type}</Badge>
          </div>

          {listing.description && <p className="text-sm text-[var(--warm-ink)] mb-4">{listing.description}</p>}

          <div className="border-t border-[var(--soft-stone)]/30 pt-4 mb-4">
            <h3 className="text-sm font-bold text-[var(--warm-ink)] mb-2">Seller</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--clay)]/20 flex items-center justify-center text-lg">👤</div>
              <div>
                <div className="font-semibold text-[var(--warm-ink)] text-sm">{listing.sellerName || listing.sellerEmail}</div>
                <div className="text-xs text-[var(--soft-stone)]">Trust Score: {listing.seller?.trustScore || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowBookForm(!showBookForm)} className="flex-1">Book Viewing</Button>
            <Button onClick={handleOpenEscrow} variant="ghost">Open Escrow</Button>
          </div>

          {showBookForm && (
            <div className="mt-4 p-3 rounded-xl bg-[var(--cream)] space-y-3">
              <input value={bookForm.buyerEmail} onChange={e => setBookForm({ ...bookForm, buyerEmail: e.target.value })} placeholder="Your email *" type="email" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <input value={bookForm.buyerName} onChange={e => setBookForm({ ...bookForm, buyerName: e.target.value })} placeholder="Your name" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <input value={bookForm.scheduledAt} onChange={e => setBookForm({ ...bookForm, scheduledAt: e.target.value })} type="datetime-local" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" />
              <textarea value={bookForm.notes} onChange={e => setBookForm({ ...bookForm, notes: e.target.value })} placeholder="Notes" className="w-full bg-[var(--cream)] border border-[var(--soft-stone)]/30 rounded-lg px-3 py-2 text-sm text-[var(--warm-ink)] outline-none" rows={2} />
              <Button onClick={handleBook} disabled={booking} className="w-full">{booking ? 'Booking...' : 'Confirm Booking'}</Button>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
};

export default ListingDetailPage;

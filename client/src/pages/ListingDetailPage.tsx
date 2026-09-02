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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  if (!listing) return <div className="min-h-screen flex items-center justify-center text-slate-400">Listing not found</div>;

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white mb-4">← Back</button>

        <Surface className="p-4 md:p-6">
          {listing.imageUrls?.[0] && (
            <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-48 md:h-64 object-cover rounded-xl mb-4" />
          )}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-100">{listing.title}</h1>
              <p className="text-sm text-slate-400 mt-1">{listing.city}{listing.state ? `, ${listing.state}` : ''}</p>
            </div>
            <Badge tone="success">{listing.status}</Badge>
          </div>

          <div className="text-3xl font-black text-emerald-300 mb-4">${listing.price} <span className="text-sm font-normal text-slate-400">{listing.currency}</span></div>

          <div className="flex gap-2 mb-4">
            <Badge tone="info">{listing.condition}</Badge>
            <Badge tone="info">{listing.category}</Badge>
            <Badge tone="info">{listing.type}</Badge>
          </div>

          {listing.description && <p className="text-sm text-slate-300 mb-4">{listing.description}</p>}

          <div className="border-t border-white/10 pt-4 mb-4">
            <h3 className="text-sm font-bold text-slate-100 mb-2">Seller</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-lg">👤</div>
              <div>
                <div className="font-semibold text-slate-100 text-sm">{listing.sellerName || listing.sellerEmail}</div>
                <div className="text-xs text-slate-400">Trust Score: {listing.seller?.trustScore || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowBookForm(!showBookForm)} className="flex-1">Book Viewing</Button>
            <Button onClick={handleOpenEscrow} variant="ghost">Open Escrow</Button>
          </div>

          {showBookForm && (
            <div className="mt-4 p-3 rounded-xl bg-white/5 space-y-3">
              <input value={bookForm.buyerEmail} onChange={e => setBookForm({ ...bookForm, buyerEmail: e.target.value })} placeholder="Your email *" type="email" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
              <input value={bookForm.buyerName} onChange={e => setBookForm({ ...bookForm, buyerName: e.target.value })} placeholder="Your name" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
              <input value={bookForm.scheduledAt} onChange={e => setBookForm({ ...bookForm, scheduledAt: e.target.value })} type="datetime-local" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
              <textarea value={bookForm.notes} onChange={e => setBookForm({ ...bookForm, notes: e.target.value })} placeholder="Notes" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" rows={2} />
              <Button onClick={handleBook} disabled={booking} className="w-full">{booking ? 'Booking...' : 'Confirm Booking'}</Button>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
};

export default ListingDetailPage;

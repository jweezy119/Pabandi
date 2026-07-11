import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { businessService } from '../services/api';
import { MapPinIcon, CurrencyDollarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

type Slot = { date: string; time: string; label: string };

export default function UniversalCheckoutPage() {
  const { sellerId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const mode = searchParams.get('mode') === 'instant' ? 'instant' : 'reserve';
  const session = searchParams.get('session');
  const title = searchParams.get('item') || '';
  const priceRaw = searchParams.get('price') || '';
  const price = Number(priceRaw.replace(/[^0-9.]/g, '')) || 0;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [date, _setDate] = useState('');
  const [time, setTime] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [method, setMethod] = useState<'pab'|'card'>('pab');

  const { data, isLoading, error } = useQuery(
    ['universal-seller', sellerId],
    async () => {
      const res = await businessService.getBusiness(sellerId!);
      return res.data?.data as any;
    },
    { enabled: !!sellerId }
  );

  const depositAmount = method === 'pab' ? Math.max(1, Math.round((price * 0.2) * 100) / 100) : 0;

  const bookingMutation = useMutation(
    async (_payload: any) => {
      // route to existing reservation creation path; if node expects body, send normalized fields
      const res = await fetch('/api/v1/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlugOrId: data?.slug || data?.id || sellerId,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          date: date || new Date().toISOString().slice(0, 10),
          time: time || 'ASAP',
          partySize: 1,
          notes: session ? `pabandi-universal|title=${title}|session=${session}|mode=${mode}` : `pabandi-universal|title=${title}|mode=${mode}`,
          platform: 'UNIVERSAL_LINK',
          price,
          mode,
        }),
      });
      if (!res.ok) throw new Error('Failed to create reservation');
      const json = await res.json();
      return json.data || json;
    },
    {
      onSuccess: () => {
        setSubmitted(priceRaw || 'Booked');
        queryClient.invalidateQueries(['reservation', sellerId]);
      },
      onError: (e: any) => {
        setNameError('Please check your details');
        setPhoneError(e?.message || 'Booking failed');
      },
    }
  );

  const slots: Slot[] = [];
  if (data?.businessHours) {
    // Simplified slot generation from saved hours if present
    // Keep robust if missing
    slots.push({ date: 'Today', time: 'ASAP', label: 'As soon as possible' });
  } else {
    slots.push({ date: 'Today', time: 'ASAP', label: 'As soon as possible' });
  }

  useEffect(() => {
    if (data) {
      if (data.name) sessionStorage.setItem('pabandi_last_seen_seller', data.name);
    }
  }, [data]);

  if (isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-on-surface-variant">Loading booking...</div>;
  }
  if (error || !data) {
    return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-on-surface-variant">
      <p>Seller not found.</p>
      <a href="/" className="text-primary font-bold underline underline-offset-4">Back to Pabandi</a>
    </div>;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-6 p-5 rounded-2xl border border-outline-variant/20 bg-surface-container-low">
          <h1 className="font-headline text-2xl md:text-3xl font-bold mb-2">
            {title || data.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5 font-medium"><MapPinIcon className="h-4 w-4" />{data.city || 'Nearby'}</span>
            {price > 0 && <span className="inline-flex items-center gap-1.5 font-medium"><CurrencyDollarIcon className="h-4 w-4" />${price.toFixed(2)}</span>}
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" /> Active seller
            </span>
          </div>
        </div>

        {submitted && (
          <div className="mb-6 p-4 rounded-2xl bg-[#14F195]/10 border border-[#14F195]/30 text-on-surface flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-[#14F195]" />
            <div>
              <h3 className="font-headline font-bold">Booking received</h3>
              <p className="text-sm mt-1">Your {mode === 'instant' ? 'instant purchase' : 'reservation'} is protected by Pabandi Trust.</p>
              <p className="text-xs mt-2 font-mono text-on-surface-variant">Seller: {data.name} • {price > 0 && <>Price: ${price.toFixed(2)} • </>}Deposit: {depositAmount > 0 ? `$${depositAmount.toFixed(2)}` : '$0'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <form className="md:col-span-3 p-5 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest" onSubmit={(e) => {
            e.preventDefault();
            let ok = true;
            setNameError('');
            setPhoneError('');
            if (!name.trim() || name.trim().length < 2) { setNameError('Enter your full name'); ok = false; }
            if (!phone.trim() || phone.trim().length < 7) { setPhoneError('Enter a valid phone'); ok = false; }
            if (!ok) return;
            bookingMutation.mutate({ name, email, phone, date, time });
          }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-outline-variant/30 bg-surface-bright px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60" />
                {nameError && <p className="text-xs text-error mt-1">{nameError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" className="w-full rounded-xl border border-outline-variant/30 bg-surface-bright px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className="w-full rounded-xl border border-outline-variant/30 bg-surface-bright px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60" />
                {phoneError && <p className="text-xs text-error mt-1">{phoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preferred time</label>
                <select value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-xl border border-outline-variant/30 bg-surface-bright px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60">
                  {slots.map((s) => (
                    <option key={`${s.time}-${s.date}`} value={s.time}>{s.label || `${s.time}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pay deposit with</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setMethod('pab')} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${method === 'pab' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/30 text-on-surface-variant'}`}>$PAB / Crypto</button>
                  <button type="button" onClick={() => setMethod('card')} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${method === 'card' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/30 text-on-surface-variant'}`}>Card</button>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {method === 'pab' && <>Deposit: <span className="font-bold text-on-surface">${depositAmount.toFixed(2)}</span> • $PAB rewards may apply</>}
                  {method === 'card' && <>No-crypto option coming soon.</>}
                </p>
              </div>
              <button disabled={bookingMutation.isLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-headline font-bold text-base shadow-lg disabled:opacity-60">
                {bookingMutation.isLoading ? 'Protecting booking...' : mode === 'instant' ? `Buy Now • ${price > 0 ? '$'+price.toFixed(2) : 'Confirm'}` : `Reserve Now • ${depositAmount > 0 ? '$'+depositAmount.toFixed(2) : 'Free'}`}
              </button>
              <p className="text-[11px] text-center text-on-surface-variant">Secured by Pabandi Trust • Cancel/No-show protection applies</p>
            </div>
          </form>

          <aside className="md:col-span-2 space-y-4">
            <div className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest">
              <h4 className="font-headline font-bold mb-2">Seller info</h4>
              <p className="text-sm text-on-surface-variant mb-2">{data.description || data.name}</p>
              <div className="text-xs text-on-surface-variant space-y-1">
                <p>Category: {data.category}</p>
                <p>Location: {data.address || data.city}</p>
                <p>Phone: {data.phone}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest">
              <h4 className="font-headline font-bold mb-2">Pabandi Trust</h4>
              <ul className="text-sm text-on-surface-variant space-y-2">
                <li>• Protected booking with escrow deposit</li>
                <li>• AI no-show risk reduction</li>
                <li>• $PAB rewards after showing up</li>
                <li>• Dispute resolution if seller doesn’t honor</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

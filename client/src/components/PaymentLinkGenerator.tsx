import { useState } from 'react';
import { useMutation } from 'react-query';
import {
  LinkIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function PaymentLinkGenerator() {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const generateLink = useMutation(
    async () => {
      const res = await api.post('/checkout/session', {
        businessId: user?.id,
        amount: parseFloat(amount),
        currency: 'USD',
        escrowTerms: { description },
        successUrl: window.location.origin + '/checkout-success',
        cancelUrl: window.location.origin + '/checkout-cancel',
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        if (data?.data?.checkoutUrl) {
          setGeneratedLink(data.data.checkoutUrl);
          toast.success('Payment link generated!');
        }
      },
      onError: (err) => {
        console.error(err);
        toast.error('Failed to generate payment link.');
      },
    }
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    generateLink.mutate();
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface">Pabandi Payment Links</h2>
            <p className="text-xs text-on-surface-variant max-w-sm">
              Generate an escrow-backed checkout link to share with buyers on eBay, Instagram, or Craigslist.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-widest">
              Amount (USD)
            </label>
            <div className="relative">
              <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-widest">
              Escrow Terms
            </label>
            <div className="relative">
              <ShieldCheckIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Vintage leather jacket"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={generateLink.isLoading}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-headline font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          {generateLink.isLoading ? 'Generating...' : 'Create Escrow Link'}
        </button>
      </form>

      {generatedLink && (
        <div className="mt-6 pt-6 border-t border-outline-variant/30 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-widest">
            Your Checkout Link
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={generatedLink}
              className="flex-1 bg-surface-container-high border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-primary font-medium outline-none truncate"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 p-3 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 rounded-xl text-on-surface transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <DocumentDuplicateIcon className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            Send this link to your buyer. Their funds will be held in smart escrow until delivery.
          </p>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';
import { escrowService } from '../services/api';

export const EscrowDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [escrow, setEscrow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  useEffect(() => {
    if (id) {
      escrowService.get(id).then(res => {
        setEscrow(res.data?.data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id]);

  const doAction = async (act: string) => {
    if (!escrow) return;
    setAction(act);
    try {
      if (act === 'fund') await escrowService.fund(escrow.id);
      else if (act === 'release') await escrowService.release(escrow.id);
      else if (act === 'dispute') await escrowService.dispute(escrow.id);
      else if (act === 'cancel') await escrowService.cancel(escrow.id);
      const res = await escrowService.get(escrow.id);
      setEscrow(res.data?.data);
    } catch (e) {
      alert(`Action failed: ${act}`);
    } finally {
      setAction('');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  if (!escrow) return <div className="min-h-screen flex items-center justify-center text-slate-400">Escrow not found</div>;

  const statusColor = (s: string) => s === 'COMPLETED' ? 'success' : s === 'FUNDED' ? 'info' : s === 'DISPUTED' ? 'danger' : 'warning';

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white mb-4">← Back</button>

        <Surface className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-slate-100">Secured Sale</h1>
            <Badge tone={statusColor(escrow.status)}>{escrow.status}</Badge>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between"><span className="text-slate-400 text-sm">Item</span><span className="text-slate-100 text-sm">{escrow.itemTitle}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 text-sm">Amount</span><span className="text-emerald-300 font-bold">${escrow.amount}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 text-sm">Seller</span><span className="text-slate-100 text-sm">{escrow.sellerEmail}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 text-sm">Buyer</span><span className="text-slate-100 text-sm">{escrow.buyerEmail || '—'}</span></div>
            {escrow.meetupLocation && <div className="flex justify-between"><span className="text-slate-400 text-sm">Meetup</span><span className="text-slate-100 text-sm">{escrow.meetupLocation}</span></div>}
          </div>

          {/* State Machine */}
          <div className="p-3 rounded-xl bg-white/5 mb-4">
            <div className="text-xs text-slate-400 mb-2">Progress</div>
            <div className="flex items-center gap-2">
              {['PENDING', 'FUNDED', 'COMPLETED'].map((step, i) => (
                <React.Fragment key={step}>
                  <div className={`w-3 h-3 rounded-full ${escrow.status === step || (step === 'PENDING' && escrow.status !== 'CANCELLED' && escrow.status !== 'DISPUTED') || (step === 'FUNDED' && escrow.status === 'COMPLETED') ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  {i < 2 && <div className={`flex-1 h-0.5 ${escrow.status === 'COMPLETED' || (step === 'PENDING' && escrow.status === 'FUNDED') ? 'bg-emerald-400' : 'bg-white/20'}`} />}
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-between text-xs mt-1 text-slate-500">
              <span>Created</span><span>Funded</span><span>Released</span>
            </div>
          </div>

          {/* Actions */}
          {escrow.status === 'PENDING' && (
            <div className="flex gap-2">
              <Button onClick={() => doAction('fund')} disabled={!!action} className="flex-1">{action === 'fund' ? 'Funding...' : 'Fund Escrow'}</Button>
              <Button onClick={() => doAction('cancel')} disabled={!!action} variant="ghost">Cancel</Button>
            </div>
          )}
          {escrow.status === 'FUNDED' && (
            <div className="flex gap-2">
              <Button onClick={() => doAction('release')} disabled={!!action} className="flex-1">{action === 'release' ? 'Releasing...' : 'Confirm & Release'}</Button>
              <Button onClick={() => doAction('dispute')} disabled={!!action} variant="ghost">Dispute</Button>
            </div>
          )}
          {escrow.status === 'DISPUTED' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
              This escrow is under dispute. A jury will review the case.
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
};

export default EscrowDetailPage;

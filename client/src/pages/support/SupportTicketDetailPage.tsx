import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ArrowLeft, Send } from 'lucide-react';
import usePabandiApi from '../../hooks/usePabandiApi';

export default function SupportTicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = usePabandiApi();
  const [ticket, setTicket] = useState<any>(null);
  const [replyBody, setReplyBody] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTicket = async () => {
    try {
      const res = await api.get(`/support/${id}`);
      setTicket(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTicket(); }, [id]);

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    try {
      await api.post(`/support/${id}/replies`, { body: replyBody });
      setReplyBody('');
      fetchTicket();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-400">Loading...</div>;
  if (!ticket) return <div className="p-6 text-center text-red-400">Ticket not found.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/support/tickets')} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{ticket.subject}</h1>
          <p className="text-sm text-slate-400">
            Ticket #{ticket.id.slice(0,8)} • {ticket.status} • {ticket.priority} Priority
          </p>
        </div>
      </div>

      <ClayCard className="p-6 space-y-4 bg-slate-800/20">
        <div className="flex justify-between items-start mb-4">
          <div className="font-medium text-white">{ticket.user?.firstName} {ticket.user?.lastName}</div>
          <div className="text-xs text-slate-500">{new Date(ticket.createdAt).toLocaleString()}</div>
        </div>
        <p className="text-slate-300 whitespace-pre-wrap">{ticket.description}</p>
      </ClayCard>

      <div className="space-y-4">
        {ticket.replies?.map((reply: any) => (
          <ClayCard key={reply.id} className={`p-6 ${reply.isInternal ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="font-medium text-white">
                {reply.author?.firstName} {reply.author?.lastName} {reply.isInternal && <span className="text-amber-400 text-xs ml-2">(Internal Note)</span>}
              </div>
              <div className="text-xs text-slate-500">{new Date(reply.createdAt).toLocaleString()}</div>
            </div>
            <p className="text-slate-300 whitespace-pre-wrap">{reply.body}</p>
          </ClayCard>
        ))}
      </div>

      {ticket.status !== 'Resolved' && (
        <ClayCard className="p-4">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Type your reply here..."
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-1 focus:ring-emerald-500 min-h-[100px]"
          />
          <div className="flex justify-end mt-3">
            <ClayButton variant="primary" onClick={handleReply} disabled={!replyBody.trim()}>
              <Send className="w-4 h-4 mr-2" />
              Send Reply
            </ClayButton>
          </div>
        </ClayCard>
      )}
    </div>
  );
}

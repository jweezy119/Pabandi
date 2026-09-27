import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import usePabandiApi from '../../hooks/usePabandiApi';
import { SupportTicketForm } from './components/SupportTicketForm';

export default function SupportTicketsPage() {
  const navigate = useNavigate();
  const api = usePabandiApi();
  const [tickets, setTickets] = useState<any[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/support');
      setTickets(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'Resolved': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      default: return <Clock className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Tickets</h1>
          <p className="text-slate-400">View and track your support requests.</p>
        </div>
        <ClayButton variant="primary" onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </ClayButton>
      </div>

      <ClayCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No tickets found. Need help? Create a new ticket.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {tickets.map(ticket => (
              <div 
                key={ticket.id} 
                onClick={() => navigate(`/support/tickets/${ticket.id}`)}
                className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{ticket.subject}</span>
                    <span className="text-xs text-slate-500">#{ticket.id.slice(0,8)}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(ticket.createdAt).toLocaleDateString()} • {ticket.category}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
                  {getStatusIcon(ticket.status)}
                  <span className="text-xs font-medium text-slate-300">{ticket.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ClayCard>

      {isFormOpen && (
        <SupportTicketForm 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => { setIsFormOpen(false); fetchTickets(); }} 
        />
      )}
    </div>
  );
}

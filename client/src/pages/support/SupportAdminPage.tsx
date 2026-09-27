import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import api from '../../services/api';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function SupportAdminPage() {
  console.log('SupportAdminPage');
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      // In the backend, passing role ADMIN fetches all tickets for the business
      const res = await api.get('/support');
      setTickets(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/support/${id}/resolve`, {});
      fetchTickets();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'Resolved': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      default: return <Clock className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Support Dashboard</h1>
        <p className="text-slate-400">Manage all customer support tickets across your tenant.</p>
      </div>

      <ClayCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No support tickets found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticket</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tickets.map(ticket => (
                <tr 
                  key={ticket.id} 
                  onClick={() => navigate(`/support/tickets/${ticket.id}`)}
                  className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  <td className="p-4">
                    <div className="font-medium text-white">{ticket.subject}</div>
                    <div className="text-xs text-slate-500">#{ticket.id.slice(0,8)} • {ticket.category}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-300">
                      {ticket.user?.firstName} {ticket.user?.lastName}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      ticket.priority === 'Urgent' ? 'bg-red-500/20 text-red-400' :
                      ticket.priority === 'High' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(ticket.status)}
                      <span className="text-sm text-slate-300">{ticket.status}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {ticket.status !== 'Resolved' && (
                      <ClayButton variant="secondary" onClick={(e) => handleResolve(ticket.id, e)} className="text-xs py-1">
                        Resolve
                      </ClayButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ClayCard>
    </div>
  );
}

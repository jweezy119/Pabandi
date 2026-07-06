import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function GlobalAIConciergeWidget() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string, proposal?: any}[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setQuery('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/concierge', { query: userMsg });
      setMessages(prev => [...prev, { role: 'ai', content: data.message, proposal: data.proposal }]);
    } catch (err) {
      toast.error('Failed to get response from AI Concierge.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = (proposal: any) => {
    if (proposal.proposedBusinessId) {
      navigate(`/booking/${proposal.proposedBusinessId}?date=${proposal.reservationDate}&time=${proposal.reservationTime}&guests=${proposal.numberOfGuests}&concierge=true`);
      setIsOpen(false);
    } else {
      toast.error("The AI didn't provide a valid business to book.");
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-white shadow-2xl rounded-2xl w-80 md:w-96 flex flex-col h-[500px] border border-gray-100 overflow-hidden">
          <div className="bg-indigo-600 p-4 flex justify-between items-center">
            <h3 className="text-white font-bold flex items-center gap-2">
              <span className="text-xl">✨</span> Pabandi AI Concierge
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-10">
                <p className="text-4xl mb-2">👋</p>
                <p>Hi! I'm your AI Concierge powered by Qwen.</p>
                <p className="text-sm mt-2">I can help you find restaurants, book tables, and get 1% crypto cashback on your reservations.</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-none'}`}>
                  {msg.content}
                </div>
                {msg.proposal && (
                  <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg w-full max-w-[85%]">
                    <p className="text-xs font-bold text-indigo-800 mb-1">PROPOSED RESERVATION</p>
                    <p className="text-sm"><strong>{msg.proposal.businessName}</strong></p>
                    <p className="text-xs text-gray-600">{msg.proposal.reservationDate} at {msg.proposal.reservationTime}</p>
                    <p className="text-xs text-gray-600">{msg.proposal.numberOfGuests} Guests</p>
                    <button 
                      onClick={() => handleBook(msg.proposal)}
                      className="mt-2 w-full bg-indigo-600 text-white text-xs font-bold py-1.5 rounded hover:bg-indigo-700 transition-colors"
                    >
                      Book Now (1% Cashback)
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-start">
                <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-sm border border-gray-100">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 bg-white flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E.g., Find a romantic Italian place for 2 on Friday at 7pm..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button 
              type="submit" 
              disabled={loading || !query.trim()}
              className="bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        </button>
      )}
    </div>
  );
}

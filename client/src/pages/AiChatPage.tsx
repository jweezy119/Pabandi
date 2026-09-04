import React, { useState, useRef, useEffect } from 'react';
import { Button, Badge, tokens } from '../design-system';
import { aiRealEstateService } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const AiChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your Pabandi AI assistant. I can help you with:\n\n• 🏠 Property valuation & rental estimates\n• 📝 Lease analysis & document generation\n• 🔧 Maintenance diagnosis & cost estimates\n• 🔍 Tenant screening & market insights\n• 💰 Investment analysis & ROI projections\n\nWhat would you like help with today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiRealEstateService.aiChat(input, { context: 'property_manager' });
      const reply = res.data?.data?.reply || res.data?.reply || 'No response';
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I had trouble processing that. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "What's my property worth?",
    'Analyze my lease',
    'AC not working',
    'Screen a tenant',
    'ROI on investment',
    'Generate a lease',
    'Market trends in my area',
    'Maintenance cost estimate',
  ];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Header */}
        <div className="text-center mb-4">
          <Badge tone="info" className="mb-2">🤖 AI Assistant</Badge>
          <h1 className="text-2xl font-black text-slate-100 font-headline">How can I help?</h1>
          <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>
            Ask about properties, leases, maintenance, tenants, investments, market trends
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] p-3 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-500/20 text-indigo-100'
                    : 'bg-white/5 text-slate-300'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className="text-xs mt-1 opacity-50">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/5 p-3 rounded-xl text-sm text-slate-400">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setInput(prompt)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 whitespace-nowrap hover:bg-white/10"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask me anything about real estate..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none"
          />
          <Button onClick={sendMessage} disabled={!input.trim() || loading}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AiChatPage;

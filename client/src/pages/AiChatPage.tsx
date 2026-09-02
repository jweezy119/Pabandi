import React, { useState, useRef, useEffect } from 'react';
import { Button, Badge, tokens } from '../design-system';

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
      // Simple rule-based responses (no external API needed)
      const response = generateResponse(input.toLowerCase());
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
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

  const generateResponse = (input: string): string => {
    if (input.includes('valuation') || input.includes('how much') || input.includes('worth')) {
      return 'I can help with property valuation! Please provide:\n\n• City & state\n• Bedrooms & bathrooms\n• Square footage\n• Year built (optional)\n• Condition (excellent/good/fair/poor)\n\nOr go to **/ai/analyze** for a full valuation form.';
    }
    if (input.includes('rent') || input.includes('rental')) {
      return 'For rental estimates, I need:\n\n• Property location (city, state)\n• Size (sqft, bedrooms, bathrooms)\n• Amenities (parking, laundry, gym, pool)\n\nI\'ll provide a suggested rent range with confidence score. Try **/ai/analyze**!';
    }
    if (input.includes('lease') || input.includes('contract')) {
      return 'I can analyze your lease! Paste the text and I\'ll:\n\n• Extract key terms (rent, deposit, dates)\n• Identify red flags\n• List missing clauses\n• Give a risk score\n\nGo to **/ai** → Lease Analyzer to upload.';
    }
    if (input.includes('maintenance') || input.includes('repair') || input.includes('fix')) {
      return 'Describe your maintenance issue and I\'ll help with:\n\n• Diagnosis (what\'s likely wrong)\n• Severity level (low/medium/high/emergency)\n• DIY possible? (yes/no)\n• Estimated cost range\n• Recommended vendor type\n• Safety warnings\n\nWhat\'s the issue?';
    }
    if (input.includes('screen') || input.includes('tenant') || input.includes('background')) {
      return 'I can screen tenants! Provide:\n\n• Name & email\n• Monthly income\n• Employment status\n• Credit score (optional)\n• Eviction history (yes/no)\n• Criminal history (yes/no)\n\nI\'ll give a risk band (LOW/MEDIUM/HIGH) and recommendation.';
    }
    if (input.includes('invest') || input.includes('roi') || input.includes('cash flow')) {
      return 'For investment analysis, I need:\n\n• Purchase price\n• Down payment\n• Interest rate & loan term\n• Expected monthly rent\n• Monthly expenses\n\nI\'ll calculate:\n• Monthly cash flow\n• Cap rate\n• Cash-on-cash return\n• 5-year ROI\n• Break-even timeline';
    }
    if (input.includes('document') || input.includes('generate') || input.includes('write')) {
      return 'I can generate these documents:\n\n• 📄 Lease Agreement\n• 📝 Notice to Vacate\n• 🧾 Rent Receipt\n• 🔧 Maintenance Request\n• 📋 Move-In Checklist\n• 🐕 Pet Addendum\n\nGo to **/ai** → Documents to generate.';
    }
    if (input.includes('help') || input.includes('what can you do')) {
      return 'I can help with:\n\n• 🏠 **Property Valuation** — estimate worth & rent\n• 📝 **Lease Analysis** — find red flags & missing terms\n• 🔧 **Maintenance** — diagnose issues & estimate costs\n• 🔍 **Tenant Screening** — assess risk level\n• 💰 **Investment Analysis** — cash flow & ROI\n• 📄 **Document Generation** — leases, notices, receipts\n• 📊 **Market Insights** — rental trends & recommendations\n\nJust ask!';
    }
    return 'I can help with property valuation, lease analysis, maintenance issues, tenant screening, investment analysis, and document generation.\n\nTry asking something like:\n• "What\'s my property worth?"\n• "Analyze this lease"\n• "AC not working"\n• "Screen a tenant"\n• "ROI on investment"\n• "Generate a lease"';
  };

  const quickPrompts = [
    'What\'s my property worth?',
    'Analyze my lease',
    'AC not working',
    'Screen a tenant',
    'ROI on investment',
    'Generate a lease',
  ];

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Header */}
        <div className="text-center mb-4">
          <Badge tone="info" className="mb-2">🤖 AI Assistant</Badge>
          <h1 className="text-2xl font-black text-slate-100 font-headline">How can I help?</h1>
          <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>
            Ask about properties, leases, maintenance, tenants, investments
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

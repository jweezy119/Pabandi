import { useState, useRef, useEffect } from 'react';
import { useMutation } from 'react-query';
import { sourcingService } from '../services/api';
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface Message {
  sender: 'merchant' | 'qwen';
  text: string;
  timestamp: Date;
}

export default function AlibabaQwenConsultantWidget() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'qwen',
      text: `### Welcome to Pabandi Advisor! 👋

I am your **Alibaba Cloud Qwen AI Business Consultant**. I analyze your customer booking history, local city trends, and no-show ratios to build growth and logistics strategies.

You can ask me questions like:
* *"How can I reduce weekend cancellations?"*
* *"What equipment should I source on Alibaba next?"*
* *"How do I increase my reservation bookings?"*`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation(
    (msg: string) => sourcingService.consultAdvisor(msg),
    {
      onSuccess: (res) => {
        const reply = res.data?.response || "I'm sorry, I couldn't formulate a recommendation at this time. Please check back shortly.";
        setMessages((prev) => [
          ...prev,
          {
            sender: 'qwen',
            text: reply,
            timestamp: new Date()
          }
        ]);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'qwen',
            text: "### ⚠️ Connection Interrupted\n\nI was unable to connect to the DashScope MaaS servers. Please ensure your backend is online and try again.",
            timestamp: new Date()
          }
        ]);
      }
    }
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || mutation.isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [
      ...prev,
      {
        sender: 'merchant',
        text: userMsg,
        timestamp: new Date()
      }
    ]);

    mutation.mutate(userMsg);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mutation.isLoading]);

  return (
    <div 
      className="rounded-2xl p-6 mb-8 overflow-hidden transition-all duration-300 flex flex-col h-[500px]"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 106, 0, 0.05) 0%, var(--color-surface-raised) 50%, rgba(255, 18, 0, 0.04) 100%)',
        border: '1px solid rgba(255, 106, 0, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(255, 106, 0, 0.03)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6A00] to-[#FF1200] flex items-center justify-center shadow-md">
            <SparklesIcon className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black text-on-surface flex items-center gap-1.5">
              Alibaba Qwen AI Consultant
            </h2>
            <p className="text-[10px] text-on-surface-variant font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              DashScope MaaS Agent · Online
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#FF6A00]/10 text-[#FF6A00] border border-[#FF6A00]/25">
          QWEN-TURBO
        </span>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin">
        {messages.map((msg, idx) => {
          const isQwen = msg.sender === 'qwen';
          return (
            <div 
              key={idx} 
              className={`flex ${isQwen ? 'justify-start' : 'justify-end'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl p-4 text-sm font-body leading-relaxed shadow-sm ${
                  isQwen 
                    ? 'bg-surface-container border border-outline-variant/20 text-on-surface rounded-tl-sm' 
                    : 'bg-gradient-to-r from-[#FF6A00] to-[#FF1200] text-white rounded-tr-sm'
                }`}
              >
                {isQwen ? (
                  <div className="markdown-body text-xs space-y-2">
                    {msg.text.split('\n\n').map((paragraph, pIdx) => {
                      if (paragraph.startsWith('###')) {
                        return <h4 key={pIdx} className="font-headline font-bold text-sm text-on-surface mt-2 mb-1">{paragraph.replace('###', '').trim()}</h4>;
                      }
                      if (paragraph.includes('*')) {
                        const items = paragraph.split('\n').filter(Boolean);
                        return (
                          <ul key={pIdx} className="list-disc pl-4 space-y-1 mt-1.5">
                            {items.map((item, iIdx) => (
                              <li key={iIdx}>{item.replace('*', '').trim()}</li>
                            ))}
                          </ul>
                        );
                      }
                      return <p key={pIdx}>{paragraph}</p>;
                    })}
                  </div>
                ) : (
                  <p className="text-xs">{msg.text}</p>
                )}
                <span className={`block text-[9px] mt-1.5 text-right ${isQwen ? 'text-on-surface-variant' : 'text-white/70'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {mutation.isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-container border border-outline-variant/20 rounded-2xl rounded-tl-sm p-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-outline-variant/20">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={mutation.isLoading}
          placeholder="Ask a question about your business analytics..."
          className="flex-1 bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-xl focus:ring-1 focus:ring-[#FF6A00] px-3.5 py-2.5 outline-none font-body text-xs disabled:opacity-50"
        />
        <button 
          type="submit"
          disabled={!input.trim() || mutation.isLoading}
          className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#FF1200] text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md shrink-0"
        >
          <PaperAirplaneIcon className="h-4.5 w-4.5 -rotate-45" />
        </button>
      </form>
    </div>
  );
}

/**
 * WhatsAppChat - Chat-like interface for WhatsApp bot commands
 * Mobile-first, responsive component
 */

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  from: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

interface WhatsAppChatProps {
  phone: string;
  onSendMessage?: (message: string) => void;
  className?: string;
}

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  phone,
  onSendMessage,
  className = '',
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      from: 'bot',
      text: `🤖 *Welcome to Pabandi Bot* 🇵🇰\n\nHow can I help you today?\n\nReply "Help" for available commands.\n\n_پابانڈی بوٹ میں خوش آمدید_`,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateBotResponse = async (userMessage: string): Promise<string> => {
    const lower = userMessage.toLowerCase().trim();

    if (lower === 'help' || lower === 'مدد') {
      return `🤖 *Pabandi WhatsApp Bot*

Available Commands:
• Book table at [restaurant] for [time]
• Pay [amount] to [business]
• My bookings
• My payments
• Search [category] in [city]
• Installment status
• Help

Example:
• Book table at BBQ Tonight for 8pm
• Pay 5000 to Al-Hyat Medical
• Search restaurant in Lahore

_Powered by Pabandi - پابانڈی_`;
    }

    if (lower.includes('book')) {
      return `🍽️ Booking request received!\n\nWe're processing your request.\n\nBooking ID: BK-${Date.now().toString(36).toUpperCase()}\n\nYou'll receive a confirmation shortly.\n\n_بکنگ کی درخواست موصول ہوئی_`;
    }

    if (lower.includes('pay')) {
      return `💳 Payment initiated!\n\nReply "Confirm" to proceed.\n\n🔒 Funds held in escrow until service completed.\n\n_ادائیگی کی تصدیق کریں_`;
    }

    if (lower.includes('search')) {
      return `🔍 Searching for businesses...\n\nTop results in your area:\n\n1. BBQ Tonight - Karachi\n2. Salt'n Pepper - Lahore\n3. Cafe Butt - Islamabad\n\nReply with business name to book.\n\n_تلاش جاری ہے_`;
    }

    if (lower.includes('booking')) {
      return `📅 Your Recent Bookings:\n\n1. BK-202401 - BBQ Tonight\n   Status: Confirmed\n   Date: 2024-01-15\n\n2. BK-202402 - Cafe Butt\n   Status: Pending\n   Date: 2024-01-20\n\n_آپ کی بکنگز_`;
    }

    if (lower.includes('payment')) {
      return `💰 Recent Payments:\n\n1. PKR 5,000 - BBQ Tonight\n   Status: Completed\n\n2. PKR 10,000 - Al-Hyat\n   Status: Pending\n\n_آپ کی ادائیگیاں_`;
    }

    if (lower.includes('installment')) {
      return `📊 Installment Status:\n\n✅ Paid: 3\n⏳ Pending: 2\n📊 Total: 5\n\nNext: PKR 15,000\nDue: 2024-02-01\n\n_قسط کی حیثیت_`;
    }

    return `🤖 I didn't understand that.\n\nReply "Help" for available commands.\n\n_سمجھ نہیں آیا_`;
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      from: 'user',
      text: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Call external handler if provided
    onSendMessage?.(inputValue);

    // Simulate bot response delay
    setTimeout(async () => {
      const response = await simulateBotResponse(userMessage.text);
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        from: 'bot',
        text: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const quickCommands = [
    { label: '📅 My Bookings', command: 'My bookings' },
    { label: '💰 My Payments', command: 'My payments' },
    { label: '❓ Help', command: 'Help' },
    { label: '🔍 Search', command: 'Search restaurant in Karachi' },
  ];

  return (
    <div className={`flex flex-col h-full bg-gray-100 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold">Pabandi Bot</h4>
          <p className="text-xs text-green-200">📱 {phone}</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-green-700 rounded-full">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px] bg-[#e5ddd5]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg shadow-sm ${
                msg.from === 'user'
                  ? 'bg-green-100 text-gray-900'
                  : 'bg-white text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className="text-xs text-gray-400 mt-1 text-right">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Commands */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
        {quickCommands.map((cmd) => (
          <button
            key={cmd.command}
            onClick={() => {
              setInputValue(cmd.command);
              inputRef.current?.focus();
            }}
            className="flex-shrink-0 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200 hover:bg-green-100"
          >
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white p-2 rounded-full transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WhatsAppChat;

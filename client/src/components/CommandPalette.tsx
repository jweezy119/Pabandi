import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  action: () => void;
  category: string;
}

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: '1', label: 'Dashboard', icon: '🏠', action: () => navigate('/dashboard'), category: 'Navigation' },
    { id: '2', label: 'Marketplace', icon: '🛒', action: () => navigate('/marketplace'), category: 'Navigation' },
    { id: '3', label: 'Property Manager', icon: '🏢', action: () => navigate('/property-manager'), category: 'Navigation' },
    { id: '4', label: 'AI Property Analyzer', icon: '🤖', action: () => navigate('/ai/analyze'), category: 'AI Tools' },
    { id: '5', label: 'AI Chat', icon: '💬', action: () => navigate('/ai/chat'), category: 'AI Tools' },
    { id: '6', label: 'Lease Analyzer', icon: '📝', action: () => navigate('/ai'), category: 'AI Tools' },
    { id: '7', label: 'Maintenance Assistant', icon: '🔧', action: () => navigate('/ai'), category: 'AI Tools' },
    { id: '8', label: 'Background Check', icon: '🔍', action: () => navigate('/background-check'), category: 'Trust' },
    { id: '9', label: 'Trust Passport', icon: '🛡️', action: () => navigate('/passport'), category: 'Trust' },
    { id: '10', label: 'Escrow', icon: '🔒', action: () => navigate('/escrow'), category: 'Finance' },
    { id: '11', label: 'PAB Token', icon: '💰', action: () => navigate('/token'), category: 'Finance' },
    { id: '12', label: 'Tokenomics', icon: '📊', action: () => navigate('/tokenomics'), category: 'Finance' },
    { id: '13', label: 'Wallet Connect', icon: '👻', action: () => navigate('/wallet'), category: 'Finance' },
    { id: '14', label: 'Rent Roll', icon: '📋', action: () => navigate('/rent-roll'), category: 'Property' },
    { id: '15', label: 'Lease Generator', icon: '📄', action: () => navigate('/leases'), category: 'Property' },
    { id: '16', label: 'Applications', icon: '📝', action: () => navigate('/applications'), category: 'Property' },
    { id: '17', label: 'Documents', icon: '📁', action: () => navigate('/documents'), category: 'Property' },
    { id: '18', label: 'Dispute Center', icon: '⚖️', action: () => navigate('/disputes'), category: 'Trust' },
    { id: '19', label: 'SafeMeet', icon: '📍', action: () => navigate('/safemeet'), category: 'Trust' },
    { id: '20', label: 'Settings', icon: '⚙️', action: () => navigate('/settings'), category: 'System' },
  ];

  const filtered = commands.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description?.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-surface/95 backdrop-blur-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-white/10">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-slate-100 outline-none text-sm placeholder:text-slate-500"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">No results found</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                  i === selectedIndex ? 'bg-indigo-500/20 text-indigo-200' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="text-lg">{cmd.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{cmd.label}</div>
                  {cmd.description && <div className="text-xs text-slate-500">{cmd.description}</div>}
                </div>
                <span className="text-xs text-slate-500">{cmd.category}</span>
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

import React, { useState, useEffect } from 'react';
import { Copy, Check, MessageCircle, Mail, Smartphone, Clock } from 'lucide-react';
import { useVerticalPersona, formatOutreachMessage } from '../../../config/verticalPersonas';
import { useAuthStore } from '../../../store/authStore';

interface QuickFriendlyMessageCardProps {
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  onLogActivity?: (payload: { type: string; title: string; description: string }) => Promise<void>;
}

function cleanPhoneDigits(phone?: string): string {
  return (phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
}

export const QuickFriendlyMessageCard: React.FC<QuickFriendlyMessageCardProps> = ({
  clientName,
  clientPhone,
  clientEmail,
  onLogActivity,
}) => {
  const persona = useVerticalPersona();
  const user = useAuthStore((s) => s.user) as any;
  const businessName =
    user?.business?.name ||
    user?.businessName ||
    persona.exampleBusiness;

  const [selectedId, setSelectedId] = useState(persona.outreachTemplates[0]?.id || 'reminder');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [logging, setLogging] = useState(false);
  const [loggedNotice, setLoggedNotice] = useState(false);

  const selectedTemplate =
    persona.outreachTemplates.find((t) => t.id === selectedId) || persona.outreachTemplates[0];

  useEffect(() => {
    if (selectedTemplate) {
      setDraft(
        formatOutreachMessage(selectedTemplate.body, {
          clientName,
          businessName,
        })
      );
    }
  }, [selectedTemplate?.id, clientName, businessName, persona.id]);

  const subject = selectedTemplate
    ? formatOutreachMessage(selectedTemplate.subject, { clientName, businessName })
    : `Quick note from ${businessName}`;

  const phoneDigits = cleanPhoneDigits(clientPhone);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in insecure context
    }
  };

  const handleLog = async () => {
    if (!onLogActivity || !draft.trim()) return;
    setLogging(true);
    try {
      await onLogActivity({
        type: 'NOTE',
        title: `Sent "${selectedTemplate?.label || 'Friendly Note'}"`,
        description: draft,
      });
      setLoggedNotice(true);
      setTimeout(() => setLoggedNotice(false), 2500);
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-[rgba(191,179,163,0.4)] space-y-3.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-[var(--warm-ink)] flex items-center gap-1.5">
            <span>{persona.emoji}</span>
            <span>Quick Friendly Message</span>
          </h3>
          <p className="text-xs text-[var(--soft-stone)]">
            Written in your {persona.shortLabel.toLowerCase()} voice — edit if you like, then send in one tap.
          </p>
        </div>
      </div>

      {/* Template chips */}
      <div className="flex flex-wrap gap-2">
        {persona.outreachTemplates.map((tpl) => {
          const active = tpl.id === selectedTemplate?.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelectedId(tpl.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
              style={{
                backgroundColor: active ? 'var(--clay)' : 'var(--cream)',
                color: active ? '#fff' : 'var(--warm-ink)',
                borderColor: active ? 'var(--clay)' : 'rgba(191,179,163,0.4)',
              }}
            >
              {tpl.emoji} {tpl.label}
            </button>
          );
        })}
      </div>

      {/* Editable message draft */}
      <textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full rounded-xl p-3 text-sm bg-[var(--cream)] border border-[rgba(191,179,163,0.4)] text-[var(--warm-ink)] focus:outline-none focus:border-[var(--clay)]"
      />

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--clay)' }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Message'}
        </button>

        <a
          href={
            phoneDigits
              ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(draft)}`
              : `https://wa.me/?text=${encodeURIComponent(draft)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#E8F5E9] text-[#1B5E20] hover:opacity-90 transition"
        >
          <MessageCircle size={14} />
          WhatsApp
        </a>

        <a
          href={`sms:${phoneDigits ? `+${phoneDigits}` : ''}?&body=${encodeURIComponent(draft)}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:opacity-90 transition"
        >
          <Smartphone size={14} />
          Text (SMS)
        </a>

        <a
          href={`mailto:${clientEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft)}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--warm-sand)]/50 text-[var(--warm-ink)] hover:opacity-90 transition"
        >
          <Mail size={14} />
          Email
        </a>

        {onLogActivity && (
          <button
            type="button"
            onClick={handleLog}
            disabled={logging}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[rgba(191,179,163,0.45)] text-[var(--soft-stone)] hover:text-[var(--warm-ink)] hover:border-[var(--clay)] transition disabled:opacity-50"
          >
            <Clock size={13} />
            {loggedNotice ? 'Logged to timeline ✓' : logging ? 'Logging…' : 'Log to Timeline'}
          </button>
        )}
      </div>
    </div>
  );
};

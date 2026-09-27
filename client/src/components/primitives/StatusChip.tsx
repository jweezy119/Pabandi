export function StatusChip({ status, variant, size = 'md', className = '' }: {
  status: string;
  variant?: 'scheduled' | 'in-progress' | 'complete' | 'cancelled' | 'missed' | 'draft' | 'sent' | 'paid' | 'overdue' | 'won' | 'lost' | 'lead' | 'qualified' | 'proposal' | 'negotiation';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const STATUS_VARIANTS: Record<string, { bg: string; color: string; label: string }> = {
    scheduled: { bg: 'rgba(217,168,84,0.15)', color: 'var(--muted-ochre)', label: 'Scheduled' },
    'in-progress': { bg: 'rgba(201,123,90,0.12)', color: 'var(--clay)', label: 'In Progress' },
    complete: { bg: 'rgba(138,154,123,0.15)', color: 'var(--sage)', label: 'Complete' },
    cancelled: { bg: 'rgba(191,179,163,0.2)', color: 'var(--soft-stone)', label: 'Cancelled' },
    missed: { bg: 'rgba(212,165,165,0.15)', color: 'var(--dusty-rose)', label: 'Missed' },
    draft: { bg: 'rgba(191,179,163,0.15)', color: 'var(--soft-stone)', label: 'Draft' },
    sent: { bg: 'rgba(217,168,84,0.15)', color: 'var(--muted-ochre)', label: 'Sent' },
    paid: { bg: 'rgba(138,154,123,0.15)', color: 'var(--sage)', label: 'Paid' },
    overdue: { bg: 'rgba(212,165,165,0.15)', color: 'var(--dusty-rose)', label: 'Overdue' },
    won: { bg: 'rgba(138,154,123,0.15)', color: 'var(--sage)', label: 'Won' },
    lost: { bg: 'rgba(212,165,165,0.12)', color: 'var(--dusty-rose)', label: 'Lost' },
    lead: { bg: 'rgba(184,201,212,0.2)', color: 'var(--sky-wash)', label: 'Lead' },
    qualified: { bg: 'rgba(217,168,84,0.15)', color: 'var(--muted-ochre)', label: 'Qualified' },
    proposal: { bg: 'rgba(201,123,90,0.12)', color: 'var(--clay)', label: 'Proposal' },
    negotiation: { bg: 'rgba(168,90,60,0.15)', color: 'var(--terracotta)', label: 'Negotiation' },
  };

  const normalized = (status || '').toLowerCase().replace(/\s+/g, '-');
  const config = variant ? STATUS_VARIANTS[variant] : STATUS_VARIANTS[normalized] || STATUS_VARIANTS.draft;
  const label = variant ? config.label : status;

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '10px' },
    md: { padding: '3px 10px', fontSize: '11px' },
  };

  const borderOpacity = config.bg.includes('0.15') ? '0.3' : config.bg.includes('0.12') ? '0.25' : '0.3';

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full ${className}`}
      style={{
        ...sizeStyles[size],
        backgroundColor: config.bg,
        color: config.color,
        fontFamily: 'var(--font-label)',
        letterSpacing: '0.04em',
        border: `1px solid rgba(${config.color.includes('var(--') ? '191,179,163' : ''}, ${borderOpacity})`,
      }}
    >
      {label}
    </span>
  );
}

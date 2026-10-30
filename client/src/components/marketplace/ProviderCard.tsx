import type { MatchedProvider } from './types';

interface ProviderCardProps {
  provider: MatchedProvider;
  onHire?: (provider: MatchedProvider) => void;
  /** Whether a hire action is in flight for this card. */
  hiring?: boolean;
}

/**
 * Clay-styled card for a matched provider, shown after a project is posted.
 * Leads with the Trust Score — the whole point of matching — then identity,
 * then the skills that earned this provider the match.
 */
export function ProviderCard({ provider, onHire, hiring = false }: ProviderCardProps) {
  return (
    <div
      className="rounded-[var(--radius-card)] bg-[var(--cream)] border border-[rgba(201,123,90,0.25)] p-5 flex flex-col gap-3"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {provider.avatarUrl ? (
            <img
              src={provider.avatarUrl}
              alt={provider.displayName}
              className="w-11 h-11 rounded-full object-cover border border-[rgba(46,37,32,0.15)]"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[var(--warm-sand)] flex items-center justify-center font-headline text-[var(--warm-ink)] shrink-0">
              {provider.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-headline text-[var(--warm-ink)] truncate">
              {provider.displayName}
            </p>
            <p className="text-sm text-[var(--soft-stone)] truncate">
              @{provider.handle}
            </p>
          </div>
        </div>

        <TrustScoreBadge score={provider.overallScore} />
      </div>

      {provider.headline && (
        <p className="text-sm text-[var(--soft-stone)] line-clamp-2">{provider.headline}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {provider.matchedSkills.slice(0, 5).map((skill) => (
          <span
            key={skill}
            className="text-xs px-2 py-0.5 rounded-[var(--radius-pill)] bg-[var(--warm-sand)] text-[var(--warm-ink)]"
          >
            {skill}
          </span>
        ))}
        {provider.matchedSkills.length === 0 && (
          <span className="text-xs text-[var(--soft-stone)]">No direct skill match</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-[var(--soft-stone)]">
        <span>{provider.completedProjects} projects completed</span>
        {provider.verifiedIdentity && (
          <span className="text-[var(--sage)]" title="Identity verified">✓ verified</span>
        )}
      </div>

      <button
        type="button"
        disabled={hiring}
        onClick={onHire ? () => onHire(provider) : undefined}
        className="mt-1 w-full rounded-[var(--radius-btn)] py-2.5 font-label text-sm text-[var(--cream)] bg-[var(--clay)] hover:bg-[var(--terracotta)] transition-colors disabled:opacity-50"
        style={{ boxShadow: 'var(--shadow-btn)' }}
      >
        {hiring ? 'Hiring…' : 'Hire'}
      </button>
    </div>
  );
}

/** Trust Score pill — mud (low), ochre (mid), sage (high). */
function TrustScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-[rgba(138,154,123,0.25)] text-[var(--warm-ink)]'
      : score >= 50
        ? 'bg-[rgba(217,168,84,0.25)] text-[var(--warm-ink)]'
        : 'bg-[rgba(212,165,165,0.3)] text-[var(--warm-ink)]';
  return (
    <div className={`${tone} shrink-0 rounded-2xl px-3 py-1.5 text-center`} title="Trust Score">
      <p className="font-headline text-lg leading-none">{Math.round(score)}</p>
      <p className="text-[10px] tracking-wide opacity-75">Trust</p>
    </div>
  );
}

export default ProviderCard;

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/authToken';

/**
 * ⌘K over the whole CRM.
 *
 * WHAT THIS REPLACES
 *
 * `CommandPalette` existed and was never imported. It was not ready to be switched on:
 *
 *   - 2 of its 20 commands pointed at routes that do not exist (`/wallet` has no route
 *     at all; the real settings page is `/contact/settings`, not `/settings`), so
 *     choosing them navigated nowhere.
 *   - Not one entry pointed at the CRM. The entire surface a person actually works
 *     in — clients, deals, jobs, invoices, reports — was absent.
 *   - It filtered a hardcoded array in memory, so "search" meant "filter this list".
 *     You could not find a client by typing their name.
 *   - ⌘K called `onClose()`, so it could only ever be dismissed, never opened.
 *   - The highlighted row index was reset when the palette opened but not when the
 *     query changed, so filtering could leave the selection pointing past the end.
 *   - Dark slate styling, against a clay-palette CRM.
 *
 * So this is a rebuild rather than an import. Navigation comes from the real route
 * table, results come from the real search endpoint, and the theme is the product's.
 *
 * Two modes, one keyboard:
 *   - short or empty query  → navigation commands, filtered locally, instant
 *   - 2+ characters         → server search across clients, deals, jobs, invoices and
 *                            activities, debounced
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';

/**
 * Commands, each pointing at a route verified to exist in App.tsx.
 *
 * This is the list that rots. Two of the previous palette's twenty targets were dead,
 * and nothing detected it because a navigation target is a string, not a type. The
 * `commandsMatchRoutes` test checks every one of these against the real route table so
 * the next one cannot rot quietly.
 */
const COMMANDS = [
  { label: 'Dashboard', category: 'Go to', href: '/dashboard' },
  { label: 'Clients', category: 'Go to', href: '/contact/clients' },
  { label: 'Deals', category: 'Go to', href: '/contact/deals' },
  { label: 'Jobs', category: 'Go to', href: '/contact/jobs' },
  { label: 'Invoices', category: 'Go to', href: '/contact/invoices' },
  { label: 'Activities', category: 'Go to', href: '/contact/activities' },
  { label: 'Tasks', category: 'Go to', href: '/contact/tasks' },
  { label: 'Team', category: 'Go to', href: '/contact/team' },
  { label: 'Reports', category: 'Go to', href: '/contact/reports' },
  { label: 'Money flow', category: 'Go to', href: '/contact/money-flow' },
  { label: 'Property OS', category: 'Go to', href: '/property' },
  { label: 'Capital', category: 'Go to', href: '/capital' },
  { label: 'Settings', category: 'Go to', href: '/contact/settings' },
  { label: 'Pipeline settings', category: 'Settings', href: '/contact/settings/pipeline' },
  { label: 'Custom fields', category: 'Settings', href: '/contact/settings/custom-fields' },
  { label: 'Modules', category: 'Settings', href: '/contact/settings/modules' },
  { label: 'Service catalogue', category: 'Settings', href: '/contact/settings/services' },
  { label: 'Payment settings', category: 'Settings', href: '/contact/settings/payment' },
  { label: 'Notifications', category: 'Settings', href: '/contact/settings/notifications' },
];

export const PALETTE_COMMANDS = COMMANDS;

interface SearchResult {
  type: 'client' | 'deal' | 'job' | 'invoice' | 'activity';
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  client: 'Client',
  deal: 'Deal',
  job: 'Job',
  invoice: 'Invoice',
  activity: 'Activity',
};

/** Matches MIN_SEARCH_LENGTH on the server. Kept in step so the mode flips together. */
const MIN_QUERY = 2;

type Row =
  | { kind: 'command'; label: string; category: string; href: string }
  | { kind: 'result'; result: SearchResult };

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const trimmed = query.trim();
  const isSearching = trimmed.length >= MIN_QUERY;

  // ── Open/close housekeeping ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      restoreFocusTo.current?.focus?.();
      return;
    }
    // Remember what had focus so Escape and selection return the user to where they
    // were, rather than dropping them at the top of the document.
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setResults([]);
    setSelected(0);
    setSearchFailed(false);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !isSearching) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchFailed(false);

    // 200ms. Long enough that typing a name does not fire a request per keystroke,
    // short enough that it still feels like the palette is listening.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/crm/search?q=${encodeURIComponent(trimmed)}`,
          { headers: { Authorization: `Bearer ${getAuthToken()}` } },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (cancelled) return;
        setResults(body?.data?.results ?? []);
      } catch {
        if (!cancelled) {
          // Failed search and no matches are different states. Conflating them tells
          // someone a client does not exist because the request broke.
          setResults([]);
          setSearchFailed(true);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, isOpen, isSearching]);

  const rows: Row[] = useMemo(() => {
    if (isSearching) {
      return results.map((result) => ({ kind: 'result' as const, result }));
    }
    const q = trimmed.toLowerCase();
    return COMMANDS.filter(
      (c) => !q || c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
    ).map((c) => ({ kind: 'command' as const, ...c }));
  }, [isSearching, results, trimmed]);

  // Clamp as well as reset. Resetting alone is not enough: the row count can shrink
  // under a held arrow key as results stream in.
  useEffect(() => {
    setSelected((i) => (i >= rows.length ? Math.max(0, rows.length - 1) : i));
  }, [rows.length]);

  // Reset to the top on a new query — otherwise a user who arrowed down and then typed
  // has the highlight somewhere unrelated to what they just asked for.
  useEffect(() => {
    setSelected(0);
  }, [trimmed]);

  const run = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      const href = row.kind === 'command' ? row.href : row.result.href;
      onClose();
      navigate(href);
    },
    [navigate, onClose],
  );

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((i) => Math.min(i + 1, rows.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        run(rows[selected]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, rows, selected, onClose, run]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-[rgba(191,179,163,0.4)] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(191,179,163,0.3)]">
          <svg className="w-4 h-4 text-[var(--soft-stone)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, deals, jobs, invoices…"
            aria-label="Search"
            aria-autocomplete="list"
            className="flex-1 bg-transparent text-[var(--warm-ink)] outline-none text-sm placeholder:text-[var(--soft-stone)]"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[var(--warm-sand)]/30 text-[var(--soft-stone)] border border-[rgba(191,179,163,0.4)]">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2" role="listbox">
          {searchFailed ? (
            <p className="p-4 text-center text-sm text-[var(--soft-stone)]">
              Search could not be reached. Try again.
            </p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-center text-sm text-[var(--soft-stone)]">
              {isSearching
                ? searching
                  ? 'Searching…'
                  : `Nothing matches “${trimmed}”.`
                : 'No commands match.'}
            </p>
          ) : (
            rows.map((row, i) => (
              <button
                key={row.kind === 'command' ? `c-${row.href}` : `r-${row.result.type}-${row.result.id}`}
                data-index={i}
                role="option"
                aria-selected={i === selected}
                onMouseEnter={() => setSelected(i)}
                onClick={() => run(row)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                  i === selected ? 'bg-[var(--clay)]/15' : 'hover:bg-[var(--warm-sand)]/20'
                }`}
              >
                {row.kind === 'command' ? (
                  <>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--warm-sand)]/40 text-[var(--soft-stone)] shrink-0">
                      {row.category}
                    </span>
                    <span className="flex-1 text-sm font-medium text-[var(--warm-ink)]">{row.label}</span>
                  </>
                ) : (
                  <>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--clay)]/15 text-[var(--clay)] shrink-0">
                      {TYPE_LABELS[row.result.type]}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-[var(--warm-ink)] truncate">
                        {row.result.title}
                      </span>
                      {row.result.subtitle && (
                        <span className="block text-xs text-[var(--soft-stone)] truncate">
                          {row.result.subtitle}
                        </span>
                      )}
                    </span>
                    {row.result.meta && (
                      <span className="text-xs text-[var(--soft-stone)] shrink-0">{row.result.meta}</span>
                    )}
                  </>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-[rgba(191,179,163,0.3)] flex items-center gap-4 text-[11px] text-[var(--soft-stone)]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
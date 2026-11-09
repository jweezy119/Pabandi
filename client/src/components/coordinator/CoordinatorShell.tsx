import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import CenterStream from './CenterStream';
import CommandBar, { COMMAND_EXAMPLES } from './CommandBar';
import Inspector from './Inspector';
import LeftRail from './LeftRail';
import { PbnIcon } from './icons';
import { useMediaQuery } from './useMediaQuery';
import type { CoordinatorCommands } from './useCoordinatorCommands';
import type { CoordinatorFilter, CoordinatorFilterId, WorkOrder } from './types';

/**
 * Stub used when the page does not supply a wired command bar (Phase 1's
 * standalone harness). The bar renders in its disabled shape so the keyboard
 * path still has something real to skip over.
 */
const DISABLED_COMMANDS: CoordinatorCommands = {
  input: '',
  setInput: () => {},
  inputRef: { current: null },
  submit: () => {},
  confirmPlan: () => {},
  cancelPlan: () => {},
  chooseOption: () => {},
  undo: () => {},
  dismiss: () => {},
  clearSearch: () => {},
  state: { kind: 'none' },
  hasInput: false,
};

/** Persisted so a coordinator who collapsed the rail once is not asked again. */
const RAIL_COLLAPSED_KEY = 'pbn:coordinator:rail-collapsed';

export interface CoordinatorShellProps {
  businessName: string;
  demoMode?: boolean;
  filters: CoordinatorFilter[];
  activeFilter: CoordinatorFilterId;
  onFilterChange: (id: CoordinatorFilterId) => void;
  onNewWorkOrder: () => void;
  onConnectWhatsApp: () => void;
  /** Stream header. "Today" by default — §4.9, not "All". */
  streamTitle: string;
  streamDate: string;
  streamCount: number;
  streamChildren?: ReactNode;
  /** The work order shown in the inspector, or null for the empty state. */
  inspectorWorkOrder?: WorkOrder | null;
  /** Clears the selection, which closes the inspector on both layouts. */
  onCloseInspector?: () => void;
  /**
   * The command bar. The page supplies a wired one; without it the shell
   * renders the bar disabled, which is the Phase 1 shape.
   */
  commandBar?: ReactNode;
  commandDisabled?: boolean;
}

/**
 * The three-pane command surface.
 *
 * Layout is the whole point of this component: a navigation rail, one
 * chronological feed, an inspector that only carries meaning once a row is
 * selected, and a command bar pinned to the bottom of the feed. The four
 * former tabs are filters in the rail, so switching views never looks like
 * leaving the page.
 */
export default function CoordinatorShell({
  businessName,
  demoMode = false,
  filters,
  activeFilter,
  onFilterChange,
  onNewWorkOrder,
  onConnectWhatsApp,
  streamTitle,
  streamDate,
  streamCount,
  streamChildren,
  inspectorWorkOrder,
  onCloseInspector,
  commandBar,
  commandDisabled = true,
}: CoordinatorShellProps) {
  const isMobile = useMediaQuery('(max-width: 900px)');

  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(RAIL_COLLAPSED_KEY) === 'true';
    } catch {
      /* localStorage is unavailable in private mode; the rail still works, it
         just does not survive a reload. */
      return false;
    }
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);

  const toggleRail = useCallback(() => {
    setRailCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(RAIL_COLLAPSED_KEY, String(next));
      } catch {
        /* Same reason as above: persistence is a nicety, not a requirement. */
      }
      return next;
    });
  }, []);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  // `?` opens the cheat sheet from anywhere that is not a text field, so the
  // shortcut does not fire in the middle of typing a command. Escape closes
  // the inspector (§4.8); the help dialog handles its own Escape in the capture
  // phase and stops propagation, so this cannot fire while it is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && inspectorWorkOrder != null && !helpOpen) {
        event.preventDefault();
        onCloseInspector?.();
        return;
      }

      if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      openHelp();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openHelp, helpOpen, inspectorWorkOrder, onCloseInspector]);

  return (
    <div className="pbn-shell">
      <header className="pbn-topbar">
        <div className="pbn-brand">
          <span className="pbn-brand__name">Pabandi</span>
          <span className="pbn-brand__divider" aria-hidden="true" />
          <span className="pbn-brand__module">Service Coordinator</span>
        </div>

        <div className="pbn-topbar__spacer" />

        {demoMode && <span className="pbn-demo-badge">Demo mode</span>}

        <div className="pbn-business">
          <span className="pbn-business__label">Business</span>
          <span className="pbn-business__name">{businessName}</span>
        </div>

        <button
          ref={helpButtonRef}
          type="button"
          className="pbn-btn pbn-btn--ghost pbn-topbar__help"
          onClick={openHelp}
          aria-keyshortcuts="?"
          data-pbn-focus-id="topbar-help"
        >
          <PbnIcon name="help" size={16} />
          Help
        </button>
      </header>

      <div className="pbn-body">
        <LeftRail
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
          collapsed={railCollapsed}
          onToggleCollapsed={toggleRail}
          onNewWorkOrder={onNewWorkOrder}
        />

        <section className="pbn-center" aria-label="Work stream">
          <CenterStream
            title={streamTitle}
            dateLabel={streamDate}
            count={streamCount}
            onNewWorkOrder={onNewWorkOrder}
            onConnectWhatsApp={onConnectWhatsApp}
          >
            {streamChildren}
          </CenterStream>
          {commandBar ?? (
            <CommandBar
              commands={DISABLED_COMMANDS}
              disabled={commandDisabled}
              examples={COMMAND_EXAMPLES}
              onViewWorkOrder={() => {}}
            />
          )}
        </section>

        <Inspector
          isMobile={isMobile}
          workOrder={inspectorWorkOrder ?? null}
          onClose={onCloseInspector ?? (() => {})}
        />
      </div>

      {helpOpen && <HelpDialog onClose={closeHelp} triggerRef={helpButtonRef} />}
    </div>
  );
}

/* ── Help dialog ─────────────────────────────────────────────────────────── */

/**
 * The keyboard cheat sheet.
 *
 * Focus is moved into the dialog on open and trapped there while it is open —
 * a modal that lets Tab escape to the page behind it is not modal. Focus
 * returns to the Help button on close, which is the only control that can
 * open it.
 */
function HelpDialog({
  onClose,
  triggerRef,
}: {
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // The shortcut can be pressed while nothing is focused, so the element
    // that opened the dialog is the fallback rather than the assumption.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Capture phase so the tooltip's own Escape handler and the shell's
    // shortcut handler cannot race this one.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const restoreTo =
        previouslyFocused &&
        previouslyFocused.isConnected &&
        previouslyFocused.tagName !== 'BODY'
          ? previouslyFocused
          : triggerRef.current;
      restoreTo?.focus();
    };
  }, [onClose, triggerRef]);

  return (
    <div
      className="pbn-dialog"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="pbn-dialog__panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pbn-help-title"
      >
        <div className="pbn-dialog__header">
          <h2 className="pbn-dialog__title" id="pbn-help-title">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="pbn-icon-btn"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            data-pbn-focus-id="dialog-close"
          >
            <PbnIcon name="close" size={16} />
          </button>
        </div>
        <div className="pbn-dialog__body">
          <p>
            Every shortcut also has a button somewhere on screen. Shortcuts save
            time; they are never the only way to do something.
          </p>
          <div className="pbn-shortcuts">
            <div className="pbn-shortcut">
              <span className="pbn-shortcut__label">Open this cheat sheet</span>
              <span className="pbn-shortcut__keys">?</span>
            </div>
            <div className="pbn-shortcut">
              <span className="pbn-shortcut__label">Close a panel or dialog</span>
              <span className="pbn-shortcut__keys">Esc</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useId, useState } from 'react';
import { PbnIcon } from './icons';
import CommandStrip from './CommandStrip';
import type { CoordinatorCommands } from './useCoordinatorCommands';

export const COMMAND_EXAMPLES = [
  'Try: assign 1425 Chase to Marcus tomorrow 9am',
  'Try: show high-risk leaks this week',
  'Try: approve all low-risk inspections',
];

/**
 * The three pills, and what each one types into the bar.
 *
 * Each pill demonstrates a different path through the parser: an explicit
 * filter, the assign intent, and free text that falls through to the silent
 * search fallback. They insert text rather than running the command so the
 * user sees the syntax and can edit it before pressing Enter.
 */
const PILL_SUGGESTIONS = [
  { label: "Show today's jobs", text: 'show jobs today' },
  { label: 'Assign a job', text: 'assign ' },
  { label: 'Ask a question', text: 'how many jobs are on today?' },
];

export interface CommandBarProps {
  commands: CoordinatorCommands;
  examples?: string[];
  disabled?: boolean;
  onViewWorkOrder: (id: string) => void;
}

/**
 * The command bar, pinned to the bottom of the centre column.
 *
 * Accessibility notes:
 *  - The input has a real `<label>` (visually hidden) — the rotating example
 *    is a placeholder, never the label, per §1.
 *  - The hint is wired with `aria-describedby` so a screen reader user hears
 *    what the bar accepts without having to guess from the placeholder.
 *  - The suggestion pills are buttons, not decorative chips, so they are in
 *    the tab order.
 *  - `/` focuses the bar (§4.8). It is an accelerator: everything the bar
 *    does is reachable by clicking.
 *  - The placeholder rotates every five seconds, and stops rotating while the
 *    field is focused or holds text — a moving target under someone's cursor
 *    is not an affordance, it is a distraction.
 */
export default function CommandBar({
  commands,
  examples = COMMAND_EXAMPLES,
  disabled = false,
  onViewWorkOrder,
}: CommandBarProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [focused, setFocused] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);

  const paused = disabled || focused || commands.hasInput;

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(
      () => setExampleIndex((index) => (index + 1) % examples.length),
      5000,
    );
    return () => clearInterval(timer);
  }, [paused, examples.length]);

  useEffect(() => {
    if (disabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // §4.8: ⌘K / Ctrl+K opens the search. The command bar is the search, so it
      // focuses it — the same destination "/" takes, with the platform's
      // conventional shortcut.
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        commands.inputRef.current?.focus();
        return;
      }

      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing) return;
      event.preventDefault();
      commands.inputRef.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, commands.inputRef]);

  return (
    <div className="pbn-commandbar">
      <div className="pbn-commandbar__field">
        <span className="pbn-commandbar__prompt" aria-hidden="true">
          <PbnIcon name="chevron-right" size={18} />
        </span>
        <label htmlFor={inputId} className="pbn-visually-hidden">
          Command bar
        </label>
        <input
          ref={commands.inputRef}
          id={inputId}
          className="pbn-commandbar__input"
          type="text"
          disabled={disabled}
          placeholder={examples[exampleIndex]}
          aria-describedby={hintId}
          autoComplete="off"
          spellCheck={false}
          value={commands.input}
          onChange={(event) => commands.setInput(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commands.submit();
            }
          }}
        />
      </div>
      <p id={hintId} className="pbn-visually-hidden">
        Type a command in plain English, for example
        &nbsp;&quot;assign 1425 to Marcus tomorrow 9am&quot;. If the command is
        not recognised, it is treated as a search.
      </p>
      <div className="pbn-commandbar__pills">
        {PILL_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            className="pbn-pill"
            disabled={disabled}
            onClick={() => {
              commands.setInput(suggestion.text);
              commands.inputRef.current?.focus();
            }}
          >
            {suggestion.label}
          </button>
        ))}
      </div>
      <CommandStrip
        state={commands.state}
        examples={examples.map((example) => example.replace(/^Try:\s*/, ''))}
        onDismiss={commands.dismiss}
        onChooseOption={commands.chooseOption}
        onViewWorkOrder={onViewWorkOrder}
        onClearSearch={commands.clearSearch}
        onTryExample={(example) => {
          commands.setInput(example);
          commands.inputRef.current?.focus();
        }}
      />
    </div>
  );
}

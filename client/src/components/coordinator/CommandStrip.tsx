import type { CommandUiState } from './useCoordinatorCommands';
import type { AmbiguityOption } from './commandParser';

export interface CommandStripProps {
  state: CommandUiState;
  examples: string[];
  onDismiss: () => void;
  onChooseOption: (option: AmbiguityOption) => void;
  onViewWorkOrder: (id: string) => void;
  onClearSearch: () => void;
  onTryExample: (example: string) => void;
}

/**
 * The strip under the command input.
 *
 * Five looks, one purpose: tell the user what just happened or what the
 * product needs from them. Nothing here is a toast — a toast disappears on a
 * timer and cannot be undone, and the strip's whole job is to carry the Undo
 * button for thirty seconds.
 */
export default function CommandStrip({
  state,
  examples,
  onDismiss,
  onChooseOption,
  onViewWorkOrder,
  onClearSearch,
  onTryExample,
}: CommandStripProps) {
  if (state.kind === 'none') return null;

  if (state.kind === 'disambiguation') {
    const noun = state.slot === 'technician' ? 'people' : 'work orders';
    return (
      <div className="pbn-strip pbn-strip--question" role="status">
        <p className="pbn-strip__text">
          We found {state.options.length} {noun} matching &ldquo;{state.query}&rdquo;. Which one do
          you mean?
        </p>
        <div className="pbn-strip__options">
          {state.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="pbn-strip__option"
              onClick={() => onChooseOption(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="pbn-strip__dismiss" onClick={onDismiss}>
          Cancel
        </button>
      </div>
    );
  }

  if (state.kind === 'done') {
    return (
      <div className="pbn-strip pbn-strip--done" role="status" aria-live="polite">
        <span className="pbn-strip__text">{state.message}</span>
        {state.onUndo && (
          <button
            type="button"
            className="pbn-strip__action"
            onClick={state.onUndo}
          >
            {state.undoLabel}
          </button>
        )}
        {state.viewWorkOrderId && (
          <button
            type="button"
            className="pbn-strip__action"
            onClick={() => onViewWorkOrder(state.viewWorkOrderId!)}
          >
            View
          </button>
        )}
        <button
          type="button"
          className="pbn-strip__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss confirmation"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    );
  }

  if (state.kind === 'search') {
    return (
      <div className="pbn-strip pbn-strip--search" role="status">
        <span className="pbn-strip__text">
          Showing {state.count} {state.count === 1 ? 'result' : 'results'} for
          &nbsp;&ldquo;{state.query}&rdquo;. If you meant a command, try one of these:
        </span>
        <div className="pbn-strip__options">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              className="pbn-strip__option"
              onClick={() => onTryExample(example)}
            >
              {example}
            </button>
          ))}
        </div>
        <button type="button" className="pbn-strip__dismiss" onClick={onClearSearch}>
          Clear results
        </button>
      </div>
    );
  }

  // 'confirm' is rendered by the dialog, not the strip.
  if (state.kind === 'confirm') return null;

  return (
    <div className="pbn-strip pbn-strip--message" role="status">
      <span className="pbn-strip__text">{state.message}</span>
      <button type="button" className="pbn-strip__dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

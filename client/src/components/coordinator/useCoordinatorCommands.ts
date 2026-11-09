import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { parseCommand, resolveCommand, formatWhen } from './commandParser';
import type {
  AmbiguityOption,
  CommandTechnician,
  ParsedIntent,
} from './commandParser';
import { type StreamFilter } from './streamFilters';
import type { WorkOrder } from './types';
import { shortWorkOrderId } from './labels';
import { coordinatorService } from '../../services/api';

/**
 * What the command bar is showing below the input.
 *
 * Every state is a strip the user can dismiss. The important distinction is
 * between `confirm` (a modal that gates a state change) and `done` (a strip
 * that reports a change already made and offers a real undo).
 */
export type CommandUiState =
  | { kind: 'none' }
  | {
      kind: 'disambiguation';
      slot: 'workOrder' | 'technician';
      query: string;
      options: AmbiguityOption[];
      pending: ParsedIntent;
    }
  | { kind: 'confirm'; plan: ExecutionPlan }
  | {
      kind: 'done';
      message: string;
      /** Null when the action has no server-side revert (it is already durable). */
      onUndo: (() => void) | null;
      undoLabel: string;
      viewWorkOrderId?: string;
    }
  | { kind: 'search'; query: string; count: number }
  | { kind: 'message'; message: string };

export interface ExecutionPlan {
  kind: 'assign' | 'filter' | 'approve_batch';
  title: string;
  /** One sentence, plain language, what will happen (§4.6). */
  consequence: string;
  /** The verb on the confirm button — never "OK". */
  confirmLabel: string;
  destructive: boolean;
  workOrder?: WorkOrder;
  technician?: CommandTechnician;
  when: Date | null;
  filter?: StreamFilter;
  raw: string;
}

export interface UseCoordinatorCommandsArgs {
  workOrders: WorkOrder[];
  technicians: CommandTechnician[];
  /** The filter currently applied to the stream, so a filter command can be undone to it. */
  currentFilter: StreamFilter;
  /** Size of the A2H review queue. Zero until Phase 5 populates it. */
  reviewQueueSize: number;
  onFilterApplied: (filter: StreamFilter) => void;
  /** Refetch the work orders after a server-side change. */
  onWorkOrdersChanged: () => void;
}

/** §4.5: undo is available for 30 seconds. */
const UNDO_WINDOW_MS = 30_000;

export interface CoordinatorCommands {
  input: string;
  setInput: (value: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  submit: (raw?: string) => void;
  confirmPlan: () => void;
  cancelPlan: () => void;
  chooseOption: (option: AmbiguityOption) => void;
  undo: () => void;
  dismiss: () => void;
  clearSearch: () => void;
  state: CommandUiState;
  /** True when the input has text, so the placeholder rotation pauses. */
  hasInput: boolean;
}

export function useCoordinatorCommands(
  args: UseCoordinatorCommandsArgs,
): CoordinatorCommands {
  const {
    workOrders,
    technicians,
    currentFilter,
    reviewQueueSize,
    onFilterApplied,
    onWorkOrdersChanged,
  } = args;

  const [input, setInput] = useState('');
  const [state, setState] = useState<CommandUiState>({ kind: 'none' });
  const inputRef = useRef<HTMLInputElement | null>(null);

  // The filter that was in force before the current command changed it, so
  // Undo can put the stream back the way it was.
  const previousFilterRef = useRef<StreamFilter | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The assignment currently on the strip, so Undo knows what to revert.
  const undoTargetRef = useRef<{ workOrderId: string; technicianId: string } | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearUndoTimer, [clearUndoTimer]);

  const dismiss = useCallback(() => {
    clearUndoTimer();
    undoTargetRef.current = null;
    previousFilterRef.current = null;
    setState({ kind: 'none' });
  }, [clearUndoTimer]);

  const armUndoTimer = useCallback(() => {
    clearUndoTimer();
    undoTimerRef.current = setTimeout(() => {
      // After 30 seconds the window has passed: the strip goes away and the
      // action stands. Nothing is reverted behind the user's back.
      undoTargetRef.current = null;
      previousFilterRef.current = null;
      setState({ kind: 'none' });
    }, UNDO_WINDOW_MS);
  }, [clearUndoTimer]);

  const run = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      const parsed = parseCommand(text);
      if (parsed.status === 'unknown') {
        // §4.5 / requirement (c): an unrecognised command is a search, not an
        // error. No toast, no "did not understand" — just results.
        const filter = { search: text };
        previousFilterRef.current = null;
        onFilterApplied(filter);
        const count = workOrders.filter((workOrder) =>
          `${workOrder.id} ${workOrder.customer?.name ?? ''} ${workOrder.address} ${workOrder.issueType} ${workOrder.description}`
            .toLowerCase()
            .includes(text.toLowerCase()),
        ).length;
        setState({ kind: 'search', query: text, count });
        return;
      }

      const resolution = resolveCommand(parsed.intent, { workOrders, technicians });

      if (resolution.status === 'ambiguous') {
        // Requirement (a): never silently pick. Ask.
        setState({
          kind: 'disambiguation',
          slot: resolution.slot,
          query: resolution.query,
          options: resolution.options,
          pending: resolution.pending,
        });
        return;
      }

      if (resolution.status === 'unresolved') {
        setState({
          kind: 'message',
          message:
            resolution.slot === 'technician'
              ? `We could not find a technician named “${resolution.query}”. Check the spelling, or pick one of the suggestion buttons.`
              : `We could not find a work order matching “${resolution.query}”. Try the work order number or the customer name.`,
        });
        return;
      }

      const command = resolution.command;

      if (command.kind === 'filter') {
        previousFilterRef.current = currentFilter;
        onFilterApplied(command.filter);
        setState({
          kind: 'done',
          message: `Showing ${describeFilterResult(command.filter)}.`,
          onUndo: () => {
            const previous = previousFilterRef.current;
            previousFilterRef.current = null;
            onFilterApplied(previous ?? {});
            setState({ kind: 'none' });
          },
          undoLabel: 'Undo filter',
        });
        armUndoTimer();
        return;
      }

      if (command.kind === 'approve_batch') {
        if (reviewQueueSize === 0) {
          // §4.4's empty review state. The queue itself arrives in Phase 5;
          // the command already behaves correctly against it.
          setState({
            kind: 'message',
            message:
              'Nothing waiting for your review. The AI will send items here when it needs your approval.',
          });
          return;
        }
        setState({
          kind: 'confirm',
          plan: {
            kind: 'approve_batch',
            title: 'Approve these items?',
            consequence: `This will approve ${reviewQueueSize} ${reviewQueueSize === 1 ? 'item' : 'items'} and send them to your customers.`,
            confirmLabel: 'Approve and send',
            destructive: false,
            filter: command.filter,
            raw: command.raw,
            when: null,
          },
        });
        return;
      }

      // assign
      const { workOrder, technician, when } = command;
      const customerName = workOrder.customer?.name ?? 'this customer';
      const whenText = when ? `, scheduled for ${formatWhen(when)},` : '';
      setState({
        kind: 'confirm',
        plan: {
          kind: 'assign',
          title: 'Assign this job?',
          consequence: `This will assign ${customerName} to ${technician.name}${whenText} and send ${technician.name} the details on WhatsApp.`,
          confirmLabel: when ? 'Assign and lock slot' : 'Assign and send',
          destructive: false,
          workOrder,
          technician,
          when,
          raw: text,
        },
      });
    },
    [workOrders, technicians, currentFilter, reviewQueueSize, onFilterApplied, armUndoTimer],
  );

  const submit = useCallback(
    (raw?: string) => {
      run(raw ?? input);
      setInput('');
    },
    [input, run],
  );

  const chooseOption = useCallback(
    (option: AmbiguityOption) => {
      if (state.kind !== 'disambiguation') return;
      const pending = state.pending;
      if (pending.kind !== 'assign') return;

      // Re-run the pending intent with the chosen option pinned, so the user
      // never has to retype the command. Work orders are re-matched by id,
      // technicians by name, because those are the fields each matcher tests.
      const reparsed: ParsedIntent = {
        kind: 'assign',
        workOrderQuery: state.slot === 'workOrder' ? option.id : pending.workOrderQuery,
        technicianQuery: state.slot === 'technician' ? option.label : pending.technicianQuery,
        whenText: pending.whenText,
        when: pending.when,
      };

      const resolution = resolveCommand(reparsed, { workOrders, technicians });
      if (resolution.status !== 'ok' || resolution.command.kind !== 'assign') {
        setState({ kind: 'message', message: 'That did not resolve to a single job. Try again.' });
        return;
      }

      const { workOrder, technician, when } = resolution.command;
      setState({
        kind: 'confirm',
        plan: {
          kind: 'assign',
          title: 'Assign this job?',
          consequence: `This will assign ${workOrder.customer?.name ?? 'this customer'} to ${technician.name}${when ? `, scheduled for ${formatWhen(when)},` : ''} and send ${technician.name} the details on WhatsApp.`,
          confirmLabel: when ? 'Assign and lock slot' : 'Assign and send',
          destructive: false,
          workOrder,
          technician,
          when,
          raw: '',
        },
      });
    },
    [state, workOrders, technicians],
  );

  const confirmPlan = useCallback(async () => {
    if (state.kind !== 'confirm') return;
    const { plan } = state;

    if (plan.kind !== 'assign' || !plan.workOrder || !plan.technician) {
      setState({ kind: 'none' });
      return;
    }

    try {
      // The schedule is part of the command, so it is persisted first; the
      // assign notification then carries it.
      if (plan.when) {
        await coordinatorService.updateWorkOrder(
          plan.workOrder.id,
          { scheduledFor: plan.when.toISOString() },
          `schedule_${plan.workOrder.id}_${Date.now()}`,
        );
      }

      await coordinatorService.assignTechnician(
        plan.workOrder.id,
        { technicianId: plan.technician.id, notifyWhatsApp: true },
        `assign_${plan.workOrder.id}_${Date.now()}`,
      );

      undoTargetRef.current = {
        workOrderId: plan.workOrder.id,
        technicianId: plan.technician.id,
      };
      onWorkOrdersChanged();

      setState({
        kind: 'done',
        message: `Assigned ${shortWorkOrderId(plan.workOrder.id)} to ${plan.technician.name}.`,
        onUndo: () => undo(),
        undoLabel: 'Undo',
        viewWorkOrderId: plan.workOrder.id,
      });
      armUndoTimer();
    } catch {
      setState({
        kind: 'message',
        message:
          'We could not assign that job. Nothing was changed — check your connection and try again.',
      });
    }
  }, [state, onWorkOrdersChanged, armUndoTimer]);

  const cancelPlan = useCallback(() => {
    // Cancel is neutral: it changes nothing on the server.
    setState({ kind: 'none' });
  }, []);

  const undo = useCallback(async () => {
    const target = undoTargetRef.current;
    if (!target) {
      setState({ kind: 'none' });
      return;
    }

    try {
      // Requirement (b): Undo calls the server and removes the assignment.
      // Dismissing the strip is not an undo.
      await coordinatorService.unassignTechnician(
        target.workOrderId,
        { technicianId: target.technicianId },
        `unassign_${target.workOrderId}_${Date.now()}`,
      );
      undoTargetRef.current = null;
      clearUndoTimer();
      onWorkOrdersChanged();
      setState({
        kind: 'message',
        message: 'Assignment removed. The technician is no longer on this job.',
      });
    } catch {
      setState({
        kind: 'message',
        message:
          'We could not remove that assignment. The job is still assigned — please try again.',
      });
    }
  }, [onWorkOrdersChanged, clearUndoTimer]);

  const clearSearch = useCallback(() => {
    onFilterApplied({});
    setState({ kind: 'none' });
  }, [onFilterApplied]);

  return {
    input,
    setInput,
    inputRef,
    submit,
    confirmPlan,
    cancelPlan,
    chooseOption,
    undo,
    dismiss,
    clearSearch,
    state,
    hasInput: input.trim().length > 0,
  };
}

function describeFilterResult(filter: StreamFilter): string {
  if (filter.search) return `results for “${filter.search}”`;
  const parts: string[] = [];
  if (filter.risk) parts.push(`${filter.risk} risk`);
  if (filter.issueType) parts.push(filter.issueType);
  if (filter.timeRange) {
    parts.push(
      filter.timeRange === 'today'
        ? 'today'
        : filter.timeRange === 'tomorrow'
          ? 'tomorrow'
          : 'this week',
    );
  }
  return parts.length > 0 ? parts.join(' ') : 'all work';
}

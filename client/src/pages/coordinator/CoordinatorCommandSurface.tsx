import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import CommandBar from '../../components/coordinator/CommandBar';
import CommandConfirmation from '../../components/coordinator/CommandConfirmation';
import CoordinatorShell from '../../components/coordinator/CoordinatorShell';
import { applyDemoRisk } from '../../components/coordinator/demoRiskProvider';
import { normalizeWorkOrder } from '../../components/coordinator/mappers';
import { applyStreamFilter, EMPTY_FILTER, type StreamFilter } from '../../components/coordinator/streamFilters';
import type { CommandTechnician } from '../../components/coordinator/commandParser';
import type {
  CoordinatorFilter,
  CoordinatorFilterId,
  WorkOrder,
} from '../../components/coordinator/types';
import { useCoordinatorCommands } from '../../components/coordinator/useCoordinatorCommands';
import WorkOrderStream from '../../components/coordinator/WorkOrderStream';
import { coordinatorService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import ManualReviewAlerts from './ManualReviewAlerts';

/**
 * The four former tabs, now filters over one stream (§3). Labels are plain
 * language per §4.1 — "A2H queue" and "Predictive Radar" never reach the UI.
 */
const FILTERS: CoordinatorFilter[] = [
  {
    id: 'dispatch',
    label: 'All work',
    icon: 'clipboard',
    count: null,
    help: 'Every job for your business in one list, so you can see what is coming and what is overdue.',
    description: 'All work: every job for your business',
  },
  {
    id: 'review',
    label: 'Waiting for your review',
    icon: 'inbox',
    count: null,
    help: 'The AI has drafted these but needs your approval before anything is sent to the customer.',
    description: 'Waiting for your review: items the AI drafted that need your approval',
  },
  {
    id: 'radar',
    label: 'Predictions',
    icon: 'activity',
    count: null,
    help: 'Which jobs we think are most likely to run late or go wrong, and the reason why.',
    description: 'Predictions: which jobs are most likely to run late',
  },
  {
    id: 'team',
    label: 'Technicians',
    icon: 'users',
    count: null,
    help: 'Who is on your team, what each person is skilled at, and who is available today.',
    description: 'Technicians: your team and who is available today',
  },
];

const STREAM_COPY: Record<CoordinatorFilterId, { title: string; dateLabel: string }> = {
  // "Today", not "All" — §4.9.
  dispatch: { title: 'Today', dateLabel: '' },
  review: { title: 'Waiting for your review', dateLabel: 'Items that need a decision' },
  radar: { title: 'Predictions', dateLabel: 'Next 7 days' },
  team: { title: 'Technicians', dateLabel: 'Availability today' },
};

function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

/**
 * Route component for `/coordinator`.
 *
 * Rendered full-screen rather than inside `DashboardLayout`: the spec defines
 * this as a three-pane surface with its own top bar and command bar, and the
 * app shell's sidebar would add a fourth column and put the warm-clay palette
 * behind a token set calibrated against `--pbn-bg`. Cross-module navigation
 * for this module is the rail; restoring the app shell is a one-line change
 * here if that trade-off is wrong.
 */
export default function CoordinatorCommandSurface() {
  const businessName = useAuthStore((state) => state.user?.business?.name) ?? 'Your business';
  const [activeFilter, setActiveFilter] = useState<CoordinatorFilterId>('dispatch');

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [technicians, setTechnicians] = useState<CommandTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState<StreamFilter>(EMPTY_FILTER);

  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workOrderResponse, technicianResponse] = await Promise.all([
        coordinatorService.getWorkOrders(),
        coordinatorService.getTechnicians().catch(() => ({ data: { data: [] } })),
      ]);

      const raw: unknown[] = Array.isArray(workOrderResponse.data?.data)
        ? workOrderResponse.data.data
        : [];

      // DEMO_MODE stub only. The real predictive payload arrives in Phase 4
      // and this branch disappears with it.
      setWorkOrders(applyDemoRisk(raw.map(normalizeWorkOrder)));

      const rawTechnicians: unknown[] = Array.isArray(technicianResponse.data?.data)
        ? technicianResponse.data.data
        : [];
      setTechnicians(
        rawTechnicians.map((technician: any) => ({
          id: String(technician.id),
          name: technician.name ?? 'Unknown technician',
          active: Boolean(technician.active),
        })),
      );
    } catch {
      // Plain language, and it says what to do next (§4.7).
      setError('We could not load your work orders. Check your connection, then try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkOrders();
  }, [loadWorkOrders]);

  const copy = STREAM_COPY[activeFilter];
  const selectedWorkOrder = workOrders.find((workOrder) => workOrder.id === selectedId) ?? null;
  const visibleWorkOrders = useMemo(
    () => applyStreamFilter(workOrders, streamFilter),
    [workOrders, streamFilter],
  );

  const commands = useCoordinatorCommands({
    workOrders,
    technicians,
    currentFilter: streamFilter,
    // The A2H review queue arrives in Phase 5; until then the approve command
    // correctly reports that there is nothing waiting.
    reviewQueueSize: 0,
    onFilterApplied: setStreamFilter,
    onWorkOrdersChanged: loadWorkOrders,
  });

  const streamChildren = resolveStreamChildren(
    loading,
    error,
    visibleWorkOrders,
    selectedId,
    setSelectedId,
    loadWorkOrders,
  );

  return (
    <>
      <CoordinatorShell
        businessName={businessName}
        filters={withCounts(FILTERS, workOrders.length)}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onNewWorkOrder={() => {
          /* Phase 4 wires this to the create-work-order form. */
        }}
        onConnectWhatsApp={() => {
          /* Phase 4 wires this to WhatsApp onboarding. */
        }}
        streamTitle={copy.title}
        streamDate={activeFilter === 'dispatch' ? todayLabel() : copy.dateLabel}
        streamCount={visibleWorkOrders.length}
        streamChildren={streamChildren}
        inspectorWorkOrder={selectedWorkOrder}
        onCloseInspector={() => setSelectedId(null)}
        commandBar={
          <CommandBar
            commands={commands}
            onViewWorkOrder={(id) => setSelectedId(id)}
          />
        }
      />
      {commands.state.kind === 'confirm' && (
        <CommandConfirmation
          plan={commands.state.plan}
          onConfirm={() => void commands.confirmPlan()}
          onCancel={commands.cancelPlan}
        />
      )}
      <ManualReviewAlerts />
    </>
  );
}

/**
 * What the centre column shows. `undefined` means "no work orders", which is
 * the signal for `CenterStream` to show the teaching empty state (§4.4).
 */
function resolveStreamChildren(
  loading: boolean,
  error: string | null,
  workOrders: WorkOrder[],
  selectedId: string | null,
  onSelect: (id: string | null) => void,
  onRetry: () => void,
): ReactNode {
  if (loading) {
    return (
      <p className="pbn-stream__message" role="status">
        Loading your work orders…
      </p>
    );
  }

  if (error) {
    return (
      <p className="pbn-stream__message pbn-stream__message--error" role="alert">
        {error}{' '}
        <button type="button" className="pbn-stream__retry" onClick={onRetry}>
          Try again
        </button>
      </p>
    );
  }

  if (workOrders.length === 0) {
    return undefined;
  }

  return <WorkOrderStream workOrders={workOrders} selectedId={selectedId} onSelect={onSelect} />;
}

/**
 * The rail badge reflects the real list. Only "All work" has a number today;
 * the review and predictions counts arrive with the A2H queue and the
 * predictive engine in later phases, and showing a fabricated 0 would be a
 * lie about what is in those views.
 */
function withCounts(filters: CoordinatorFilter[], total: number): CoordinatorFilter[] {
  return filters.map((filter) =>
    filter.id === 'dispatch' ? { ...filter, count: total } : filter,
  );
}

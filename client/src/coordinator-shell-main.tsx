import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import CommandBar from './components/coordinator/CommandBar';
import CommandConfirmation from './components/coordinator/CommandConfirmation';
import CoordinatorShell from './components/coordinator/CoordinatorShell';
import type { CoordinatorFilter } from './components/coordinator/types';
import { applyStreamFilter, EMPTY_FILTER, type StreamFilter } from './components/coordinator/streamFilters';
import { useCoordinatorCommands } from './components/coordinator/useCoordinatorCommands';
import WorkOrderStream from './components/coordinator/WorkOrderStream';
import { TECHNICIAN_FIXTURES, WORK_ORDER_FIXTURES } from './coordinator-fixtures';
import './styles/pbn-tokens.css';
import './styles/coordinator-shell.css';

/**
 * Standalone harness for the command surface.
 *
 * WHY THIS EXISTS
 * ---------------
 * The route at `/coordinator` sits behind Privy, the auth hydration gate and
 * BusinessGuard, so a browser test cannot reach it without a signed-in
 * session. Phase 1 needs the shell verifiable in a real browser — focus order
 * and focus rings are layout behaviour, not logic, and jsdom does not
 * implement tab traversal at all.
 *
 * This entry renders the same `CoordinatorShell` the route renders, with no
 * router and no providers, against a bare document. It is a dev/preview entry:
 * Vite only builds `index.html` for production, so this file never ships.
 *
 * In Phase 2 it becomes the integration-test bed too — pass `streamChildren`
 * real fixtures and the same page exercises the stream and inspector. Append
 * `?fixtures=work-orders` to load four fixture work orders; without it the
 * shell renders the Phase 1 empty state, which is what the keyboard tests
 * assert against.
 */

const FILTERS: CoordinatorFilter[] = [
  {
    id: 'dispatch',
    label: 'All work',
    icon: 'clipboard',
    count: 12,
    help: 'Every job for your business in one list, so you can see what is coming and what is overdue.',
    description: 'All work: every job for your business',
  },
  {
    id: 'review',
    label: 'Waiting for your review',
    icon: 'inbox',
    count: 8,
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
    count: 3,
    help: 'Who is on your team, what each person is skilled at, and who is available today.',
    description: 'Technicians: your team and who is available today',
  },
];

function Preview() {
  // `?fixtures=work-orders` swaps the empty state for four real-shaped work
  // orders, including one whose risk estimate is out of the validated range.
  const useFixtures =
    new URLSearchParams(window.location.search).get('fixtures') === 'work-orders';

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState<StreamFilter>(EMPTY_FILTER);
  const selectedWorkOrder = useFixtures
    ? WORK_ORDER_FIXTURES.find((workOrder) => workOrder.id === selectedId) ?? null
    : null;
  const visibleWorkOrders = useMemo(
    () => applyStreamFilter(WORK_ORDER_FIXTURES, streamFilter),
    [streamFilter],
  );

  const commands = useCoordinatorCommands({
    workOrders: WORK_ORDER_FIXTURES,
    technicians: TECHNICIAN_FIXTURES,
    currentFilter: streamFilter,
    reviewQueueSize: 0,
    onFilterApplied: setStreamFilter,
    onWorkOrdersChanged: () => {
      /* Preview only: assignments are intercepted by the tests. */
    },
  });

  return (
    <>
      <CoordinatorShell
        businessName="A-1 Roofing"
        filters={
          useFixtures
            ? FILTERS.map((filter) =>
                filter.id === 'dispatch' ? { ...filter, count: WORK_ORDER_FIXTURES.length } : filter,
              )
            : FILTERS
        }
        activeFilter="dispatch"
        onFilterChange={() => {
          /* Preview only: the harness asserts layout and focus, not data. */
        }}
        onNewWorkOrder={() => {
          /* Preview only. */
        }}
        onConnectWhatsApp={() => {
          /* Preview only. */
        }}
        streamTitle="Today"
        streamDate="Monday, November 9"
        streamCount={useFixtures ? visibleWorkOrders.length : 0}
        streamChildren={
          useFixtures ? (
            <WorkOrderStream
              workOrders={visibleWorkOrders}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : undefined
        }
        inspectorWorkOrder={selectedWorkOrder}
        onCloseInspector={() => setSelectedId(null)}
        commandBar={
          <CommandBar
            commands={commands}
            disabled={!useFixtures}
            onViewWorkOrder={setSelectedId}
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
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>,
);

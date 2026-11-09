import { PRIORITY_LABEL, shortWorkOrderId } from './labels';
import RiskChip, { RiskChipHelp } from './RiskChip';
import type { WorkOrder } from './types';
import { assignedTechnician } from './types';

export interface WorkOrderCardProps {
  workOrder: WorkOrder;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * One row in the stream.
 *
 * The whole card is a `<button>` so "click any row to see details" (the
 * first-run tour's own words) is literally true and reachable by keyboard.
 * Because a button cannot contain another button, the risk chip's "?" help
 * trigger is rendered as a sibling in the `<li>`, not nested inside.
 *
 * Focus selects. Tabbing through the stream therefore previews each job,
 * which is the behaviour a coordinator scanning 40 orders a day expects, and
 * it is what makes J/K a faster version of Tab rather than a separate model.
 */
export default function WorkOrderCard({ workOrder, selected, onSelect }: WorkOrderCardProps) {
  const technician = assignedTechnician(workOrder);

  return (
    <li className="pbn-work-card__item">
      <button
        type="button"
        className={`pbn-work-card${selected ? ' pbn-work-card--selected' : ''}`}
        aria-pressed={selected}
        data-work-order-id={workOrder.id}
        data-pbn-focus-id={`work-order-${workOrder.id}`}
        onClick={() => onSelect(workOrder.id)}
        onFocus={() => onSelect(workOrder.id)}
      >
        <span className="pbn-work-card__top">
          <span className={`pbn-priority pbn-priority--${workOrder.priority.toLowerCase()}`}>
            {PRIORITY_LABEL[workOrder.priority]}
          </span>
          <span className="pbn-work-card__id">Work order {shortWorkOrderId(workOrder.id)}</span>
        </span>

        <span className="pbn-work-card__body">
          <span className="pbn-work-card__customer">
            {workOrder.customer?.name ?? 'Unknown customer'}
          </span>
          <span className="pbn-work-card__issue">{workOrder.issueType}</span>
        </span>

        <span className="pbn-work-card__meta">
          <span className="pbn-work-card__address">{workOrder.address}</span>
        </span>

        <span className="pbn-work-card__foot">
          <span className="pbn-work-card__tech">
            {technician ? technician.name : 'Not assigned yet'}
          </span>
          {workOrder.risk && <RiskChip assessment={workOrder.risk} help={false} />}
        </span>
      </button>

      {workOrder.risk && (
        <RiskChipHelp assessment={workOrder.risk} focusId={`work-order-${workOrder.id}-help`} />
      )}
    </li>
  );
}

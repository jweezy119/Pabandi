import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { WorkOrder } from './types';
import WorkOrderCard from './WorkOrderCard';

export interface WorkOrderStreamProps {
  workOrders: WorkOrder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * The chronological feed.
 *
 * J and K move between rows (§4.8). They are accelerators, not a replacement
 * for Tab: every row is a real button in the tab order, so a keyboard user who
 * does not know the shortcuts loses nothing.
 */
export default function WorkOrderStream({ workOrders, selectedId, onSelect }: WorkOrderStreamProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const key = event.key.toLowerCase();
    if (key !== 'j' && key !== 'k') return;

    const cards = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-work-order-id]') ?? [],
    );
    if (cards.length === 0) return;

    const index = cards.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;

    const next = key === 'j' ? index + 1 : index - 1;
    if (next < 0 || next >= cards.length) return;

    event.preventDefault();
    cards[next].focus();
  };

  return (
    <ul className="pbn-stream__list" ref={listRef} onKeyDown={onKeyDown} aria-label="Work orders">
      {workOrders.map((workOrder) => (
        <WorkOrderCard
          key={workOrder.id}
          workOrder={workOrder}
          selected={workOrder.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

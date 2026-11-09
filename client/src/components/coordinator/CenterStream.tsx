import type { ReactNode } from 'react';
import { PbnIcon } from './icons';

export interface CenterStreamProps {
  title: string;
  /** Timestamp-style context line. Mono, because it is data not UI. */
  dateLabel: string;
  count: number;
  /**
   * Feed content. When absent the stream shows the teaching empty state —
   * §4.4 requires an empty state that explains what will appear here and
   * offers the two ways to make it happen.
   */
  children?: ReactNode;
  onNewWorkOrder: () => void;
  onConnectWhatsApp: () => void;
  newWorkOrderDisabled?: boolean;
  connectWhatsAppDisabled?: boolean;
}

export default function CenterStream({
  title,
  dateLabel,
  count,
  children,
  onNewWorkOrder,
  onConnectWhatsApp,
  newWorkOrderDisabled = false,
  connectWhatsAppDisabled = false,
}: CenterStreamProps) {
  const isEmpty = children == null;

  return (
    <div className="pbn-stream">
      <header className="pbn-stream__header">
        <div>
          <h1 className="pbn-stream__title">{title}</h1>
          <p className="pbn-stream__meta">{dateLabel}</p>
        </div>
        <span className="pbn-stream__count">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </header>

      {isEmpty ? (
        <div className="pbn-empty">
          <span className="pbn-empty__art" aria-hidden="true">
            <PbnIcon name="inbox" size={56} />
          </span>
          <h2 className="pbn-empty__title">No work orders yet</h2>
          <p className="pbn-empty__text">
            When a customer messages you on WhatsApp, they will appear here. Or
            click &ldquo;New work order&rdquo; to add one manually.
          </p>
          <div className="pbn-empty__actions">
            <button
              type="button"
              className="pbn-btn pbn-btn--primary"
              onClick={onNewWorkOrder}
              disabled={newWorkOrderDisabled}
              data-pbn-focus-id="stream-new"
            >
              <PbnIcon name="plus" size={16} />
              New work order
            </button>
            <button
              type="button"
              className="pbn-btn pbn-btn--ghost"
              onClick={onConnectWhatsApp}
              disabled={connectWhatsAppDisabled}
              data-pbn-focus-id="stream-connect"
            >
              <PbnIcon name="message" size={16} />
              Connect WhatsApp
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

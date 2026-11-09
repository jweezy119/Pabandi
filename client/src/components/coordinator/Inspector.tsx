import type { ReactNode } from 'react';
import { PbnIcon } from './icons';
import {
  attachmentLabel,
  formatDate,
  formatTimestamp,
  INVOICE_LABEL,
  PRIORITY_LABEL,
  shortWorkOrderId,
  STATUS_LABEL,
} from './labels';
import RiskChip from './RiskChip';
import Tooltip from './Tooltip';
import { assignedTechnician, type HitlPolicy, type RiskFactor, type WorkOrder } from './types';
import WhatIfStrip from './WhatIfStrip';

/**
 * What the HITL matrix's decision means for this job, in one sentence each.
 * §5 defines the matrix; this is the plain-language reading of it (§4.1).
 */
const POLICY_LINE: Record<HitlPolicy, string> = {
  AUTONOMOUS: 'Low risk, so we can handle this one and will record what we did.',
  ASSISTED: 'We will prepare this and ask you to confirm before anything is sent.',
  HUMAN_MANDATORY: 'This one needs a person to decide, and we will show you the evidence.',
};

export interface InspectorProps {
  /**
   * True on a phone, where the inspector is a full-screen sheet that appears
   * only when a row is selected. On a wide screen it is a persistent pane.
   */
  isMobile: boolean;
  /** The selected work order, or null for the teaching empty state (§4.4). */
  workOrder: WorkOrder | null;
  onClose: () => void;
}

/**
 * The right-hand inspector.
 *
 * Two presentations, one component. On a wide screen the pane is always
 * present and shows the empty state until a row is selected — §4.4 requires
 * that empty state to exist and to explain what selection will bring. On a
 * phone the pane is off-canvas until a row is selected, then becomes a
 * full-screen sheet; `visibility: hidden` in CSS keeps the closed sheet out of
 * the tab order, which `display: none` alone would not do for the transition.
 *
 * The close button appears whenever something is selected, on both layouts:
 * §4.8 says every shortcut must also be available as a visible control, so
 * "Esc closes the inspector" needs a button equivalent.
 */
export default function Inspector({ isMobile, workOrder, onClose }: InspectorProps) {
  const sheetOpen = isMobile && workOrder != null;
  const dismissible = workOrder != null;

  return (
    <aside
      className={`pbn-inspector${sheetOpen ? ' pbn-inspector--open' : ''}`}
      aria-label="Work order details"
    >
      <header className="pbn-inspector__header">
        <h2 className="pbn-inspector__title">Details</h2>
        {dismissible && (
          <button
            type="button"
            className="pbn-icon-btn"
            onClick={onClose}
            aria-label="Close details"
            data-pbn-focus-id="inspector-close"
          >
            <PbnIcon name="close" size={16} />
          </button>
        )}
      </header>
      <div className="pbn-inspector__body">
        {workOrder ? <InspectorDetail workOrder={workOrder} /> : <InspectorEmptyState />}
      </div>
    </aside>
  );
}

function InspectorEmptyState() {
  return (
    <div className="pbn-inspector__hint">
      <span className="pbn-empty__art" aria-hidden="true">
        <PbnIcon name="clipboard" size={32} />
      </span>
      <p className="pbn-inspector__hint-title">Nothing selected</p>
      <p className="pbn-inspector__hint-text">
        Select a work order to see details, timing, and why we scored it the way
        we did.
      </p>
    </div>
  );
}

/**
 * The full detail view. Organised as who / what / when / why / evidence,
 * because that is the order a coordinator reads a job in (§9).
 */
function InspectorDetail({ workOrder }: { workOrder: WorkOrder }) {
  const technician = assignedTechnician(workOrder);

  return (
    <div className="pbn-inspector__detail">
      <div className="pbn-inspector__heading">
        <span className="pbn-inspector__wo-id">Work order {shortWorkOrderId(workOrder.id)}</span>
        <span className={`pbn-status pbn-status--${workOrder.status.toLowerCase()}`}>
          {STATUS_LABEL[workOrder.status]}
        </span>
      </div>

      {workOrder.risk && (
        <section className="pbn-inspector__section" aria-labelledby="pbn-risk-heading">
          <h3 className="pbn-inspector__section-title" id="pbn-risk-heading">
            Risk
          </h3>
          <RiskChip assessment={workOrder.risk} />
          {workOrder.risk.policy && (
            <p className="pbn-inspector__policy">{POLICY_LINE[workOrder.risk.policy]}</p>
          )}
          {workOrder.risk.calibrated === false && (
            <p className="pbn-inspector__note">
              We have not scored enough of your jobs yet to fully trust this number. It gets
              more accurate as more jobs are completed.
            </p>
          )}
        </section>
      )}

      <section className="pbn-inspector__section" aria-labelledby="pbn-detail-heading">
        <h3 className="pbn-inspector__section-title" id="pbn-detail-heading">
          The job
        </h3>
        <dl className="pbn-inspector__fields">
          <Field label="Customer">{workOrder.customer?.name ?? 'Unknown customer'}</Field>
          <Field label="Address">{workOrder.address || '—'}</Field>
          <Field label="Issue">{workOrder.issueType}</Field>
          <Field label="Priority">{PRIORITY_LABEL[workOrder.priority]}</Field>
          <Field label="Scheduled for">{formatTimestamp(workOrder.scheduledFor)}</Field>
          <Field label="Technician">{technician ? technician.name : 'Not assigned yet'}</Field>
          <Field label="Invoice">{INVOICE_LABEL[workOrder.invoiceStatus]}</Field>
          <Field label="Created">{formatDate(workOrder.createdAt)}</Field>
          {workOrder.accessNotes && <Field label="Access notes">{workOrder.accessNotes}</Field>}
        </dl>
        {workOrder.description && (
          <p className="pbn-inspector__description">{workOrder.description}</p>
        )}
      </section>

      {workOrder.risk && workOrder.risk.factors.length > 0 && (
        <section className="pbn-inspector__section" aria-labelledby="pbn-why-heading">
          <h3 className="pbn-inspector__section-title" id="pbn-why-heading">
            Why this score
            <Tooltip
              text="The reasons behind the number, starting with the one that matters most."
              label="What does 'Why this score' mean?"
            />
          </h3>
          <ul className="pbn-factors">
            {[...workOrder.risk.factors]
              .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
              .map((factor) => (
                <FactorRow
                  key={factor.factor}
                  factor={factor}
                  maxImpact={Math.max(
                    ...workOrder.risk!.factors.map((item) => Math.abs(item.impact)),
                    0.0001,
                  )}
                />
              ))}
          </ul>
        </section>
      )}

      {workOrder.risk?.features && (
        <WhatIfStrip workOrderId={workOrder.id} features={workOrder.risk.features} />
      )}

      <section className="pbn-inspector__section" aria-labelledby="pbn-evidence-heading">
        <h3 className="pbn-inspector__section-title" id="pbn-evidence-heading">
          Evidence
        </h3>
        {workOrder.attachments.length > 0 ? (
          <ul className="pbn-evidence">
            {workOrder.attachments.map((attachment) => (
              <li key={attachment.id} className="pbn-evidence__item">
                <a
                  className="pbn-evidence__link"
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <PbnIcon name="clipboard" size={14} />
                  {attachmentLabel(attachment.kind)}
                  <span className="pbn-evidence__date">
                    {formatTimestamp(attachment.createdAt)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pbn-inspector__hint-text">No photos or documents yet.</p>
        )}
        <p className="pbn-inspector__audit">
          {workOrder.auditCount} recorded {workOrder.auditCount === 1 ? 'event' : 'events'} on
          the audit trail.
        </p>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pbn-inspector__field">
      <dt className="pbn-inspector__field-label">{label}</dt>
      <dd className="pbn-inspector__field-value">{children}</dd>
    </div>
  );
}

/**
 * One explanation bar. The bar is decorative — the sentence carries the
 * meaning — so it is `aria-hidden` and the text is the accessible content.
 */
function FactorRow({ factor, maxImpact }: { factor: RiskFactor; maxImpact: number }) {
  const raises = factor.impact >= 0;
  const width = Math.max(6, Math.round((Math.abs(factor.impact) / maxImpact) * 100));

  return (
    <li className="pbn-factor">
      <span
        className={`pbn-factor__bar pbn-factor__bar--${raises ? 'raises' : 'lowers'}`}
        style={{ width: `${width}%` }}
        aria-hidden="true"
      />
      <span className="pbn-factor__text">{factor.plainLanguage}</span>
    </li>
  );
}

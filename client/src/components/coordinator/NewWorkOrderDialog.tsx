import { useEffect, useRef, useState } from 'react';
import { coordinatorService } from '../../services/api';

/**
 * Create a work order.
 *
 * This exists because the empty state told the owner to click "New work order"
 * and the button did nothing — the handler was a Phase 4 placeholder. The
 * endpoint (POST /coordinator/work-orders) was already there and working; only
 * the surface was missing.
 *
 * The customer field offers the business's existing customers, and lets them add
 * one inline. That matters because bookings create CrmClient rows, not Customer
 * rows, so a shop that has taken bookings through /book/:id can still have an
 * empty customer list here.
 */

interface CustomerOption {
  id: string;
  name: string;
  address?: string | null;
}

interface NewWorkOrderDialogProps {
  onCreated: () => void;
  onCancel: () => void;
}

const PRIORITIES = [
  { value: 'EMERGENCY', label: 'Emergency', hint: 'Someone is at risk, or the property is damaged right now.' },
  { value: 'URGENT', label: 'Urgent', hint: 'Needs doing today or tomorrow.' },
  { value: 'ROUTINE', label: 'Routine', hint: 'Normal scheduling.' },
] as const;

const ISSUE_SUGGESTIONS = ['Leak', 'Repair', 'Inspection', 'Maintenance', 'Install', 'Diagnosis'];

export default function NewWorkOrderDialog({ onCreated, onCancel }: NewWorkOrderDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerChoice, setCustomerChoice] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const [issueType, setIssueType] = useState('');
  const [priority, setPriority] = useState<string>('ROUTINE');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [accessNotes, setAccessNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coordinatorService
      .getCustomers()
      .then((res) => {
        const raw: any[] = Array.isArray(res.data?.data) ? res.data.data : [];
        setCustomers(raw.map((c) => ({ id: String(c.id), name: c.name, address: c.address })));
      })
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
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

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      returnFocusRef.current?.focus();
    };
  }, [onCancel]);

  const submit = async () => {
    setError(null);

    if (!issueType.trim()) return setError('Say what the job is, in a few words.');
    if (description.trim().length < 3) return setError('Describe the problem so the technician knows what to bring.');
    if (address.trim().length < 3) return setError('Enter the address where the work happens.');

    let customerId = customerChoice;
    if (isNewCustomer) {
      if (!newCustomerName.trim()) return setError('Enter the customer’s name.');
      try {
        const created = await coordinatorService.createCustomer(
          { name: newCustomerName.trim(), address: address.trim() },
          crypto.randomUUID(),
        );
        customerId = String(created.data?.data?.id ?? '');
        if (!customerId) return setError('The customer was not saved. Please try again.');
      } catch (err: any) {
        return setError(err?.response?.data?.error || 'Could not save this customer. Please try again.');
      }
    }
    if (!customerId) return setError('Choose a customer, or add a new one.');

    setSubmitting(true);
    try {
      await coordinatorService.createWorkOrder(
        {
          customerId,
          issueType: issueType.trim(),
          priority,
          description: description.trim(),
          address: address.trim(),
          accessNotes: accessNotes.trim() || undefined,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        },
        crypto.randomUUID(),
      );
      onCreated();
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.details?.description?.[0]?.message ||
          'Could not save this work order. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="pbn-dialog"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="pbn-dialog__panel pbn-dialog__panel--wide"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pbn-new-order-title"
      >
        <div className="pbn-dialog__header">
          <h2 className="pbn-dialog__title" id="pbn-new-order-title">
            New work order
          </h2>
          <p className="pbn-dialog__subtitle">
            Write down a job and it appears in your stream, ready to assign.
          </p>
        </div>

        <div className="pbn-dialog__body">
          {error && (
            <p role="alert" className="pbn-dialog__error">
              {error}
            </p>
          )}

          <label className="pbn-field">
            <span className="pbn-field__label">Customer</span>
            {customers.length > 0 && !isNewCustomer ? (
              <>
                <select
                  className="pbn-field__input"
                  value={customerChoice}
                  onChange={(e) => setCustomerChoice(e.target.value)}
                >
                  <option value="">Choose a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.address ? ` — ${c.address}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="pbn-field__toggle"
                  onClick={() => {
                    setIsNewCustomer(true);
                    setCustomerChoice('');
                  }}
                >
                  Add a new customer
                </button>
              </>
            ) : (
              <>
                <input
                  className="pbn-field__input"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Customer’s name"
                  aria-label="New customer’s name"
                />
                {customers.length > 0 && (
                  <button
                    type="button"
                    className="pbn-field__toggle"
                    onClick={() => {
                      setIsNewCustomer(false);
                      setNewCustomerName('');
                    }}
                  >
                    Choose someone already here
                  </button>
                )}
              </>
            )}
          </label>

          <label className="pbn-field">
            <span className="pbn-field__label">What is the job?</span>
            <input
              className="pbn-field__input"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              placeholder="e.g. Leak under the sink"
            />
            <span className="pbn-field__hints">
              {ISSUE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pbn-field__chip"
                  onClick={() => setIssueType(s)}
                >
                  {s}
                </button>
              ))}
            </span>
          </label>

          <fieldset className="pbn-field">
            <legend className="pbn-field__label">How urgent is it?</legend>
            <div className="pbn-field__hints">
              {PRIORITIES.map((p) => (
                <label key={p.value} className="pbn-field__chip pbn-field__chip--choice">
                  <input
                    type="radio"
                    name="priority"
                    value={p.value}
                    checked={priority === p.value}
                    onChange={() => setPriority(p.value)}
                  />
                  <span>
                    <strong>{p.label}</strong>
                    <small>{p.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="pbn-field">
            <span className="pbn-field__label">What is wrong?</span>
            <textarea
              className="pbn-field__input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Enough detail that the technician knows what to bring."
            />
          </label>

          <label className="pbn-field">
            <span className="pbn-field__label">Where is the work?</span>
            <input
              className="pbn-field__input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
            />
          </label>

          <label className="pbn-field">
            <span className="pbn-field__label">When should it happen? (optional)</span>
            <input
              className="pbn-field__input"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </label>

          <label className="pbn-field">
            <span className="pbn-field__label">Anything the technician should know? (optional)</span>
            <input
              className="pbn-field__input"
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              placeholder="e.g. Side gate code 4127, dog in the yard"
            />
          </label>
        </div>

        <div className="pbn-dialog__actions">
          <button ref={cancelRef} type="button" className="pbn-btn pbn-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="pbn-btn pbn-btn--primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save work order'}
          </button>
        </div>
      </div>
    </div>
  );
}

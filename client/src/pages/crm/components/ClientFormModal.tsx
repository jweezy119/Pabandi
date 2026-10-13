import { useState } from 'react';
import { Input, Button } from '../../../components/primitives';
import ClaySelect from './ClaySelect';
import CustomFieldsRenderer, { type CustomField } from './CustomFieldsRenderer';
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_HELP,
  isClientStatus,
  validateEmailField,
  validateNameField,
  type ClientStatus,
} from '@shared/crm';

/** The shape the form edits and submits. Kept explicit so the handlers can be typed. */
interface ClientForm {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  status: string;
  customData: Record<string, unknown>;
}

interface ClientFormModalProps {
  /**
   * A save failure, shown in the form.
   *
   * The form used to close on a failed write and print the reason to the console,
   * so a customer pressing Save on a 403 saw the dialog close and nothing happen.
   */
  error?: string | null;
  client?: ClientForm | null;
  onClose: () => void;
  onSave: (form: ClientForm) => void;
  customFields?: CustomField[];
}

/**
 * Status options come from the shared vocabulary, which is the same list the
 * server validates against. This used to be a private copy here, a second one in
 * the CSV importer and a third the schema only documented — and the server used to
 * ignore the field entirely, so none of them mattered. Now it does.
 *
 * `help` is shown under the selected status rather than as a tooltip. AT_RISK and
 * INACTIVE sound like system verdicts, and a person who does not know that
 * AT_RISK is something *they* mark will leave it alone and wonder why the client
 * never appears anywhere.
 */
const STATUS_OPTIONS = CLIENT_STATUSES.map((value) => ({
  value,
  label: CLIENT_STATUS_LABELS[value],
  icon:
    value === 'ACTIVE' ? '✅'
    : value === 'AT_RISK' ? '⚠️'
    : value === 'VIP' ? '⭐'
    : '💤',
}));

export default function ClientFormModal({ client, onClose, onSave, customFields, error }: ClientFormModalProps) {
  const [form, setForm] = useState<ClientForm>(client || {
    id: '', name: '', email: '', phone: '', company: '', notes: '', status: 'ACTIVE', customData: {}
  });

  /**
   * Which field is complaining, and why.
   *
   * Set on blur rather than on every keystroke. Validating while someone is still
   * typing "ayesha@ex" is how you get a form that shouts at someone who is
   * mid-word — and it is the reason many people learn to ignore the red text.
   *
   * Checked again on submit, so a field they never blurred cannot slip through:
   * clicking straight from an empty name to Save is exactly the case worth
   * catching.
   */
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const { name, email } = form;

  const handleChange = <K extends keyof ClientForm>(field: K, value: ClientForm[K]) => {
    setForm((p) => ({ ...p, [field]: value }));
    // Clear a complaint the moment they start fixing it, so the message tracks the
    // field rather than lingering over a value that is now fine.
    if (fieldError?.field === field) setFieldError(null);
  };

  const handleCustomChange = (fieldId: string, value: unknown) => setForm((p) => ({
    ...p, customData: { ...p.customData, [fieldId]: value }
  }));

  const validate = () => {
    const nameProblem = validateNameField(name);
    if (nameProblem) { setFieldError({ field: 'name', message: nameProblem }); return false; }
    const emailProblem = validateEmailField(email);
    if (emailProblem) { setFieldError({ field: 'email', message: emailProblem }); return false; }
    return true;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  const { status } = form;
  const knownStatus = isClientStatus(status) ? (status as ClientStatus) : null;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Input
        label="Full Name"
        required
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
        onBlur={validate}
        hint={fieldError?.field === 'name' ? undefined : 'What the invoice is addressed to.'}
        error={fieldError?.field === 'name' ? fieldError.message : undefined}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          // autoCapitalize/spellCheck off: the browser "helpfully" capitalising an
          // address is a well-known way to make one undeliverable.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('email', e.target.value)}
          onBlur={validate}
          hint={fieldError?.field === 'email' ? undefined : 'Where invoices and reminders go.'}
          error={fieldError?.field === 'email' ? fieldError.message : undefined}
        />
        <Input
          label="Phone"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('phone', e.target.value)}
          hint="Used for reminders. Any format."
        />
      </div>

      <Input
        label="Company"
        value={form.company}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('company', e.target.value)}
        hint="Only if they have one."
      />

      <ClaySelect
        label="Status"
        value={status}
        onChange={(v) => handleChange('status', v)}
        options={STATUS_OPTIONS}
      />
      {knownStatus && (
        <p className="-mt-2 text-xs" style={{ color: 'var(--soft-stone)' }}>
          {CLIENT_STATUS_HELP[knownStatus]}
        </p>
      )}

      <Input
        label="Notes"
        textarea
        rows={3}
        value={form.notes}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('notes', e.target.value)}
        hint="Anything you would want to know before picking up the phone."
      />

      {customFields && customFields.length > 0 && (
        <div className="mt-4 border-t pt-4 border-[rgba(191,179,163,0.3)]">
          <h4 className="text-sm font-bold text-[var(--warm-ink)] mb-3">Custom Fields</h4>
          <CustomFieldsRenderer
            fields={customFields}
            values={form.customData}
            onChange={handleCustomChange}
          />
        </div>
      )}

      {/* Placed immediately above the actions, so a failed save is read before the
          button the customer just pressed — not on another screen, and not in the
          console. */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{ background: 'var(--danger-container, #FCE8E6)', color: 'var(--on-danger-container, #8C1D18)' }}
        >
          <span className="material-symbols-outlined text-[18px] shrink-0 mt-px">error</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3 pt-4 justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit">{client ? 'Save Changes' : 'Add Client'}</Button>
      </div>
    </form>
  );
}
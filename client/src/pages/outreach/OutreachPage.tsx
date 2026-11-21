import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/api';

/**
 * Outreach — a business reaching its own customers.
 *
 * Three steps on purpose: audience, message, send. The preview before send is the
 * part that matters. An owner who can see "47 people, here are the first five"
 * does not accidentally email a list they did not mean to.
 *
 * Wording targets a business owner with no CRM experience: no "segment" without a
 * plain sentence beside it, no "campaign" without saying what it is.
 */

interface Template {
  id: string;
  label: string;
  emoji: string;
  subject: string;
  body: string;
}

interface Segment {
  id: string;
  label: string;
  description: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  stage?: string | null;
  lastJobAt?: string | null;
  totalSpent?: number;
}

const STEPS = ['Audience', 'Message', 'Send'] as const;

export default function OutreachPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState('lapsed');
  const [templateId, setTemplateId] = useState('win_back');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [audienceTotal, setAudienceTotal] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sentCount: number; failedCount: number } | null>(null);

  useEffect(() => {
    apiClient
      .get('/outreach/templates')
      .then((res) => {
        const data = res.data?.data ?? res.data ?? {};
        setTemplates(data.templates ?? []);
        setSegments(data.segments ?? []);
      })
      .catch(() => setError('Could not load outreach templates. Check your connection and try again.'));
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId],
  );

  // Prefill the message when a template is picked, but only until the owner edits
  // it — overwriting their wording because they switched templates is hostile.
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (edited || !selectedTemplate) return;
    setSubject(selectedTemplate.subject);
    setBody(selectedTemplate.body);
  }, [selectedTemplate, edited]);

  // Live audience count. Recomputed when the segment changes, not on every render.
  useEffect(() => {
    setAudienceLoading(true);
    apiClient
      .get(`/outreach/campaigns/preview-recipients?segment=${encodeURIComponent(segmentId)}`)
      .then((res) => {
        const data = res.data?.data ?? res.data ?? {};
        setRecipients(data.recipients ?? []);
        setAudienceTotal(data.total ?? 0);
      })
      .catch(() => {
        setRecipients([]);
        setAudienceTotal(null);
      })
      .finally(() => setAudienceLoading(false));
  }, [segmentId]);

  const canSend = audienceTotal !== null && audienceTotal > 0 && body.trim().length > 0 && !sending;

  const send = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Give this outreach a name so you can recognise it later.');
      return;
    }
    setSending(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const createRes = await apiClient.post('/outreach/campaigns', {
        name: name.trim(),
        subject: subject.trim(),
        body,
        segment: segmentId,
      });
      const campaignId = createRes.data?.data?.id ?? createRes.data?.id;
      if (!campaignId) throw new Error('The outreach was not created. Please try again.');

      const sendRes = await apiClient.post(`/outreach/campaigns/${campaignId}/send`, null, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      const data = sendRes.data?.data ?? {};
      setResult({ sentCount: data.sentCount ?? 0, failedCount: data.failedCount ?? 0 });
      setStep(2);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Could not send. Check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: '46rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 .25rem' }}>Reach your customers</h1>
      <p style={{ color: 'var(--soft-stone, #666)', margin: '0 0 1.5rem', fontSize: '.9375rem' }}>
        Email people who have already used you. No list to buy, no import — everyone here is
        already your customer.
      </p>

      <ol style={{ display: 'flex', gap: '.5rem', listStyle: 'none', padding: 0, margin: '0 0 2rem' }}>
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            style={{
              fontSize: '.8125rem',
              fontWeight: i === step ? 700 : 500,
              padding: '.375rem .875rem',
              borderRadius: '999px',
              background: i === step ? 'var(--clay, #b8693f)' : 'rgba(0,0,0,0.06)',
              color: i === step ? '#fff' : 'inherit',
            }}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && (
        <div
          role="alert"
          style={{
            padding: '.75rem 1rem',
            borderRadius: '.75rem',
            background: '#FCE8E6',
            color: '#8C1D18',
            fontSize: '.875rem',
            marginBottom: '1.25rem',
          }}
        >
          {error}
        </div>
      )}

      {step === 0 && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '.25rem' }}>
            Who should get this?
          </legend>
          <p style={{ color: 'var(--soft-stone, #666)', fontSize: '.875rem', margin: '0 0 1rem' }}>
            {audienceLoading
              ? 'Counting your customers…'
              : audienceTotal === null
                ? 'We could not count this group yet.'
                : `${audienceTotal} ${audienceTotal === 1 ? 'person' : 'people'} will get this.`}
          </p>

          <div style={{ display: 'grid', gap: '.625rem' }}>
            {segments.map((segment) => (
              <label
                key={segment.id}
                style={{
                  display: 'block',
                  padding: '.875rem 1rem',
                  borderRadius: '.875rem',
                  border: `1px solid ${segmentId === segment.id ? 'var(--clay, #b8693f)' : 'rgba(0,0,0,0.12)'}`,
                  background: segmentId === segment.id ? 'rgba(184,105,63,0.08)' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="segment"
                  value={segment.id}
                  checked={segmentId === segment.id}
                  onChange={() => setSegmentId(segment.id)}
                  style={{ marginRight: '.625rem' }}
                />
                <strong>{segment.label}</strong>
                <span style={{ color: 'var(--soft-stone, #666)', fontSize: '.875rem' }}>
                  {' '}
                  — {segment.description}
                </span>
              </label>
            ))}
          </div>

          {recipients.length > 0 && (
            <p style={{ color: 'var(--soft-stone, #666)', fontSize: '.8125rem', marginTop: '1rem' }}>
              First few: {recipients.slice(0, 5).map((r) => r.name).join(', ')}
              {recipients.length > 5 ? '…' : ''}
            </p>
          )}

          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={audienceTotal === null || audienceTotal === 0}
            style={primaryButton(!canProceed(audienceTotal))}
          >
            Continue
          </button>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '1rem' }}>
            What should it say?
          </legend>

          <label htmlFor="outreach-name" style={labelStyle}>
            Name this outreach
          </label>
          <input
            id="outreach-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. November rebook"
            style={inputStyle}
          />
          <p style={hintStyle}>Only you see this. It is so you recognise it later.</p>

          <label htmlFor="outreach-template" style={labelStyle}>
            Start from
          </label>
          <select
            id="outreach-template"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setEdited(false);
            }}
            style={inputStyle}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>

          <label htmlFor="outreach-subject" style={labelStyle}>
            Subject
          </label>
          <input
            id="outreach-subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setEdited(true);
            }}
            style={inputStyle}
          />

          <label htmlFor="outreach-body" style={labelStyle}>
            Message
          </label>
          <textarea
            id="outreach-body"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setEdited(true);
            }}
            rows={9}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
          <p style={hintStyle}>
            {'{businessName}'} and {'{clientName}'} are replaced with the real names when it sends.
          </p>

          <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setStep(0)} style={secondaryButton}>
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!body.trim()}
              style={primaryButton(!body.trim())}
            >
              Review and send
            </button>
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <div>
          {result ? (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '.5rem' }}>
                Sent
              </h2>
              <p style={{ margin: '0 0 1.5rem' }}>
                {result.sentCount} sent
                {result.failedCount > 0 ? `, ${result.failedCount} failed` : ''}.
              </p>
              <button type="button" onClick={() => navigate('/contact')} style={primaryButton(false)}>
                Back to my CRM
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '.5rem' }}>
                Ready to send
              </h2>
              <p style={{ margin: '0 0 .25rem' }}>
                <strong>{audienceTotal}</strong> {audienceTotal === 1 ? 'person' : 'people'} will
                get this.
              </p>
              <p style={{ color: 'var(--soft-stone, #666)', fontSize: '.875rem', margin: '0 0 1rem' }}>
                Subject: {subject || '(no subject)'}
              </p>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: '.875rem',
                  background: 'rgba(0,0,0,0.04)',
                  padding: '1rem',
                  borderRadius: '.75rem',
                  margin: '0 0 1.5rem',
                }}
              >
                {body}
              </pre>
              <div style={{ display: 'flex', gap: '.75rem' }}>
                <button type="button" onClick={() => setStep(1)} style={secondaryButton} disabled={sending}>
                  Back
                </button>
                <button type="button" onClick={send} disabled={!canSend} style={primaryButton(!canSend)}>
                  {sending ? 'Sending…' : `Send to ${audienceTotal}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function canProceed(total: number | null) {
  return total !== null && total > 0;
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '.8125rem',
  fontWeight: 600,
  margin: '1.25rem 0 .375rem',
};

const hintStyle: CSSProperties = {
  color: 'var(--soft-stone, #666)',
  fontSize: '.75rem',
  margin: '.375rem 0 0',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '.625rem .75rem',
  borderRadius: '.625rem',
  border: '1px solid rgba(0,0,0,0.15)',
  fontSize: '.9375rem',
  font: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
  color: 'inherit',
};

const primaryButton = (disabled: boolean): CSSProperties => ({
  marginTop: '1.5rem',
  padding: '.875rem 1.25rem',
  borderRadius: '.75rem',
  border: 0,
  background: disabled ? 'rgba(0,0,0,0.2)' : 'var(--clay, #b8693f)',
  color: '#fff',
  fontWeight: 700,
  fontSize: '.9375rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  font: 'inherit',
});

const secondaryButton: CSSProperties = {
  marginTop: '1.5rem',
  padding: '.875rem 1.25rem',
  borderRadius: '.75rem',
  border: '1px solid rgba(0,0,0,0.15)',
  background: 'transparent',
  fontWeight: 600,
  fontSize: '.9375rem',
  cursor: 'pointer',
  font: 'inherit',
};

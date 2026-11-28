import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Button, Card, Input } from '../../../components/primitives';
import { getAuthToken } from '../../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

export function ChannelsSettingsPage() {
  const [mail, setMail] = useState<any>(null);
  const [calendar, setCalendar] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const businessId = localStorage.getItem('businessId') || '';

  const [mailForm, setMailForm] = useState({
    email: '', imapHost: '', imapPort: '993', imapPassword: '',
    smtpHost: '', smtpPort: '587', smtpPassword: '',
  });
  const [calForm, setCalForm] = useState({ name: 'Calendar', calendarUrl: '', username: '', password: '' });

  const load = useCallback(async () => {
    try {
      const [m, c, inbox] = await Promise.all([
        fetch(`${API_BASE}/api/v1/channels/mail`, { headers: headers() }),
        fetch(`${API_BASE}/api/v1/channels/calendar`, { headers: headers() }),
        fetch(`${API_BASE}/api/v1/channels/${businessId}/messages?channel=EMAIL`, { headers: headers() }),
      ]);
      if (m.ok) setMail((await m.json()).data);
      if (c.ok) setCalendar((await c.json()).data);
      if (inbox.ok) setMessages((await inbox.json()).data || []);
    } catch {
      setError('Could not load channel settings.');
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const save = async (path: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/channels/${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch {
      setError('Could not save. Check the details and try again.');
    } finally { setBusy(false); }
  };

  const sync = async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/v1/channels/sync`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ businessId }),
      });
      await load();
    } catch { setError('Sync failed.'); } finally { setBusy(false); }
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Email & calendar</h1>
          <p className="text-sm text-[var(--soft-stone)]">Bring conversations and meetings onto your client records. Passwords are encrypted at rest.</p>
        </div>
        {error && <p className="text-sm text-[var(--dusty-rose)]">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[var(--warm-ink)]">📬 Mailbox (IMAP)</h2>
              {mail && <span className="text-xs text-[var(--sage)]">Connected · {mail.email}</span>}
            </div>
            <Input label="Email" value={mailForm.email} onChange={(e: any) => setMailForm({ ...mailForm, email: e.target.value })} />
            <Input label="IMAP host" value={mailForm.imapHost} onChange={(e: any) => setMailForm({ ...mailForm, imapHost: e.target.value })} placeholder="imap.example.com" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="IMAP port" type="number" value={mailForm.imapPort} onChange={(e: any) => setMailForm({ ...mailForm, imapPort: e.target.value })} />
              <Input label="Password / app password" type="password" value={mailForm.imapPassword} onChange={(e: any) => setMailForm({ ...mailForm, imapPassword: e.target.value })} />
            </div>
            <Input label="SMTP host (for sending)" value={mailForm.smtpHost} onChange={(e: any) => setMailForm({ ...mailForm, smtpHost: e.target.value })} />
            <Button variant="primary" disabled={busy || !mailForm.email || !mailForm.imapHost || !mailForm.imapPassword} onClick={() => save('mail', { ...mailForm, businessId })}>
              Save mailbox
            </Button>
            {mail?.lastError && <p className="text-xs text-[var(--dusty-rose)]">Last error: {mail.lastError}</p>}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[var(--warm-ink)]">📅 Calendar (CalDAV)</h2>
              {calendar && <span className="text-xs text-[var(--sage)]">Connected · {calendar.name}</span>}
            </div>
            <Input label="Name" value={calForm.name} onChange={(e: any) => setCalForm({ ...calForm, name: e.target.value })} />
            <Input label="Calendar URL" value={calForm.calendarUrl} onChange={(e: any) => setCalForm({ ...calForm, calendarUrl: e.target.value })} placeholder="https://…/caldav/…/" />
            <Input label="Username" value={calForm.username} onChange={(e: any) => setCalForm({ ...calForm, username: e.target.value })} />
            <Input label="Password / app password" type="password" value={calForm.password} onChange={(e: any) => setCalForm({ ...calForm, password: e.target.value })} />
            <Button variant="primary" disabled={busy || !calForm.calendarUrl || !calForm.username || !calForm.password} onClick={() => save('calendar', { ...calForm, businessId })}>
              Save calendar
            </Button>
            {calendar?.lastError && <p className="text-xs text-[var(--dusty-rose)]">Last error: {calendar.lastError}</p>}
          </Card>
        </div>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[var(--warm-ink)]">Recent email</h2>
            <Button variant="secondary" size="sm" onClick={sync} disabled={busy}>{busy ? 'Syncing…' : 'Sync now'}</Button>
          </div>
          {messages.length === 0 && <p className="text-sm text-[var(--soft-stone)]">No messages yet.</p>}
          {messages.slice(0, 10).map((m) => (
            <div key={m.id} className="rounded-xl bg-[var(--cream)] p-3">
              <p className="text-sm font-semibold text-[var(--warm-ink)]">{m.content.split('\n')[0]}</p>
              <p className="text-xs text-[var(--soft-stone)]">{m.direction} · {m.status} · {new Date(m.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { getAuthToken } from '../../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

interface Note { id: string; title?: string | null; body: string; authorName?: string | null; createdAt: string }
interface Comment { id: string; body: string; authorName?: string | null; createdAt: string }

/** Notes and record-level comments for a client — the collaboration primitives
 * that were missing from the CRM even though activities existed. */
export function NotesCommentsPanel({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [noteBody, setNoteBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([
        fetch(`${API_BASE}/api/v1/crm/notes?clientId=${encodeURIComponent(clientId)}`, { headers: headers() }),
        fetch(`${API_BASE}/api/v1/crm/comments?entityType=client&entityId=${encodeURIComponent(clientId)}`, { headers: headers() }),
      ]);
      if (n.ok) setNotes((await n.json()).data || []);
      if (c.ok) setComments((await c.json()).data || []);
    } catch {
      // Read failure must not take down the whole detail page.
    }
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const post = async (url: string, body: unknown, reset: () => void) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/${url}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      reset();
      await load();
    } catch {
      setError('Could not save. Try again.');
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--warm-sand)]/40 bg-[var(--cream)]/40 p-4 space-y-5">
      <h3 className="font-bold text-[var(--warm-ink)]">Notes & discussion</h3>
      {error && <p className="text-sm text-[var(--dusty-rose)]">{error}</p>}

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)] mb-2">Notes</p>
        <div className="space-y-2">
          {notes.length === 0 && <p className="text-sm text-[var(--soft-stone)]">No notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl bg-white/60 p-3">
              {n.title && <p className="font-semibold text-sm text-[var(--warm-ink)]">{n.title}</p>}
              <p className="text-sm text-[var(--warm-ink)] whitespace-pre-wrap">{n.body}</p>
              <p className="text-[11px] text-[var(--soft-stone)] mt-1">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          placeholder="Write a note about this client…"
          rows={2}
          className="mt-2 w-full rounded-xl border border-[var(--warm-sand)] bg-white/70 p-3 text-sm text-[var(--warm-ink)]"
        />
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={!noteBody.trim()}
          onClick={() => post('notes', { clientId, body: noteBody.trim() }, () => setNoteBody(''))}
        >
          Add note
        </Button>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--soft-stone)] mb-2">Discussion</p>
        <div className="space-y-2">
          {comments.length === 0 && <p className="text-sm text-[var(--soft-stone)]">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-white/60 p-3">
              <p className="text-sm text-[var(--warm-ink)] whitespace-pre-wrap">{c.body}</p>
              <p className="text-[11px] text-[var(--soft-stone)] mt-1">{c.authorName} · {new Date(c.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Comment for your team…"
          rows={2}
          className="mt-2 w-full rounded-xl border border-[var(--warm-sand)] bg-white/70 p-3 text-sm text-[var(--warm-ink)]"
        />
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={!commentBody.trim()}
          onClick={() => post('comments', { entityType: 'client', entityId: clientId, body: commentBody.trim() }, () => setCommentBody(''))}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}

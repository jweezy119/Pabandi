import { useMemo } from 'react';
import { Card, Chip } from '../../../components/primitives';

export default function ClientTimeline({ activities, deals, invoices, jobs, notes, files }: any) {
  
  const timelineEvents = useMemo(() => {
    let events: any[] = [];

    activities.forEach((act: any) => events.push({ ...act, eventType: 'activity', date: new Date(act.createdAt) }));
    deals.forEach((d: any) => events.push({ ...d, eventType: 'deal', date: new Date(d.createdAt) }));
    invoices.forEach((inv: any) => events.push({ ...inv, eventType: 'invoice', date: new Date(inv.createdAt) }));
    jobs.forEach((j: any) => events.push({ ...j, eventType: 'job', date: new Date(j.createdAt) }));
    files.forEach((f: any) => events.push({ ...f, eventType: 'file', date: new Date(f.createdAt) }));
    
    // Notes can just be activities of type NOTE or custom inline notes.
    if (notes) {
      events.push({ id: 'note-0', title: 'Internal Note', description: notes, eventType: 'note', date: new Date(0) });
    }

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [activities, deals, invoices, jobs, notes, files]);

  return (
    <Card hover={false} className="clay-rise">
      <h2 className="text-xl font-bold clay-heading mb-6">Activity Timeline</h2>
      <div className="space-y-6">
        {timelineEvents.map((ev: any, idx) => (
          <div key={`${ev.id}-${idx}`} className="relative pl-6 border-l-2 border-[var(--warm-sand)]">
            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[var(--clay)] border-2 border-white shadow-sm" />
            
            <div className="bg-[var(--warm-sand)]/20 p-4 rounded-2xl border border-[rgba(191,179,163,0.3)]">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <Chip label={ev.eventType.toUpperCase()} variant={
                    ev.eventType === 'invoice' ? 'success' : 
                    ev.eventType === 'deal' ? 'warning' : 
                    ev.eventType === 'job' ? 'info' : 'neutral'
                  } />
                  <h4 className="font-bold text-sm text-[var(--warm-ink)]">
                    {ev.title || ev.number || ev.serviceType || ev.fileName || 'Note'}
                  </h4>
                </div>
                <span className="text-xs text-[var(--soft-stone)]">{ev.date.toLocaleDateString()}</span>
              </div>
              
              <div className="text-sm text-[var(--soft-stone)]">
                {ev.eventType === 'activity' && <p>{ev.description}</p>}
                {ev.eventType === 'note' && <p className="italic">"{ev.description}"</p>}
                {ev.eventType === 'deal' && <p>Stage: {ev.stage} · Value: ${(ev.value || 0).toLocaleString()}</p>}
                {ev.eventType === 'invoice' && <p>Status: {ev.status} · Amount: ${(ev.subtotal || 0).toLocaleString()}</p>}
                {ev.eventType === 'job' && <p>Status: {ev.status} · Date: {new Date(ev.scheduledDate).toLocaleDateString()}</p>}
                {ev.eventType === 'file' && <p>Attached document: <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--clay)] hover:underline">Download</a></p>}
              </div>
            </div>
          </div>
        ))}
        {timelineEvents.length === 0 && (
          <div className="text-sm text-[var(--soft-stone)] text-center py-4">No activity recorded yet.</div>
        )}
      </div>
    </Card>
  );
}

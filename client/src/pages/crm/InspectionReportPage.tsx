import React, { useState } from 'react';

interface InspectionItemData {
  id: string;
  room: string;
  item: string;
  condition: string;
  notes: string;
  photos: string[];
  requiresAction: boolean;
  actionNotes: string;
}

const ROOMS = ['Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Hallway', 'Exterior'];
const ITEMS_BY_ROOM: Record<string, string[]> = {
  Kitchen: ['Floors', 'Walls', 'Ceiling', 'Windows', 'Cabinets', 'Sink/Plumbing', 'Appliances'],
  Bathroom: ['Floors', 'Walls', 'Ceiling', 'Windows', 'Sink', 'Toilet', 'Tub/Shower', 'Ventilation'],
  Bedroom: ['Floors', 'Walls', 'Ceiling', 'Windows', 'Closet', 'Lights'],
  'Living Room': ['Floors', 'Walls', 'Ceiling', 'Windows', 'Lights'],
  Hallway: ['Floors', 'Walls', 'Ceiling', 'Lights'],
  Exterior: ['Front Door', 'Windows', 'Walls', 'Roof/Gutters', 'Walkway'],
};
const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

const InspectionReportPage: React.FC<{ reportId?: string }> = (_props) => {
  const [reportType, setReportType] = useState('MOVE_IN');
  const [inspectorName, setInspectorName] = useState('');
  const [overallCondition, setOverallCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InspectionItemData[]>([]);
  const [showSignDialog, setShowSignDialog] = useState(false);

  const addItem = (room: string, item: string) => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      room, item, condition: 'GOOD', notes: '', photos: [], requiresAction: false, actionNotes: '',
    }]);
  };

  const updateItem = (id: string, updates: Partial<InspectionItemData>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Inspection Report</h1>

      {/* Meta */}
      <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: '#64748b' }}>Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }}>
              <option>MOVE_IN</option><option>MOVE_OUT</option><option>ROUTINE</option><option>MAINTENANCE</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#64748b' }}>Inspector Name</label>
            <input value={inspectorName} onChange={e => setInspectorName(e.target.value)} placeholder="Name" style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#64748b' }}>Overall Condition</label>
            <select value={overallCondition} onChange={e => setOverallCondition(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }}>
              <option>EXCELLENT</option><option>GOOD</option><option>FAIR</option><option>POOR</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items by room */}
      {ROOMS.map(room => (
        <div key={room} style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{room}</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {ITEMS_BY_ROOM[room]?.map(item => (
              <button key={item} onClick={() => addItem(room, item)} style={{ padding: '4px 10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                + {item}
              </button>
            ))}
          </div>
          {items.filter(i => i.room === room).map(item => (
            <div key={item.id} style={{ padding: 10, border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{item.item}</strong>
                <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <select value={item.condition} onChange={e => updateItem(item.id, { condition: e.target.value })} style={{ padding: 4, fontSize: 12 }}>
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={item.notes} onChange={e => updateItem(item.id, { notes: e.target.value })} placeholder="Notes..." style={{ flex: 1, padding: 4, fontSize: 12 }} />
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={item.requiresAction} onChange={e => updateItem(item.id, { requiresAction: e.target.checked })} />
                  Action Required
                </label>
              </div>
              {item.requiresAction && (
                <input value={item.actionNotes} onChange={e => updateItem(item.id, { actionNotes: e.target.value })} placeholder="Action notes..." style={{ marginTop: 4, width: '100%', padding: 4, fontSize: 12 }} />
              )}
              <div style={{ marginTop: 4 }}>
                <button style={{ padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>+ Add Photo</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Notes & Signature */}
      <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Notes</h3>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={() => setShowSignDialog(true)} style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Sign & Submit
        </button>
        <button style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>
          Export PDF
        </button>
      </div>

      {/* Signature Dialog */}
      {showSignDialog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 8, maxWidth: 400, width: '100%' }}>
            <h3>Digital Signature</h3>
            <p style={{ fontSize: 14, color: '#64748b' }}>Draw your signature below:</p>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: 8, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              Signature Capture Area
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSignDialog(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { setShowSignDialog(false); }} style={{ padding: '8px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Confirm Signature</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionReportPage;

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';

const navItems = [
  { path: '/builder', label: 'Dashboard', icon: '🏗️', end: true },
  { path: '/builder/projects', label: 'Projects', icon: '🏢' },
  { path: '/builder/buyers', label: 'Buyers', icon: '👥' },
  { path: '/builder/installments', label: 'Payments', icon: '💰' },
];

export default function BuilderProjectPage() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [unitForm, setUnitForm] = useState({ unitNumber: '', type: '2BHK', size: '', price: '', floor: '' });
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', dueDate: '' });

  useEffect(() => { loadProject(); }, [id]);

  const loadProject = async () => {
    try {
      const res = await api.get(`/api/v1/builder/projects/${id}`);
      setProject(res.data?.data);
    } catch (e) {
      console.error('Failed to load project', e);
    } finally {
      setLoading(false);
    }
  };

  const addUnit = async () => {
    try {
      await api.post('/api/v1/builder/units', {
        projectId: id,
        unitNumber: unitForm.unitNumber,
        type: unitForm.type,
        size: parseInt(unitForm.size),
        price: parseFloat(unitForm.price),
        floor: unitForm.floor ? parseInt(unitForm.floor) : undefined,
      });
      setShowUnitModal(false);
      setUnitForm({ unitNumber: '', type: '2BHK', size: '', price: '', floor: '' });
      loadProject();
    } catch (e: any) {
      alert('Failed to add unit: ' + e.message);
    }
  };

  const addMilestone = async () => {
    try {
      await api.post('/api/v1/builder/milestones', {
        projectId: id,
        title: milestoneForm.title,
        description: milestoneForm.description,
        dueDate: new Date(milestoneForm.dueDate).toISOString(),
      });
      setShowMilestoneModal(false);
      setMilestoneForm({ title: '', description: '', dueDate: '' });
      loadProject();
    } catch (e: any) {
      alert('Failed to add milestone: ' + e.message);
    }
  };

  const completeMilestone = async (mid: string) => {
    try {
      await api.put(`/api/v1/builder/milestones/${mid}/complete`);
      loadProject();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  };

  if (loading) {
    return (
      <DashboardLayout osName="Haq OS" osIcon="🏗️" osColor="emerald" navItems={navItems}>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--sage)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout osName="Haq OS" osIcon="🏗️" osColor="emerald" navItems={navItems}>
        <div className="text-center text-[var(--soft-stone)] py-12">Project not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout osName="Haq OS" osIcon="🏗️" osColor="emerald" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/builder" className="text-[var(--sage)] text-sm hover:underline">← Back to Dashboard</Link>
            <h1 className="text-2xl font-bold text-[var(--warm-ink)] mt-1">{project.name}</h1>
            <p className="text-[var(--soft-stone)] text-sm">{project.location}</p>
          </div>
          <span className={`px-3 py-1 rounded text-sm ${project.status === 'ACTIVE' ? 'bg-[var(--sage)]/20 text-[var(--sage)]' : 'bg-[var(--muted-ochre)]/20 text-[var(--muted-ochre)]'}`}>
            {project.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm">Total Units</p>
            <p className="text-2xl font-bold text-[var(--warm-ink)]">{project.totalUnits}</p>
          </div>
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm">Available</p>
            <p className="text-2xl font-bold text-[var(--warm-ink)]">{project.units?.filter((u: any) => u.status === 'AVAILABLE').length || 0}</p>
          </div>
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm">Booked</p>
            <p className="text-2xl font-bold text-[var(--muted-ochre)]">{project.bookedUnits}</p>
          </div>
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm">Sold</p>
            <p className="text-2xl font-bold text-[var(--sage)]">{project.soldUnits}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setShowUnitModal(true)} className="px-4 py-2 bg-[var(--sage)] text-[var(--warm-ink)] rounded-lg text-sm hover:bg-[var(--sage)]">
            + Add Unit
          </button>
          <button onClick={() => setShowMilestoneModal(true)} className="px-4 py-2 bg-[var(--warm-sand)] text-[var(--warm-ink)] rounded-lg text-sm hover:bg-[var(--warm-sand)]">
            + Add Milestone
          </button>
        </div>

        {/* Units Grid */}
        <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
          <p className="text-[var(--soft-stone)] text-sm mb-3">Units</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {project.units?.map((unit: any) => (
              <div key={unit.id} className={`p-3 rounded-lg border text-center ${
                unit.status === 'AVAILABLE' ? 'border-[var(--sage)]/30 bg-[var(--sage)]/10' :
                unit.status === 'BOOKED' ? 'border-amber-500/30 bg-[var(--muted-ochre)]/10' :
                'border-[rgba(191,179,163,0.2)] bg-[var(--warm-sand)]'
              }`}>
                <p className="text-[var(--warm-ink)] text-sm font-medium">{unit.unitNumber}</p>
                <p className="text-[var(--soft-stone)] text-xs">{unit.type}</p>
                <p className="text-[var(--soft-stone)] text-xs">Rs {unit.price?.toLocaleString()}</p>
                <span className={`text-xs mt-1 inline-block ${unit.status === 'AVAILABLE' ? 'text-[var(--sage)]' : unit.status === 'BOOKED' ? 'text-[var(--muted-ochre)]' : 'text-[var(--soft-stone)]'}`}>
                  {unit.status}
                </span>
              </div>
            ))}
            {(!project.units || project.units.length === 0) && (
              <div className="col-span-full text-center text-[var(--soft-stone)] py-8">No units yet. Add your first unit!</div>
            )}
          </div>
        </div>

        {/* Milestones Timeline */}
        <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
          <p className="text-[var(--soft-stone)] text-sm mb-3">Milestones</p>
          <div className="space-y-3">
            {project.milestones?.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b border-[rgba(191,179,163,0.15)]">
                <button
                  onClick={() => m.status !== 'COMPLETED' && completeMilestone(m.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    m.status === 'COMPLETED' ? 'border-[var(--sage)] bg-[var(--sage)]' : 'border-[rgba(191,179,163,0.4)] hover:border-[var(--sage)]'
                  }`}
                >
                  {m.status === 'COMPLETED' && <span className="text-[var(--warm-ink)] text-xs">✓</span>}
                </button>
                <div className="flex-1">
                  <p className={`text-sm ${m.status === 'COMPLETED' ? 'text-[var(--soft-stone)] line-through' : 'text-[var(--warm-ink)]'}`}>{m.title}</p>
                  <p className="text-[var(--soft-stone)] text-xs">{m.description}</p>
                </div>
                <span className="text-[var(--soft-stone)] text-xs">{new Date(m.dueDate).toLocaleDateString()}</span>
              </div>
            ))}
            {(!project.milestones || project.milestones.length === 0) && (
              <p className="text-[var(--soft-stone)] text-sm">No milestones yet</p>
            )}
          </div>
        </div>

        {/* Buyer List */}
        {project.units?.filter((u: any) => u.buyer).length > 0 && (
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.15)] rounded-xl p-4">
            <p className="text-[var(--soft-stone)] text-sm mb-3">Buyers</p>
            <div className="space-y-2">
              {project.units?.filter((u: any) => u.buyer).map((unit: any) => (
                <div key={unit.id} className="flex items-center justify-between py-2 border-b border-[rgba(191,179,163,0.15)]">
                  <div>
                    <p className="text-[var(--warm-ink)] text-sm">{unit.buyer.user?.firstName} {unit.buyer.user?.lastName}</p>
                    <p className="text-[var(--soft-stone)] text-xs">Unit {unit.unitNumber} • {unit.type}</p>
                  </div>
                  <span className="text-[var(--sage)] text-sm">Rs {unit.price?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-[var(--warm-ink)]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-[var(--warm-ink)] font-bold mb-4">Add Unit</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Unit Number" value={unitForm.unitNumber} onChange={(e) => setUnitForm({...unitForm, unitNumber: e.target.value})} className="w-full px-3 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded text-[var(--warm-ink)]" />
              <select value={unitForm.type} onChange={(e) => setUnitForm({...unitForm, type: e.target.value})} className="w-full px-3 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded text-[var(--warm-ink)]">
                <option value="Studio">Studio</option>
                <option value="1BHK">1BHK</option>
                <option value="2BHK">2BHK</option>
                <option value="3BHK">3BHK</option>
                <option value="Penthouse">Penthouse</option>
              </select>
              <input type="number" placeholder="Size (sqft)" value={unitForm.size} onChange={(e) => setUnitForm({...unitForm, size: e.target.value})} className="w-full px-3 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded text-[var(--warm-ink)]" />
              <input type="number" placeholder="Price (PKR)" value={unitForm.price} onChange={(e) => setUnitForm({...unitForm, price: e.target.value})} className="w-full px-3 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded text-[var(--warm-ink)]" />
              <input type="number" placeholder="Floor" value={unitForm.floor} onChange={(e) => setUnitForm({...unitForm, floor: e.target.value})} className="w-full px-3 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded text-[var(--warm-ink)]" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={addUnit} className="flex-1 px-4 py-2 bg-[var(--sage)] text-[var(--warm-ink)] rounded-lg">Add Unit</button>
              <button onClick={() => setShowUnitModal(false)} className="flex-1 px-4 py-2 bg-[var(--warm-sand)] text-[var(--warm-ink)] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 bg-[var(--warm-ink)]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--cream)] border border-[rgba(191,179,163,0.2)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-[var(--warm-ink)] font-bold mb-4">Add Milestone</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Title" value={milestoneForm.title} onChange={(e) => setMilestoneForm({...milestoneForm, title: e.target.value})} className="w-full px-3 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded text-[var(--warm-ink)]" />
              <textarea placeholder="Description" value={milestoneForm.description} onChange={(e) => setMilestoneForm({...milestoneForm, description: e.target.value})} className="w-full px-3 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded text-[var(--warm-ink)]" />
              <input type="date" value={milestoneForm.dueDate} onChange={(e) => setMilestoneForm({...milestoneForm, dueDate: e.target.value})} className="w-full px-3 py-2 bg-[var(--warm-sand)] border border-[rgba(191,179,163,0.2)] rounded text-[var(--warm-ink)]" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={addMilestone} className="flex-1 px-4 py-2 bg-[var(--sage)] text-[var(--warm-ink)] rounded-lg">Add Milestone</button>
              <button onClick={() => setShowMilestoneModal(false)} className="flex-1 px-4 py-2 bg-[var(--warm-sand)] text-[var(--warm-ink)] rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

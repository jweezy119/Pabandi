import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { freightService } from '../../services/api';
import { Button, Surface } from '../../design-system';
import { FiArrowLeft, FiPackage, FiMapPin, FiCalendar, FiAlertTriangle } from 'react-icons/fi';

const CARGO_TYPES = ['GENERAL', 'REFRIGERATED', 'HAZARDOUS', 'OVERSIZED', 'FRAGILE'];
const EQUIPMENT_TYPES = ['DRY_VAN', 'REEFER', 'FLATBED', 'STEP_DECK', 'POWER_ONLY', 'BOX_TRUCK'];

export const PostLoad = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [form, setForm] = useState({
    title: '', description: '', cargoType: 'GENERAL', equipmentType: 'DRY_VAN',
    weightLbs: '', dimensions: '', valueUsd: '',
    originAddress: '', originCity: '', originState: '', originZip: '',
    destAddress: '', destCity: '', destState: '', destZip: '',
    pickupDate: '', deliveryDate: '', budgetUsd: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return navigate('/login');
    setSubmitting(true);
    setError('');
    try {
      await freightService.createLoad({
        ...form,
        weightLbs: Number(form.weightLbs),
        valueUsd: Number(form.valueUsd),
        budgetUsd: Number(form.budgetUsd),
        pickupDate: new Date(form.pickupDate),
        deliveryDate: new Date(form.deliveryDate),
      });
      navigate('/freight/my-loads');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to post load');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Cargo Details', desc: 'What are you shipping?' },
    { num: 2, title: 'Locations', desc: 'Pickup and delivery addresses' },
    { num: 3, title: 'Schedule & Budget', desc: 'When and how much' },
  ];

  if (!isAuthenticated) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <Surface className="p-12 text-center">
          <FiAlertTriangle size={48} className="mx-auto text-amber-400 mb-4" aria-hidden="true" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in to post a load</h2>
          <p className="text-slate-400 mb-6">You need to be logged in as a shipper to post freight loads.</p>
          <Button onClick={() => navigate('/login')} size="lg" className="w-full sm:w-auto">
            <FiArrowLeft size={16} /> Sign In
          </Button>
        </Surface>
      </div>
    );
  }

  const renderStep1 = () => (
    <Surface className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4"><FiPackage className="w-5 h-5 inline mr-2" /> Cargo Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Title *</label>
          <input name="title" value={form.title} onChange={handleChange} placeholder="Electronics shipment" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Cargo Type *</label>
          <select name="cargoType" value={form.cargoType} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400" required>
            {CARGO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Equipment Type *</label>
          <select name="equipmentType" value={form.equipmentType} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400" required>
            {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Weight (lbs) *</label>
          <input type="number" name="weightLbs" value={form.weightLbs} onChange={handleChange} placeholder="1000" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required min="1" max="80000" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Dimensions (LxWxH in)</label>
          <input name="dimensions" value={form.dimensions} onChange={handleChange} placeholder="48x40x48" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Declared Value ($) *</label>
          <input type="number" name="valueUsd" value={form.valueUsd} onChange={handleChange} placeholder="5000" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required min="1" />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-300 mb-1 block">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Describe the cargo, special handling requirements..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400 resize-none" />
        </div>
      </div>
    </Surface>
  );

  const renderStep2 = () => (
    <Surface className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4"><FiMapPin className="w-5 h-5 inline mr-2" /> Pickup & Delivery Locations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 border-r md:border-r-0 md:border-b md:pb-6">
          <h4 className="text-sm font-semibold text-orange-400 uppercase tracking-wide">Pickup Location</h4>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Street Address *</label>
            <input name="originAddress" value={form.originAddress} onChange={handleChange} placeholder="123 Main St" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="originCity" value={form.originCity} onChange={handleChange} placeholder="City *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
            <input name="originState" value={form.originState} onChange={handleChange} placeholder="State *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required maxLength={2} />
            <input name="originZip" value={form.originZip} onChange={handleChange} placeholder="ZIP *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required maxLength={5} />
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">Delivery Location</h4>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Street Address *</label>
            <input name="destAddress" value={form.destAddress} onChange={handleChange} placeholder="456 Oak Ave" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="destCity" value={form.destCity} onChange={handleChange} placeholder="City *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required />
            <input name="destState" value={form.destState} onChange={handleChange} placeholder="State *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required maxLength={2} />
            <input name="destZip" value={form.destZip} onChange={handleChange} placeholder="ZIP *" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required maxLength={5} />
          </div>
        </div>
      </div>
    </Surface>
  );

  const renderStep3 = () => (
    <Surface className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4"><FiCalendar className="w-5 h-5 inline mr-2" /> Schedule & Budget</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Pickup Date *</label>
          <input type="date" name="pickupDate" value={form.pickupDate} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400" required min={new Date().toISOString().split('T')[0]} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Delivery Date *</label>
          <input type="date" name="deliveryDate" value={form.deliveryDate} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-orange-400" required min={form.pickupDate || new Date().toISOString().split('T')[0]} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Budget ($) *</label>
          <input type="number" name="budgetUsd" value={form.budgetUsd} onChange={handleChange} placeholder="1500" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-400" required min="1" />
        </div>
      </div>
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
        <h4 className="font-semibold text-orange-300 mb-2 flex items-center gap-2"><FiAlertTriangle size={18} /> Important Notes</h4>
        <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
          <li>Carriers will bid on your load - you can accept the best offer</li>
          <li>Escrow protection available for secure payment</li>
          <li>Insurance options available for cargo protection</li>
          <li>Real-time tracking included for all shipments</li>
        </ul>
      </div>
    </Surface>
  );

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <Link to="/freight" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4">
        <FiArrowLeft size={18} /> Back to Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Post a New Load</h1>
          <p className="text-slate-400">Fill in the details below to get bids from verified carriers</p>
        </div>
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i < step - 1 ? 'bg-emerald-500 text-white' : i === step - 1 ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                {i < step - 1 ? '✓' : s.num}
              </div>
              {i < steps.length - 1 && <div className={`w-16 h-0.5 mx-2 ${i < step - 1 ? 'bg-emerald-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <div className="flex justify-between pt-4 border-t border-white/10">
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              <FiArrowLeft size={16} /> Back
            </Button>
          )}
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(step + 1)} className="ml-auto">
              Next <FiArrowLeft size={16} className="-rotate-180" />
            </Button>
          ) : (
            <Button type="submit" disabled={submitting} className="ml-auto bg-gradient-to-r from-orange-500 to-red-500" size="lg">
              {submitting ? 'Posting...' : 'Post Load & Get Bids'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PostLoad;
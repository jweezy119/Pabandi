import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight, FiChevronLeft, FiCheck, FiBriefcase, FiUsers, FiDollarSign, FiMapPin, FiPhone, FiPlus, FiTrash2 } from 'react-icons/fi';

interface ServiceData {
  name: string;
  price: string;
  duration: string;
}

interface EmployeeData {
  name: string;
  role: string;
  payRate: string;
  payType: 'hourly' | 'per_job' | 'salary';
}

const SERVICE_TYPES = [
  'Cleaning', 'Plumbing', 'Electrical', 'Landscaping', 'HVAC',
  'Painting', 'Carpentry', 'Pest Control', 'Moving', 'Handyman', 'Other'
];

const PAY_TYPES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_job', label: 'Per Job' },
  { value: 'salary', label: 'Salary' },
];

export default function ServiceBusinessOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [services, setServices] = useState<ServiceData[]>([{ name: '', price: '', duration: '' }]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [newEmployee, setNewEmployee] = useState<EmployeeData>({ name: '', role: '', payRate: '', payType: 'hourly' });
  const [submitting, setSubmitting] = useState(false);

  const addService = () => setServices([...services, { name: '', price: '', duration: '' }]);
  const removeService = (i: number) => setServices(services.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: keyof ServiceData, value: string) => {
    const updated = [...services];
    updated[i][field] = value;
    setServices(updated);
  };

  const addEmployee = () => {
    if (!newEmployee.name) return;
    setEmployees([...employees, newEmployee]);
    setNewEmployee({ name: '', role: '', payRate: '', payType: 'hourly' });
  };
  const removeEmployee = (i: number) => setEmployees(employees.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/v1/crm/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          serviceType,
          phone,
          address,
          services: services.filter(s => s.name),
          employees,
        }),
      });
      navigate('/crm/dashboard');
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Business Info', icon: FiBriefcase },
    { num: 2, label: 'Services', icon: FiDollarSign },
    { num: 3, label: 'Team', icon: FiUsers },
    { num: 4, label: 'Review', icon: FiCheck },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
                step === s.num
                  ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                  : step > s.num
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}>
                <s.icon size={16} />
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 rounded-full transition-all ${step > s.num ? 'bg-emerald-500' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Tell us about your business</h2>
                <p className="text-slate-400 text-sm">We'll use this to set up your service profile.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition"
                    placeholder="e.g. Sparkle Clean Co."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Service Type</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {SERVICE_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => setServiceType(type)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          serviceType === type
                            ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg'
                            : 'bg-white/5 text-slate-300 border border-white/10 hover:border-violet-500/30'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      <Fiphone className="inline mr-1" size={14} /> Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      <FiMapPin className="inline mr-1" size={14} /> Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition"
                      placeholder="123 Main St, City"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Services */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Configure your services</h2>
                <p className="text-slate-400 text-sm">Add the services you offer with pricing and duration.</p>
              </div>
              <div className="space-y-3">
                {services.map((svc, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                    <input
                      type="text"
                      value={svc.name}
                      onChange={(e) => updateService(i, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition text-sm"
                      placeholder="Service name"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        value={svc.price}
                        onChange={(e) => updateService(i, 'price', e.target.value)}
                        className="w-24 pl-7 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={svc.duration}
                        onChange={(e) => updateService(i, 'duration', e.target.value)}
                        className="w-20 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition text-sm"
                        placeholder="60"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">min</span>
                    </div>
                    {services.length > 1 && (
                      <button onClick={() => removeService(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition">
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addService} className="flex items-center gap-2 px-4 py-2.5 text-sm text-violet-400 hover:bg-violet-500/10 rounded-xl border border-dashed border-violet-500/30 transition w-full justify-center">
                  <FiPlus size={16} /> Add Service
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Team */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Set up your team</h2>
                <p className="text-slate-400 text-sm">Add employees and their pay structure.</p>
              </div>
              {/* Add employee form */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition text-sm"
                    placeholder="Employee name"
                  />
                  <input
                    type="text"
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition text-sm"
                    placeholder="Role"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      value={newEmployee.payRate}
                      onChange={(e) => setNewEmployee({ ...newEmployee, payRate: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition text-sm"
                      placeholder="Pay rate"
                    />
                  </div>
                  <select
                    value={newEmployee.payType}
                    onChange={(e) => setNewEmployee({ ...newEmployee, payType: e.target.value as EmployeeData['payType'] })}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500/50 transition text-sm"
                  >
                    {PAY_TYPES.map(pt => (
                      <option key={pt.value} value={pt.value} className="bg-gray-800">{pt.label}</option>
                    ))}
                  </select>
                  <button onClick={addEmployee} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-violet-500/25 transition">
                    <FiPlus size={16} />
                  </button>
                </div>
              </div>
              {/* Employee list */}
              {employees.length > 0 && (
                <div className="space-y-2">
                  {employees.map((emp, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">{emp.name}</div>
                          <div className="text-slate-400 text-xs">{emp.role} · {emp.payRate}{emp.payType === 'hourly' ? '/hr' : emp.payType === 'per_job' ? '/job' : '/mo'}</div>
                        </div>
                      </div>
                      <button onClick={() => removeEmployee(i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {employees.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <FiUsers size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No employees added yet. You can skip this step.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Review & confirm</h2>
                <p className="text-slate-400 text-sm">Make sure everything looks good before submitting.</p>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-sm font-medium text-violet-400 mb-2">Business Info</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-400">Name:</span> <span className="text-white">{businessName || '—'}</span></div>
                    <div><span className="text-slate-400">Type:</span> <span className="text-white">{serviceType || '—'}</span></div>
                    <div><span className="text-slate-400">Phone:</span> <span className="text-white">{phone || '—'}</span></div>
                    <div><span className="text-slate-400">Address:</span> <span className="text-white">{address || '—'}</span></div>
                  </div>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-sm font-medium text-violet-400 mb-2">Services ({services.filter(s => s.name).length})</h3>
                  {services.filter(s => s.name).length > 0 ? (
                    <div className="space-y-1">
                      {services.filter(s => s.name).map((s, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-white">{s.name}</span>
                          <span className="text-slate-400">${s.price} · {s.duration}min</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No services added</p>}
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-sm font-medium text-violet-400 mb-2">Team ({employees.length})</h3>
                  {employees.length > 0 ? (
                    <div className="space-y-1">
                      {employees.map((e, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-white">{e.name} <span className="text-slate-400">({e.role})</span></span>
                          <span className="text-slate-400">${e.payRate}/{e.payType === 'hourly' ? 'hr' : e.payType === 'per_job' ? 'job' : 'mo'}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No employees added</p>}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <FiChevronLeft size={16} /> Back
            </button>
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-500/25 transition"
              >
                Next <FiChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : <><FiCheck size={16} /> Confirm & Launch</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

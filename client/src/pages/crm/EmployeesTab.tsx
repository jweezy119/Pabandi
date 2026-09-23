import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUsers, FiDollarSign, FiCalendar, FiStar, FiBriefcase, FiMail, FiPhone, FiMapPin, FiX } from 'react-icons/fi';

const CRM_API = `${import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com'}/api/v1/crm`;

async function crmApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CRM_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'API error');
  return res.json();
}

export default function EmployeesTab({ employees, onRefresh }: { employees: any[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase()) ||
    e.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--warm-ink)]">Team Management</h2>
        <button onClick={() => { setSelectedEmployee(null); setShowForm(true); }} className="px-4 py-2 bg-[var(--clay)] text-white rounded-xl text-sm font-medium flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-stone)]" />
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-[var(--soft-stone)]/30 bg-white text-[var(--warm-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
        />
      </div>

      {/* Employee Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-12 text-center">
          <FiUsers className="w-12 h-12 text-[var(--soft-stone)] mx-auto mb-3" />
          <p className="text-[var(--soft-stone)]">No employees found. Add your first team member to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              onEdit={() => { setSelectedEmployee(emp); setShowForm(true); }}
              onDelete={async () => {
                if (confirm(`Delete ${emp.name}?`)) {
                  await crmApi(`/employees/${emp.id}`, { method: 'DELETE' });
                  onRefresh();
                }
              }}
              onClick={() => { setSelectedEmployee(emp); setShowDetail(true); }}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <EmployeeFormModal
          employee={selectedEmployee}
          onClose={() => { setShowForm(false); setSelectedEmployee(null); }}
          onSave={async (data) => {
            if (selectedEmployee) {
              await crmApi(`/employees/${selectedEmployee.id}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
              await crmApi('/employees', { method: 'POST', body: JSON.stringify(data) });
            }
            setShowForm(false);
            setSelectedEmployee(null);
            onRefresh();
          }}
        />
      )}

      {/* Detail Modal */}
      {showDetail && selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={() => { setShowDetail(false); setSelectedEmployee(null); }}
        />
      )}
    </div>
  );
}

function EmployeeCard({ employee, onEdit, onDelete, onClick }: { employee: any; onEdit: () => void; onDelete: () => void; onClick: () => void }) {
  return (
    <div className="rounded-2xl border border-[var(--soft-stone)]/30 bg-white p-4 hover:border-[var(--clay)]/30 transition cursor-pointer group" onClick={onClick}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--sage)] to-[var(--muted-ochre)] flex items-center justify-center text-white font-bold text-lg">
          {employee.name?.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--warm-ink)] truncate">{employee.name}</h3>
          <p className="text-sm text-[var(--soft-stone)] truncate">{employee.role || 'Team Member'}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-2 rounded-lg hover:bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:text-[var(--warm-ink)]">
            <FiEdit2 className="w-4 h-4" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-2 rounded-lg hover:bg-red-50 text-[var(--soft-stone)] hover:text-[var(--terracotta)]">
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-[var(--warm-sand)]">
          <p className="text-sm font-bold text-[var(--warm-ink)]">{employee.jobsCompleted || 0}</p>
          <p className="text-xs text-[var(--soft-stone)]">Jobs</p>
        </div>
        <div className="p-2 rounded-lg bg-[var(--warm-sand)]">
          <p className="text-sm font-bold text-[var(--warm-ink)]">{employee.rating?.toFixed(1) || '5.0'}</p>
          <p className="text-xs text-[var(--soft-stone)]">Rating</p>
        </div>
        <div className="p-2 rounded-lg bg-[var(--warm-sand)]">
          <p className="text-sm font-bold text-[var(--sage)]">${employee.payRate?.toFixed(0) || 0}</p>
          <p className="text-xs text-[var(--soft-stone)]">{employee.payType === 'HOURLY' ? '/hr' : employee.payType === 'SALARY' ? '/mo' : '/job'}</p>
        </div>
      </div>
    </div>
  );
}

function EmployeeFormModal({ employee, onClose, onSave }: { employee: any; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [form, setForm] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    role: employee?.role || '',
    payRate: employee?.payRate || '',
    payType: employee?.payType || 'HOURLY',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, payRate: form.payRate ? Number(form.payRate) : 0 });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[var(--soft-stone)]/30" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--warm-ink)]">{employee ? 'Edit Employee' : 'Add Employee'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--warm-sand)] text-[var(--soft-stone)]"><FiX className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30" placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30" placeholder="email@company.com" />
            </div>
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30" placeholder="+1 555-0000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Role</label>
              <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30" placeholder="Cleaner, Tech, etc." />
            </div>
            <div>
              <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Pay Type</label>
              <select value={form.payType} onChange={e => setForm({ ...form, payType: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30">
                <option value="HOURLY">Hourly</option>
                <option value="SALARY">Salary</option>
                <option value="PER_JOB">Per Job</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--soft-stone)] font-medium mb-1">Pay Rate ($)</label>
            <input type="number" min="0" step="0.01" value={form.payRate} onChange={e => setForm({ ...form, payRate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[var(--soft-stone)]/30 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30" placeholder="25.00" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-[var(--soft-stone)]/30 text-sm font-medium text-[var(--warm-ink)] hover:bg-[var(--warm-sand)]">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-[var(--clay)] text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : employee ? 'Update' : 'Add Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmployeeDetailModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[var(--soft-stone)]/30" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[var(--warm-ink)]">Employee Details</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--warm-sand)] text-[var(--soft-stone)]"><FiX className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--sage)] to-[var(--muted-ochre)] flex items-center justify-center text-white font-bold text-2xl">
            {employee.name?.charAt(0) || '?'}
          </div>
          <div>
            <h4 className="text-xl font-bold text-[var(--warm-ink)]">{employee.name}</h4>
            <p className="text-[var(--soft-stone)]">{employee.role || 'Team Member'}</p>
          </div>
        </div>
        <div className="space-y-4">
          {employee.email && (
            <div className="flex items-center gap-3">
              <FiMail className="w-5 h-5 text-[var(--soft-stone)]" />
              <span className="text-[var(--warm-ink)]">{employee.email}</span>
            </div>
          )}
          {employee.phone && (
            <div className="flex items-center gap-3">
              <FiPhone className="w-5 h-5 text-[var(--soft-stone)]" />
              <span className="text-[var(--warm-ink)]">{employee.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <FiDollarSign className="w-5 h-5 text-[var(--soft-stone)]" />
            <span className="text-[var(--warm-ink)]">${employee.payRate?.toFixed(2) || '0.00'} {employee.payType === 'HOURLY' ? '/hour' : employee.payType === 'SALARY' ? '/month' : '/job'}</span>
          </div>
          <div className="flex items-center gap-3">
            <FiBriefcase className="w-5 h-5 text-[var(--soft-stone)]" />
            <span className="text-[var(--warm-ink)]">{employee.jobsCompleted || 0} jobs completed</span>
          </div>
          <div className="flex items-center gap-3">
            <FiStar className="w-5 h-5 text-[var(--muted-ochre)]" />
            <span className="text-[var(--warm-ink)]">{employee.rating?.toFixed(1) || '5.0'} / 5.0 rating</span>
          </div>
          <div className="flex items-center gap-3">
            <FiCalendar className="w-5 h-5 text-[var(--soft-stone)]" />
            <span className="text-[var(--warm-ink)]">Joined {new Date(employee.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

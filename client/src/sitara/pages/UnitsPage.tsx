// Sitara OS — Units Page
// Property unit management

import { useState } from 'react';
import { useSitaraStore } from '../store/sitaraStore';

const statusColors = {
  available: 'bg-green-100 text-green-800',
  occupied: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  reserved: 'bg-purple-100 text-purple-800',
};

export default function UnitsPage() {
  const { units, addUnit } = useSitaraStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newUnit, setNewUnit] = useState({
    buildingName: '',
    unitNumber: '',
    beds: 1,
    baths: 1,
    sqft: 0,
    rentAmount: 0,
    depositAmount: 0,
  });

  const handleAdd = () => {
    addUnit({
      id: `unit-${Date.now()}`,
      buildingId: `bldg-${Date.now()}`,
      buildingName: newUnit.buildingName,
      unitNumber: newUnit.unitNumber,
      beds: newUnit.beds,
      baths: newUnit.baths,
      sqft: newUnit.sqft,
      rentAmount: newUnit.rentAmount,
      depositAmount: newUnit.depositAmount,
      status: 'available',
    });
    setShowAdd(false);
    setNewUnit({ buildingName: '', unitNumber: '', beds: 1, baths: 1, sqft: 0, rentAmount: 0, depositAmount: 0 });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Units</h1>
          <p className="text-slate-600 mt-1">Manage your property units</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
        >
          + Add Unit
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Add New Unit</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Building Name"
              value={newUnit.buildingName}
              onChange={(e) => setNewUnit({ ...newUnit, buildingName: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              placeholder="Unit Number"
              value={newUnit.unitNumber}
              onChange={(e) => setNewUnit({ ...newUnit, unitNumber: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Bedrooms"
              value={newUnit.beds}
              onChange={(e) => setNewUnit({ ...newUnit, beds: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Bathrooms"
              value={newUnit.baths}
              onChange={(e) => setNewUnit({ ...newUnit, baths: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Sq Ft"
              value={newUnit.sqft}
              onChange={(e) => setNewUnit({ ...newUnit, sqft: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Rent Amount ($)"
              value={newUnit.rentAmount}
              onChange={(e) => setNewUnit({ ...newUnit, rentAmount: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Deposit Amount ($)"
              value={newUnit.depositAmount}
              onChange={(e) => setNewUnit({ ...newUnit, depositAmount: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600"
            >
              Save Unit
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {units.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-lg">
          <p className="text-slate-600">No units yet. Add your first unit to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Unit</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Building</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Beds/Baths</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Rent</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {units.map((unit) => (
                <tr key={unit.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{unit.unitNumber}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{unit.buildingName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{unit.beds}/{unit.baths}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">${unit.rentAmount}/mo</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[unit.status]}`}>
                      {unit.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

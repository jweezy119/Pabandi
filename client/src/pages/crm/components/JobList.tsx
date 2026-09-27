import React, { useState } from 'react';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';

type Job = {
  id: string;
  serviceType: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  status: string;
  price: number;
};

export function JobList({ jobs, onJobClick }: { jobs: Job[], onJobClick: (id: string) => void }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredJobs = jobs.filter(job => {
    if (filter !== 'All' && job.status !== filter) return false;
    if (search && !job.serviceType.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <Input 
          placeholder="Search jobs..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="max-w-xs"
        />
        <select 
          className="border border-white/10 bg-black/40 text-white rounded-lg px-4"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="All">All</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      <div className="grid gap-4">
        {filteredJobs.map(job => (
          <Card key={job.id} className="p-4 flex justify-between items-center cursor-pointer hover:border-white/20 transition-colors" onClick={() => onJobClick(job.id)}>
            <div>
              <div className="font-semibold text-white">{job.serviceType}</div>
              <div className="text-sm text-gray-400">
                {new Date(job.scheduledDate).toLocaleDateString()} at {job.scheduledTime}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-2 py-1 text-xs rounded-full ${
                job.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {job.status}
              </span>
              <div className="text-white font-medium">${job.price}</div>
            </div>
          </Card>
        ))}
        {filteredJobs.length === 0 && (
          <div className="text-center py-8 text-gray-500">No jobs found</div>
        )}
      </div>
    </div>
  );
}

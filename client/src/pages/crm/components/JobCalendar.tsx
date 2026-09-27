import React, { useState } from 'react';
import { Card } from '../../../components/primitives/Card';

type Job = {
  id: string;
  serviceType: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  status: string;
  price: number;
};

export function JobCalendar({ jobs, onJobClick }: { jobs: Job[], onJobClick: (id: string) => void }) {
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['Day', 'Week', 'Month'] as const).map(v => (
          <button 
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === v ? 'bg-white text-black' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      
      <Card className="p-6">
        <div className="text-center text-gray-500 py-12">
          [Calendar {view} View Placeholder]
          <div className="mt-4 flex flex-col gap-2 max-w-sm mx-auto">
            {jobs.map(job => (
              <div 
                key={job.id} 
                onClick={() => onJobClick(job.id)}
                className="bg-white/5 p-2 rounded text-left cursor-pointer hover:bg-white/10"
              >
                <div className="text-white text-sm">{job.serviceType}</div>
                <div className="text-xs text-gray-400">{new Date(job.scheduledDate).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

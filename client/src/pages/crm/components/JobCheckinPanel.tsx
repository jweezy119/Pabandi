import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';

type JobCheckinPanelProps = {
  job: {
    id: string;
    status: string;
    scheduledTime: string;
  };
  onCheckIn: () => void;
  onCheckOut: () => void;
};

export function JobCheckinPanel({ job, onCheckIn, onCheckOut }: JobCheckinPanelProps) {
  return (
    <Card className="p-6 border-blue-500/30 bg-blue-500/5">
      <h3 className="text-lg font-semibold text-white mb-4">Job Execution</h3>
      
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Current Status: <strong className="text-white ml-2">{job.status}</strong>
        </div>
        
        <div className="flex gap-3">
          {job.status === 'SCHEDULED' && (
            <Button onClick={onCheckIn} className="bg-blue-600 hover:bg-blue-500">
              Check In Now
            </Button>
          )}
          
          {job.status === 'IN_PROGRESS' && (
            <Button onClick={onCheckOut} className="bg-green-600 hover:bg-green-500">
              Complete & Check Out
            </Button>
          )}

          {job.status === 'COMPLETED' && (
            <div className="text-green-400 font-medium">
              Job Completed
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

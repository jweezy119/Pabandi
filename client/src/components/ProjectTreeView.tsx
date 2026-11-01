import { useState } from 'react';
import { ChevronRight, ChevronDown, Lock, CheckCircle, Clock, Send } from 'lucide-react';

interface ChildEscrow {
  id: string;
  providerPassportId: string;
  totalAmount: number;
  status: 'PENDING' | 'FUNDED' | 'DELIVERED' | 'RELEASED';
  deliverableHash?: string;
}

interface MasterProject {
  id: string;
  title: string;
  budgetUsd: number;
  escrow: {
    id: string;
    status: 'FUNDED' | 'subcontracted' | 'COMPLETED';
    totalAmount: number;
  };
  childEscrows: ChildEscrow[];
}

interface ProjectTreeViewProps {
  project: MasterProject;
}

export default function ProjectTreeView({ project }: ProjectTreeViewProps) {
  const [expanded, setExpanded] = useState(true);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RELEASED':
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'DELIVERED':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'FUNDED':
      case 'subcontracted':
        return <Lock className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RELEASED':
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-700 border-green-500/30';
      case 'DELIVERED':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
      case 'FUNDED':
      case 'subcontracted':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 p-4 bg-[var(--clay)]/10 border border-[var(--clay)]/30 rounded-lg cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-5 h-5 text-[var(--clay)]" /> : <ChevronRight className="w-5 h-5 text-[var(--clay)]" />}
        <Lock className="w-5 h-5 text-[var(--clay)]" />
        <div className="flex-1">
          <div className="font-bold text-[var(--warm-ink)]">{project.title}</div>
          <div className="text-sm text-[var(--soft-stone)]">Master Project • ${project.budgetUsd} USD</div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(project.escrow.status)}`}>
          {getStatusIcon(project.escrow.status)}
          <span className="ml-1">{project.escrow.status}</span>
        </div>
      </div>

      {expanded && project.childEscrows.length > 0 && (
        <div className="ml-8 space-y-2">
          {project.childEscrows.map((child, index) => (
            <div
              key={child.id}
              className="flex items-center gap-2 p-3 bg-white border border-[rgba(191,179,163,0.3)] rounded-lg"
            >
              <div className="w-6 h-px bg-[var(--soft-stone)]" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-[var(--warm-ink)]">
                  Subcontract #{index + 1}
                </div>
                <div className="text-xs text-[var(--soft-stone)]">
                  Provider: {child.providerPassportId.slice(0, 12)}... • ${child.totalAmount} USD
                </div>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(child.status)}`}>
                {getStatusIcon(child.status)}
                <span>{child.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && project.childEscrows.length === 0 && (
        <div className="ml-8 p-3 text-sm text-[var(--soft-stone)] italic">
          No subcontracts yet
        </div>
      )}
    </div>
  );
}

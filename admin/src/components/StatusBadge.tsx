import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-brand-red-dim text-brand-red border-brand-red/30',
  accepted: 'bg-surface text-text-secondary border-border',
  in_progress: 'bg-surface text-text-secondary border-border',
  confirmed: 'bg-surface text-text-secondary border-border',
  completed: 'bg-brand-green-dim text-brand-green border-brand-green/30',
  cancelled: 'bg-surface text-text-secondary border-border',
  approved: 'bg-brand-green-dim text-brand-green border-brand-green/30',
  rejected: 'bg-brand-red-dim text-brand-red border-brand-red/30',
  not_submitted: 'bg-surface text-text-secondary border-border',
  paid: 'bg-brand-green-dim text-brand-green border-brand-green/30',
  failed: 'bg-brand-red-dim text-brand-red border-brand-red/30'
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium ${
      STATUS_STYLES[status] || 'bg-surface text-text-secondary border-border'
    }`}
  >
    {status.replace('_', ' ')}
  </span>
);

export default StatusBadge;

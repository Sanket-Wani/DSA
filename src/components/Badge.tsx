import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', className = '' }) => {
  return (
    <span className={`badge badge-${variant} ${className}`} role="status">
      <span className="badge-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export function getFileStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'Disburse':
    case 'Approved':
      return 'success';
    case 'Sanction':
      return 'info';
    case 'WIP (Work in Progress)':
    case 'In Progress':
      return 'neutral';
    case 'Valuation':
    case 'Legal':
    case 'Query':
    case 'Eligible':
      return 'warning';
    case 'Document Pending':
    case 'IP Pending':
    case 'Hold':
      return 'warning';
    case 'Rejected from Bank':
    case 'Cancelled':
    case 'Qualification Issue (Rejected by Firm)':
    case 'Rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button.js';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}) => {
  if (totalPages <= 1 && totalItems <= pageSize) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: '1px solid var(--color-border)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        flexWrap: 'wrap',
        gap: '8px'
      }}
    >
      <div>
        Showing <span className="num-tabular" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{startItem}</span> to{' '}
        <span className="num-tabular" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{endItem}</span> of{' '}
        <span className="num-tabular" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{totalItems}</span> records
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Button
          variant="secondary"
          size="sm"
          className="btn-icon-only"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          icon={<ChevronLeft size={14} />}
        />

        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
          // Show first, last, and current +/- 1
          if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '28px',
                  height: '28px',
                  padding: '0 6px',
                  borderRadius: 'var(--radius-xs)',
                  border: isActive ? '1px solid var(--color-action-primary)' : '1px solid var(--color-border)',
                  backgroundColor: isActive ? 'var(--color-action-primary)' : 'var(--color-surface)',
                  color: isActive ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: isActive ? 600 : 400
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                {p}
              </button>
            );
          }
          if (p === currentPage - 2 || p === currentPage + 2) {
            return (
              <span key={p} style={{ padding: '0 4px', color: 'var(--color-text-tertiary)' }}>
                ...
              </span>
            );
          }
          return null;
        })}

        <Button
          variant="secondary"
          size="sm"
          className="btn-icon-only"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          icon={<ChevronRight size={14} />}
        />
      </div>
    </div>
  );
};

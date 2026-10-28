import React from 'react';

export const Dashboard: React.FC = () => {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
      </div>
      {/* Intentionally left blank as instructed: no invented metrics, charts, or widgets */}
      <div className="panel" style={{ minHeight: '300px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      </div>
    </div>
  );
};

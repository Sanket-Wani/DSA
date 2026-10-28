import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';
import { FileLoggedIn } from './FileLoggedIn.js';
import { Disbursements } from './Disbursements.js';
import { Accounts } from './Accounts.js';

export type DashboardCardType = 'files' | 'disbursements' | 'accounts';

interface DashboardProps {
  initialCard?: DashboardCardType | null;
}

// Inward Concave Fillets for the Merged Tab effect
const LeftFillet: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    style={{
      position: 'absolute',
      bottom: '-1px',
      left: '-16px',
      zIndex: 21,
      pointerEvents: 'none'
    }}
    aria-hidden="true"
  >
    <path d="M 0,16 A 16,16 0 0,0 16,0 L 16,16 Z" fill="#ffffff" />
    <path d="M 0,16 A 16,16 0 0,0 16,0" fill="none" stroke="#e2e8f0" strokeWidth="1" />
  </svg>
);

const RightFillet: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    style={{
      position: 'absolute',
      bottom: '-1px',
      right: '-16px',
      zIndex: 21,
      pointerEvents: 'none'
    }}
    aria-hidden="true"
  >
    <path d="M 0,0 A 16,16 0 0,0 16,16 L 0,16 Z" fill="#ffffff" />
    <path d="M 0,0 A 16,16 0 0,0 16,16" fill="none" stroke="#e2e8f0" strokeWidth="1" />
  </svg>
);

export const Dashboard: React.FC<DashboardProps> = ({ initialCard = null }) => {
  // Default to 'disbursements' or 'files' (or initialCard)
  const [selectedCard, setSelectedCard] = useState<DashboardCardType>(initialCard || 'disbursements');

  // Live Metrics for the 3 Cards
  const [metrics, setMetrics] = useState({
    totalFiles: 0,
    disbursedFilesCount: 0,
    totalDisbursedAmount: 0,
    accountsCount: 0
  });

  const fetchMetrics = async () => {
    try {
      const [filesRes, disbRes, accRes] = await Promise.allSettled([
        apiRequest<{ pagination: { total: number } }>('/api/files?limit=1'),
        apiRequest<{ fileDisbursements: Array<{ total_disbursed_amount: number }> }>('/api/disbursements'),
        apiRequest<{ accounts: any[] }>('/api/accounts')
      ]);

      const totalFiles = filesRes.status === 'fulfilled' ? filesRes.value?.pagination?.total || 0 : 0;
      
      let disbursedFilesCount = 0;
      let totalDisbursedAmount = 0;
      if (disbRes.status === 'fulfilled' && Array.isArray(disbRes.value?.fileDisbursements)) {
        disbursedFilesCount = disbRes.value.fileDisbursements.length;
        totalDisbursedAmount = disbRes.value.fileDisbursements.reduce(
          (sum, d) => sum + (Number(d.total_disbursed_amount) || 0),
          0
        );
      }

      const accountsCount = accRes.status === 'fulfilled' && Array.isArray(accRes.value?.accounts)
        ? accRes.value.accounts.length
        : 0;

      setMetrics({
        totalFiles,
        disbursedFilesCount,
        totalDisbursedAmount,
        accountsCount
      });
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="page-content">
      {/* Dashboard Heading Row */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 600, color: '#111827', margin: 0 }}>Dashboard</h1>
          <div className="page-subtitle" style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Overview of loan files, disbursements, and accounts ledger.
          </div>
        </div>
      </div>

      <div className="dashboard-deck">
        {/* The 3 Cards Row */}
        <div className="dashboard-cards-grid" role="tablist" aria-label="Dashboard Modules">
          
          {/* Card 1: File Logged-in */}
          <div
            className={`dashboard-card ${selectedCard === 'files' ? 'active' : ''}`}
            onClick={() => setSelectedCard('files')}
            role="tab"
            aria-selected={selectedCard === 'files'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedCard('files');
              }
            }}
          >
            {/* When Card 1 is active, render bottom mask and right fillet */}
            {selectedCard === 'files' && (
              <>
                <div className="dashboard-card-bottom-mask" />
                <RightFillet />
              </>
            )}

            <div className="dashboard-card-title">File Logged-in</div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.totalFiles} Total Files
              </span>
            </div>
          </div>

          {/* Card 2: Disbursements */}
          <div
            className={`dashboard-card ${selectedCard === 'disbursements' ? 'active' : ''}`}
            onClick={() => setSelectedCard('disbursements')}
            role="tab"
            aria-selected={selectedCard === 'disbursements'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedCard('disbursements');
              }
            }}
          >
            {/* When Card 2 is active, render bottom mask, left fillet, and right fillet */}
            {selectedCard === 'disbursements' && (
              <>
                <LeftFillet />
                <div className="dashboard-card-bottom-mask" />
                <RightFillet />
              </>
            )}

            <div className="dashboard-card-title">Disbursements</div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.disbursedFilesCount} Disbursed Files
              </span>
              {metrics.totalDisbursedAmount > 0 && (
                <span className="dashboard-metric-badge">
                  ₹{metrics.totalDisbursedAmount.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Accounts */}
          <div
            className={`dashboard-card ${selectedCard === 'accounts' ? 'active' : ''}`}
            onClick={() => setSelectedCard('accounts')}
            role="tab"
            aria-selected={selectedCard === 'accounts'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedCard('accounts');
              }
            }}
          >
            {/* When Card 3 is active, render left fillet and bottom mask */}
            {selectedCard === 'accounts' && (
              <>
                <LeftFillet />
                <div className="dashboard-card-bottom-mask" />
              </>
            )}

            <div className="dashboard-card-title">Accounts</div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.accountsCount} Invoices in Ledger
              </span>
            </div>
          </div>

        </div>

        {/* Data Section Container — Dynamically merges with the active card */}
        <div
          className="dashboard-data-container"
          role="tabpanel"
          aria-label={`${selectedCard} workspace`}
          style={{
            borderTopLeftRadius: selectedCard === 'files' ? 0 : 20,
            borderTopRightRadius: selectedCard === 'accounts' ? 0 : 20
          }}
        >
          <div className="dashboard-embedded-content">
            {selectedCard === 'files' && <FileLoggedIn />}
            {selectedCard === 'disbursements' && <Disbursements />}
            {selectedCard === 'accounts' && <Accounts />}
          </div>
        </div>

      </div>
    </div>
  );
};


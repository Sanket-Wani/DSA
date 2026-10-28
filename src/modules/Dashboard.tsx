import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';
import { FileLoggedIn } from './FileLoggedIn.js';
import { Disbursements } from './Disbursements.js';
import { Accounts, computeRecordStatus } from './Accounts.js';
import { AccountsRecord } from '../types/index.js';

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

  // Live Section Details for the 3 Cards
  const [metrics, setMetrics] = useState({
    fileLoggedInCount: 0,
    disbursementsCount: 0,
    pendingInvoicesCount: 0,
    completedInvoicesCount: 0
  });

  const fetchMetrics = async () => {
    try {
      const [filesRes, disbRes, accRes] = await Promise.allSettled([
        apiRequest<{ pagination: { total: number; activeFilesCount?: number } }>('/api/files?limit=1'),
        apiRequest<{ fileDisbursements: any[] }>('/api/disbursements'),
        apiRequest<{ accounts: AccountsRecord[] }>('/api/accounts')
      ]);

      // 1. File Logged In: total files calculated by total records in this section (active files where status != 'Disburse')
      const fileLoggedInCount = filesRes.status === 'fulfilled'
        ? (filesRes.value?.pagination?.activeFilesCount ?? filesRes.value?.pagination?.total ?? 0)
        : 0;

      // 2. Disbursements: total files calculated by total records in this section
      const disbursementsCount = disbRes.status === 'fulfilled' && Array.isArray(disbRes.value?.fileDisbursements)
        ? disbRes.value.fileDisbursements.length
        : 0;

      // 3. Accounts: pending invoices, completed invoices
      let pendingInvoicesCount = 0;
      let completedInvoicesCount = 0;

      if (accRes.status === 'fulfilled' && Array.isArray(accRes.value?.accounts)) {
        accRes.value.accounts.forEach(acc => {
          const taxableTotal = Number(acc.invoice_taxable_amount || 0);
          const totalGst = acc.invoice_gst_amount !== undefined
            ? Number(acc.invoice_gst_amount)
            : (Number(acc.invoice_total_amount || 0) - taxableTotal);
          const tdsSec = acc.tds_section || '194J';
          const totalTds = tdsSec === '194H' ? taxableTotal * 0.10 : taxableTotal * 0.02;

          const enteredTaxable = Number(acc.taxable_amount || 0);
          const enteredGst = Number(acc.gst_amount || 0);
          const enteredTds = Number(acc.tds_amount || 0);

          const status = computeRecordStatus(
            enteredTaxable, taxableTotal,
            enteredGst, totalGst,
            enteredTds, totalTds
          );

          if (status === 'Complete') {
            completedInvoicesCount++;
          } else {
            pendingInvoicesCount++;
          }
        });
      }

      setMetrics({
        fileLoggedInCount,
        disbursementsCount,
        pendingInvoicesCount,
        completedInvoicesCount
      });
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [selectedCard]);

  return (
    <div className="page-content">
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
                {metrics.fileLoggedInCount} Total Files
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
                {metrics.disbursementsCount} Total Files
              </span>
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
                {metrics.pendingInvoicesCount} Pending Invoices
              </span>
              <span className="dashboard-metric-badge">
                {metrics.completedInvoicesCount} Completed Invoices
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


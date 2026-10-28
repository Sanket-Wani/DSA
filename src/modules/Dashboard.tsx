import React, { useState, useEffect } from 'react';
import {
  FileText,
  Banknote,
  BookOpen,
  Check
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { FileLoggedIn } from './FileLoggedIn.js';
import { Disbursements } from './Disbursements.js';
import { Accounts } from './Accounts.js';

export type DashboardCardType = 'files' | 'disbursements' | 'accounts';

interface DashboardProps {
  initialCard?: DashboardCardType | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ initialCard = null }) => {
  // Default to 'files' so workspace data is displayed immediately
  const [selectedCard, setSelectedCard] = useState<DashboardCardType>(initialCard || 'files');

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
      {/* Dashboard Heading Row (Section 8.1) */}
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">
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
            <div className="dashboard-card-top">
              <div className="dashboard-card-icon-badge">
                <FileText size={16} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'files' ? 'active' : ''}`}>
                {selectedCard === 'files' ? 'Active' : 'Stage 1'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">File Logged-in</div>
              <div className="dashboard-card-desc">
                Register new loan files, manage client details, and bank sanctions.
              </div>
            </div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.totalFiles} Total Files
              </span>
            </div>

            <div className="dashboard-card-status-line">
              <span>{selectedCard === 'files' ? 'Showing data below' : 'Click to view file records'}</span>
              {selectedCard === 'files' && <Check size={14} />}
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
            <div className="dashboard-card-top">
              <div className="dashboard-card-icon-badge">
                <Banknote size={16} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'disbursements' ? 'active' : ''}`}>
                {selectedCard === 'disbursements' ? 'Active' : 'Stage 2'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">Disbursements</div>
              <div className="dashboard-card-desc">
                Record single or multi-tranche loan disbursements against client files.
              </div>
            </div>

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

            <div className="dashboard-card-status-line">
              <span>{selectedCard === 'disbursements' ? 'Showing data below' : 'Click to view disbursements'}</span>
              {selectedCard === 'disbursements' && <Check size={14} />}
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
            <div className="dashboard-card-top">
              <div className="dashboard-card-icon-badge">
                <BookOpen size={16} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'accounts' ? 'active' : ''}`}>
                {selectedCard === 'accounts' ? 'Active' : 'Stage 3'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">Accounts</div>
              <div className="dashboard-card-desc">
                Collections ledger tracking received taxable value, GST, and TDS recovery.
              </div>
            </div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.accountsCount} Invoices in Ledger
              </span>
            </div>

            <div className="dashboard-card-status-line">
              <span>{selectedCard === 'accounts' ? 'Showing data below' : 'Click to view accounts ledger'}</span>
              {selectedCard === 'accounts' && <Check size={14} />}
            </div>
          </div>

        </div>

        {/* Data Section Container — Separated with 24px space, thin neutral border, no black outline */}
        <div
          className="dashboard-data-container"
          role="tabpanel"
          aria-label={`${selectedCard} workspace`}
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

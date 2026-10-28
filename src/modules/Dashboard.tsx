import React, { useState, useEffect } from 'react';
import {
  FileText,
  Banknote,
  BookOpen,
  ShieldCheck,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { FileLoggedIn } from './FileLoggedIn.js';
import { Disbursements } from './Disbursements.js';
import { Accounts } from './Accounts.js';
import { FileApprove } from './FileApprove.js';

export type DashboardCardType = 'files' | 'disbursements' | 'accounts';

interface DashboardProps {
  initialCard?: DashboardCardType | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ initialCard = null }) => {
  const { isSuperadmin } = useAuth();
  // Default to 'files' so the merged card view is active and visible immediately
  const [selectedCard, setSelectedCard] = useState<DashboardCardType>(initialCard || 'files');

  // Sub-tab inside File Logged-in card (File List vs Superadmin File Approve)
  const [fileSubTab, setFileSubTab] = useState<'files' | 'approvals'>('files');

  // Live Metrics for the 3 Cards
  const [metrics, setMetrics] = useState({
    totalFiles: 0,
    pendingApprovals: 0,
    disbursedFilesCount: 0,
    totalDisbursedAmount: 0,
    accountsCount: 0
  });

  const fetchMetrics = async () => {
    try {
      const [filesRes, disbRes, accRes, eligibleRes] = await Promise.allSettled([
        apiRequest<{ pagination: { total: number } }>('/api/files?limit=1'),
        apiRequest<{ fileDisbursements: Array<{ total_disbursed_amount: number }> }>('/api/disbursements'),
        apiRequest<{ accounts: any[] }>('/api/accounts'),
        isSuperadmin ? apiRequest<{ files: any[] }>('/api/files/eligible') : Promise.resolve({ files: [] })
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

      const pendingApprovals = eligibleRes.status === 'fulfilled' && Array.isArray(eligibleRes.value?.files)
        ? eligibleRes.value.files.length
        : 0;

      setMetrics({
        totalFiles,
        pendingApprovals,
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
  }, [isSuperadmin]);

  return (
    <div className="page-content">
      {/* Dashboard Top Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">
            Centralized operational deck — Click any card to switch the merged active workspace below.
          </div>
        </div>
      </div>

      <div className="dashboard-deck">
        {/* The 3 Big Cards in a Row */}
        <div className="dashboard-cards-grid" role="tablist" aria-label="Dashboard Pipeline Modules">
          
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
              <div className="dashboard-card-icon-badge theme-files">
                <FileText size={20} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'files' ? 'active' : ''}`}>
                {selectedCard === 'files' ? 'Active View' : 'Stage 1'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">File Logged-in</div>
              <div className="dashboard-card-desc">
                Register new loan files, manage client details, bank sanctions, and lead processing.
              </div>
            </div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.totalFiles} Total Files
              </span>
              {isSuperadmin && metrics.pendingApprovals > 0 && (
                <span className="dashboard-metric-badge highlight" title="Files awaiting Superadmin decision">
                  ⚠️ {metrics.pendingApprovals} To Approve
                </span>
              )}
            </div>

            <div className="dashboard-card-status-line">
              <span>{selectedCard === 'files' ? 'Merged with active workspace below' : 'Click to view file records'}</span>
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
              <div className="dashboard-card-icon-badge theme-disbursements">
                <Banknote size={20} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'disbursements' ? 'active' : ''}`}>
                {selectedCard === 'disbursements' ? 'Active View' : 'Stage 2'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">Disbursements</div>
              <div className="dashboard-card-desc">
                Record single or multi-tranche loan disbursements against verified client files.
              </div>
            </div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.disbursedFilesCount} Disbursed Files
              </span>
              {metrics.totalDisbursedAmount > 0 && (
                <span className="dashboard-metric-badge" style={{ color: '#047857', borderColor: '#A7F3D0' }}>
                  ₹{metrics.totalDisbursedAmount.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            <div className="dashboard-card-status-line">
              <span>{selectedCard === 'disbursements' ? 'Merged with active workspace below' : 'Click to view disbursements'}</span>
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
              <div className="dashboard-card-icon-badge theme-accounts">
                <BookOpen size={20} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'accounts' ? 'active' : ''}`}>
                {selectedCard === 'accounts' ? 'Active View' : 'Stage 3'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">Accounts</div>
              <div className="dashboard-card-desc">
                Collections ledger tracking received taxable value, GST payments, and TDS recovery.
              </div>
            </div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.accountsCount} Invoices in Ledger
              </span>
            </div>

            <div className="dashboard-card-status-line">
              <span>{selectedCard === 'accounts' ? 'Merged with active workspace below' : 'Click to view accounts ledger'}</span>
              {selectedCard === 'accounts' && <Check size={14} />}
            </div>
          </div>

        </div>

        {/* Merged Section Container — Seamlessly connected to the active card above */}
        <div
          className={`dashboard-merged-container active-card-${selectedCard}`}
          role="tabpanel"
          aria-label={`${selectedCard} workspace`}
        >
          {/* Sub-Tabs for File Logged-in if Superadmin */}
          {selectedCard === 'files' && isSuperadmin && (
            <div className="dashboard-section-subnav">
              <div className="dashboard-section-tabs">
                <button
                  className={`dashboard-section-tab-btn ${fileSubTab === 'files' ? 'active' : ''}`}
                  onClick={() => setFileSubTab('files')}
                >
                  File Registry
                </button>
                <button
                  className={`dashboard-section-tab-btn ${fileSubTab === 'approvals' ? 'active' : ''}`}
                  onClick={() => setFileSubTab('approvals')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} />
                    Approvals {metrics.pendingApprovals > 0 ? `(${metrics.pendingApprovals})` : ''}
                  </span>
                </button>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                {fileSubTab === 'files' ? 'Showing all client loan dossiers' : 'Superadmin decision review queue'}
              </div>
            </div>
          )}

          {/* Section Embedded Content */}
          <div className="dashboard-embedded-content">
            {selectedCard === 'files' && (
              fileSubTab === 'approvals' && isSuperadmin ? (
                <FileApprove />
              ) : (
                <FileLoggedIn />
              )
            )}

            {selectedCard === 'disbursements' && <Disbursements />}

            {selectedCard === 'accounts' && <Accounts />}
          </div>
        </div>

      </div>
    </div>
  );
};

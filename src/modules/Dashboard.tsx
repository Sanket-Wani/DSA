import React, { useState, useEffect } from 'react';
import {
  FileText,
  Banknote,
  BookOpen,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck,
  AlertCircle,
  LayoutGrid
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
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
  const [selectedCard, setSelectedCard] = useState<DashboardCardType | null>(initialCard);

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
      // Graceful degradation: metrics remain at default
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [isSuperadmin]);

  const handleCardClick = (card: DashboardCardType) => {
    // If the clicked card is already active, toggle collapse; otherwise open it
    if (selectedCard === card) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  return (
    <div className="page-content">
      {/* Dashboard Top Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">
            Centralized operational deck — Select any card to inspect or manage its data section below.
          </div>
        </div>
      </div>

      <div className="dashboard-deck">
        {/* The 3 Big Interactive Cards */}
        <div className="dashboard-cards-grid" role="tablist" aria-label="Dashboard Pipeline Modules">
          
          {/* Card 1: File Logged-in */}
          <div
            className={`dashboard-card ${selectedCard === 'files' ? 'active' : ''}`}
            onClick={() => handleCardClick('files')}
            role="tab"
            aria-selected={selectedCard === 'files'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick('files');
              }
            }}
          >
            <div className="dashboard-card-top">
              <div className="dashboard-card-icon-badge theme-files">
                <FileText size={22} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'files' ? 'active' : ''}`}>
                {selectedCard === 'files' ? 'Active View' : 'Stage 1'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">File Logged-in</div>
              <div className="dashboard-card-desc">
                Register new loan files, manage client details, bank sanctions, and lead processing workflow.
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
              <span>{selectedCard === 'files' ? 'Click to collapse section' : 'Click to view file records'}</span>
              {selectedCard === 'files' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {/* Card 2: Disbursements */}
          <div
            className={`dashboard-card ${selectedCard === 'disbursements' ? 'active' : ''}`}
            onClick={() => handleCardClick('disbursements')}
            role="tab"
            aria-selected={selectedCard === 'disbursements'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick('disbursements');
              }
            }}
          >
            <div className="dashboard-card-top">
              <div className="dashboard-card-icon-badge theme-disbursements">
                <Banknote size={22} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'disbursements' ? 'active' : ''}`}>
                {selectedCard === 'disbursements' ? 'Active View' : 'Stage 2'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">Disbursements</div>
              <div className="dashboard-card-desc">
                Record single or multi-tranche loan disbursements against verified and approved client files.
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
              <span>{selectedCard === 'disbursements' ? 'Click to collapse section' : 'Click to view disbursements'}</span>
              {selectedCard === 'disbursements' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {/* Card 3: Accounts */}
          <div
            className={`dashboard-card ${selectedCard === 'accounts' ? 'active' : ''}`}
            onClick={() => handleCardClick('accounts')}
            role="tab"
            aria-selected={selectedCard === 'accounts'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick('accounts');
              }
            }}
          >
            <div className="dashboard-card-top">
              <div className="dashboard-card-icon-badge theme-accounts">
                <BookOpen size={22} />
              </div>
              <span className={`dashboard-card-stage-pill ${selectedCard === 'accounts' ? 'active' : ''}`}>
                {selectedCard === 'accounts' ? 'Active View' : 'Stage 3'}
              </span>
            </div>

            <div>
              <div className="dashboard-card-title">Accounts</div>
              <div className="dashboard-card-desc">
                Collections ledger tracking received taxable value, GST payments, and TDS recovery reconciliation.
              </div>
            </div>

            <div className="dashboard-card-metrics">
              <span className="dashboard-metric-badge">
                {metrics.accountsCount} Invoices in Ledger
              </span>
            </div>

            <div className="dashboard-card-status-line">
              <span>{selectedCard === 'accounts' ? 'Click to collapse section' : 'Click to view accounts ledger'}</span>
              {selectedCard === 'accounts' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

        </div>

        {/* Dynamic Section Opened Below Respective Card */}
        {selectedCard ? (
          <div className="dashboard-section-container" role="region" aria-live="polite">
            
            {/* Section Header */}
            <div className="dashboard-section-header">
              <div className="dashboard-section-header-left">
                {selectedCard === 'files' && (
                  <>
                    <div className="dashboard-card-icon-badge theme-files" style={{ width: 32, height: 32 }}>
                      <FileText size={16} />
                    </div>
                    <div>
                      <div className="dashboard-section-header-title">File Logged-in Workspace</div>
                      <div className="dashboard-section-header-subtitle">
                        Client files registry, status workflow, and loan sanction allocations
                      </div>
                    </div>
                  </>
                )}

                {selectedCard === 'disbursements' && (
                  <>
                    <div className="dashboard-card-icon-badge theme-disbursements" style={{ width: 32, height: 32 }}>
                      <Banknote size={16} />
                    </div>
                    <div>
                      <div className="dashboard-section-header-title">Disbursements Workspace</div>
                      <div className="dashboard-section-header-subtitle">
                        Multi-tranche loan disbursement entries and historical records
                      </div>
                    </div>
                  </>
                )}

                {selectedCard === 'accounts' && (
                  <>
                    <div className="dashboard-card-icon-badge theme-accounts" style={{ width: 32, height: 32 }}>
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <div className="dashboard-section-header-title">Accounts Workspace</div>
                      <div className="dashboard-section-header-subtitle">
                        Taxable collections, GST receipts, and TDS recovery ledger
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sub-Tabs for File Logged-in (Superadmin Approval Queue) */}
              {selectedCard === 'files' && isSuperadmin && (
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
              )}

              {/* Close / Collapse Section Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCard(null)}
                icon={<X size={14} />}
                title="Collapse Section"
              >
                Collapse
              </Button>
            </div>

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
        ) : (
          /* Empty / Prompt State when no card is opened */
          <div className="dashboard-empty-prompt">
            <div className="dashboard-empty-prompt-icon">
              <LayoutGrid size={24} />
            </div>
            <div style={{ maxWidth: '420px' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                Select a Card to Open Workspace
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Click on <strong>File Logged-in</strong>, <strong>Disbursements</strong>, or <strong>Accounts</strong> above to open and manage its respective records directly below.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

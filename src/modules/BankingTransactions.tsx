import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RefreshCw, Check, AlertCircle, FileText, Download } from 'lucide-react';
import { Button } from '../components/Button.js';
import { Badge } from '../components/Badge.js';
import { BankingAccount, BankingTransaction } from '../types/index.js';
import { apiRequest } from '../api/client.js';

interface BankingTransactionsProps {
  account: BankingAccount;
  onBack: () => void;
  onAccountUpdated?: () => void;
}

export const BankingTransactions: React.FC<BankingTransactionsProps> = ({
  account,
  onBack,
  onAccountUpdated
}) => {
  const [transactions, setTransactions] = useState<BankingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<number, 'saving' | 'saved' | 'error'>>({});

  // Debounce timers for autosave
  const debounceTimers = useRef<Record<number, any>>({});

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ transactions: BankingTransaction[] }>(
        `/api/banking/accounts/${account.id}/transactions`
      );
      setTransactions(res.transactions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load account transactions.');
    } finally {
      setIsLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle remarks change with autosave
  const handleRemarksChange = (txnId: number, newRemarks: string) => {
    // 1. Optimistic local update
    setTransactions(prev =>
      prev.map(t => (t.id === txnId ? { ...t, remarks: newRemarks } : t))
    );

    // 2. Clear existing timer for this txn
    if (debounceTimers.current[txnId]) {
      clearTimeout(debounceTimers.current[txnId]);
    }

    // 3. Set status to saving
    setSaveStatus(prev => ({ ...prev, [txnId]: 'saving' }));

    // 4. Debounced network save (600ms)
    debounceTimers.current[txnId] = setTimeout(async () => {
      try {
        await apiRequest(`/api/banking/transactions/${txnId}/remarks`, {
          method: 'PUT',
          body: JSON.stringify({ remarks: newRemarks })
        });
        setSaveStatus(prev => ({ ...prev, [txnId]: 'saved' }));
        setTimeout(() => {
          setSaveStatus(prev => {
            const next = { ...prev };
            delete next[txnId];
            return next;
          });
        }, 2000);
      } catch {
        setSaveStatus(prev => ({ ...prev, [txnId]: 'error' }));
      }
    }, 600);
  };

  // Immediate blur save
  const handleRemarksBlur = async (txnId: number, remarks: string) => {
    if (debounceTimers.current[txnId]) {
      clearTimeout(debounceTimers.current[txnId]);
      delete debounceTimers.current[txnId];
    }
    setSaveStatus(prev => ({ ...prev, [txnId]: 'saving' }));
    try {
      await apiRequest(`/api/banking/transactions/${txnId}/remarks`, {
        method: 'PUT',
        body: JSON.stringify({ remarks })
      });
      setSaveStatus(prev => ({ ...prev, [txnId]: 'saved' }));
      setTimeout(() => {
        setSaveStatus(prev => {
          const next = { ...prev };
          delete next[txnId];
          return next;
        });
      }, 2000);
    } catch {
      setSaveStatus(prev => ({ ...prev, [txnId]: 'error' }));
    }
  };

  // Formatter for Indian currency
  const formatINR = (val: number) => {
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Total metrics
  const totalDebits = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredits = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
  const latestBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

  return (
    <div className="page-content">
      {/* Top Header with Back Navigation and Account Details */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            icon={<ArrowLeft size={15} />}
            title="Back to Banking Dashboard"
          >
            Back
          </Button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: '18px' }}>
                {account.bank_name}
              </h1>
              <Badge
                label={account.account_type === 'CA' ? 'Current' : 'Saving'}
                variant={account.account_type === 'CA' ? 'info' : 'neutral'}
                className="badge-compact"
              />
            </div>
            <div className="page-subtitle" style={{ fontSize: '12px', marginTop: '2px' }}>
              A/C: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{account.account_number}</span> | IFSC: <span style={{ fontFamily: 'monospace' }}>{account.ifsc_code}</span> | {account.branch} ({account.account_holder_name})
            </div>
          </div>
        </div>

        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchTransactions}
            disabled={isLoading}
            icon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        <div className="summary-pill-card" style={{ padding: '12px 16px', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Transactions</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{transactions.length}</div>
        </div>
        <div className="summary-pill-card" style={{ padding: '12px 16px', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600, textTransform: 'uppercase' }}>Total Debits (Outflow)</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#b91c1c', marginTop: '2px' }}>{formatINR(totalDebits)}</div>
        </div>
        <div className="summary-pill-card" style={{ padding: '12px 16px', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Total Credits (Inflow)</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', marginTop: '2px' }}>{formatINR(totalCredits)}</div>
        </div>
        <div className="summary-pill-card" style={{ padding: '12px 16px', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, textTransform: 'uppercase' }}>Latest Running Balance</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0369a1', marginTop: '2px' }}>{formatINR(latestBalance)}</div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>Dismiss</Button>
        </div>
      )}

      {/* Transaction Table */}
      <div className="banking-table-container" style={{ maxHeight: 'calc(100vh - 270px)', overflowY: 'auto' }}>
        <table className="banking-table" aria-label="Account Transactions Table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '110px', minWidth: '110px' }}>Transaction Date</th>
              <th scope="col" style={{ width: '380px', minWidth: '300px' }}>Particulars</th>
              <th scope="col" style={{ width: '130px', minWidth: '120px', textAlign: 'right' }}>Debit</th>
              <th scope="col" style={{ width: '130px', minWidth: '120px', textAlign: 'right' }}>Credit</th>
              <th scope="col" style={{ width: '140px', minWidth: '130px', textAlign: 'right' }}>Balance</th>
              <th scope="col" style={{ width: '260px', minWidth: '220px' }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                  <FileText size={36} strokeWidth={1.5} style={{ margin: '0 auto 8px auto', display: 'block', color: '#94a3b8' }} />
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: '#1e293b' }}>No Transactions Found</div>
                  <div style={{ fontSize: '12px', marginBottom: '12px' }}>
                    Upload a bank statement PDF from the Banking dashboard to import transactions for this account.
                  </div>
                  <Button variant="secondary" size="sm" onClick={onBack}>
                    Return to Dashboard
                  </Button>
                </td>
              </tr>
            ) : (
              transactions.map(t => (
                <tr key={t.id}>
                  {/* 1. Transaction Date */}
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px', fontWeight: 500, color: '#334155' }}>
                    {t.transaction_date}
                  </td>

                  {/* 2. Particulars */}
                  <td>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#0f172a',
                        lineHeight: 1.35,
                        wordBreak: 'break-word'
                      }}
                      title={t.particulars}
                    >
                      {t.particulars}
                    </div>
                  </td>

                  {/* 3. Debit */}
                  <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: '12.5px', color: t.debit > 0 ? '#b91c1c' : '#94a3b8', fontWeight: t.debit > 0 ? 600 : 400 }}>
                    {t.debit > 0 ? formatINR(t.debit) : '—'}
                  </td>

                  {/* 4. Credit */}
                  <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: '12.5px', color: t.credit > 0 ? '#15803d' : '#94a3b8', fontWeight: t.credit > 0 ? 600 : 400 }}>
                    {t.credit > 0 ? formatINR(t.credit) : '—'}
                  </td>

                  {/* 5. Balance */}
                  <td style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                    {formatINR(t.balance)}
                  </td>

                  {/* 6. Remarks (Autosaved) */}
                  <td>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={t.remarks || ''}
                        onChange={e => handleRemarksChange(t.id, e.target.value)}
                        onBlur={e => handleRemarksBlur(t.id, e.target.value)}
                        placeholder="Add remark..."
                        className="inline-field-input"
                        style={{
                          fontSize: '12px',
                          padding: '4px 28px 4px 8px',
                          height: '28px',
                          backgroundColor: '#ffffff'
                        }}
                      />
                      {saveStatus[t.id] === 'saving' && (
                        <span style={{ position: 'absolute', right: '6px', fontSize: '10px', color: '#64748b' }}>
                          <RefreshCw size={12} className="animate-spin" />
                        </span>
                      )}
                      {saveStatus[t.id] === 'saved' && (
                        <span style={{ position: 'absolute', right: '6px', color: '#16a34a' }} title="Saved">
                          <Check size={14} />
                        </span>
                      )}
                      {saveStatus[t.id] === 'error' && (
                        <span style={{ position: 'absolute', right: '6px', color: '#dc2626' }} title="Failed to save">
                          <AlertCircle size={14} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

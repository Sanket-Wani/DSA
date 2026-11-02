import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RefreshCw, Check, AlertCircle, FileText, Download, Pencil } from 'lucide-react';
import { Button } from '../components/Button.js';
import { Badge } from '../components/Badge.js';
import { BankingAccount, BankingTransaction } from '../types/index.js';
import { apiRequest } from '../api/client.js';

interface BankingTransactionsProps {
  account: BankingAccount;
  initialYear?: number;
  initialMonth?: number;
  onBack: () => void;
  onAccountUpdated?: () => void;
}

export const BankingTransactions: React.FC<BankingTransactionsProps> = ({
  account,
  initialYear,
  initialMonth,
  onBack,
  onAccountUpdated
}) => {
  // Format initial YYYY-MM
  const getDefaultYm = (): string => {
    const y = initialYear || new Date().getFullYear();
    const m = initialMonth || new Date().getMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const [currentYearMonth, setCurrentYearMonth] = useState<string>(getDefaultYm());
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<BankingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<number, 'saving' | 'saved' | 'error'>>({});
  const [editingTxnId, setEditingTxnId] = useState<number | null>(null);

  // Debounce timers for autosave
  const debounceTimers = useRef<Record<number, any>>({});

  const formatMonthDisplay = (ym: string): string => {
    if (!ym) return '';
    const parts = ym.split('-');
    if (parts.length !== 2) return ym;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (m >= 1 && m <= 12) {
      return `${monthNames[m - 1]} ${y}`;
    }
    return ym;
  };

  const fetchTransactions = useCallback(async (monthToFetch?: string) => {
    setIsLoading(true);
    setError(null);
    const targetMonth = monthToFetch !== undefined ? monthToFetch : currentYearMonth;
    try {
      const queryParam = targetMonth ? `?month=${encodeURIComponent(targetMonth)}` : '';
      const res = await apiRequest<{
        transactions: BankingTransaction[];
        available_months?: string[];
        selected_month?: string;
      }>(`/api/banking/accounts/${account.id}/transactions${queryParam}`);

      setTransactions(res.transactions || []);
      if (res.available_months) {
        setAvailableMonths(res.available_months);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load account transactions.');
    } finally {
      setIsLoading(false);
    }
  }, [account.id, currentYearMonth]);

  useEffect(() => {
    fetchTransactions(currentYearMonth);
  }, [currentYearMonth, fetchTransactions]);

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
        onAccountUpdated?.();
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
      onAccountUpdated?.();
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

  // Format date from YYYY-MM-DD to DD-MM-YYYY
  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dStr;
  };

  // Plain numeric formatting with Indian commas (No ₹ symbol)
  const formatAmount = (val: number) => {
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Total metrics
  const totalDebits = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredits = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
  const latestBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

  return (
    <div className="page-content">
      {/* Top Header with Back Navigation and Account Details */}
      <div className="page-header" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
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
              A/C: <span style={{ fontWeight: 600 }}>{account.account_number}</span> | IFSC: <span>{account.ifsc_code}</span> | {account.branch} ({account.account_holder_name})
            </div>
          </div>
        </div>

        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Month-Year Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Month:</span>
            <select
              value={currentYearMonth}
              onChange={(e) => {
                const newYm = e.target.value;
                setCurrentYearMonth(newYm);
                fetchTransactions(newYm);
              }}
              style={{
                height: '32px',
                padding: '0 24px 0 10px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                cursor: 'pointer'
              }}
              aria-label="Select Statement Month"
            >
              {!availableMonths.includes(currentYearMonth) && (
                <option value={currentYearMonth} disabled>
                  {formatMonthDisplay(currentYearMonth)} (0 txns)
                </option>
              )}
              {availableMonths.map(ym => (
                <option key={ym} value={ym}>
                  {formatMonthDisplay(ym)}
                </option>
              ))}
              {availableMonths.length === 0 && (
                <option value="" disabled>No statements uploaded</option>
              )}
            </select>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchTransactions(currentYearMonth)}
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
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Transactions ({formatMonthDisplay(currentYearMonth)})</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{transactions.length}</div>
        </div>
        <div className="summary-pill-card" style={{ padding: '12px 16px', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600, textTransform: 'uppercase' }}>Total Debits (Outflow)</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#b91c1c', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
            {formatAmount(totalDebits)}
          </div>
        </div>
        <div className="summary-pill-card" style={{ padding: '12px 16px', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Total Credits (Inflow)</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
            {formatAmount(totalCredits)}
          </div>
        </div>
        <div className="summary-pill-card" style={{ padding: '12px 16px', background: '#ffffff', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, textTransform: 'uppercase' }}>Latest Running Balance</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0369a1', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
            {formatAmount(latestBalance)}
          </div>
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
      <div className="transaction-table-container" style={{ maxHeight: 'calc(100vh - 270px)', overflowY: 'auto' }}>
        <table className="transaction-table" aria-label="Account Transactions Table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '100px', minWidth: '100px' }}>Date</th>
              <th scope="col" style={{ minWidth: '260px' }}>Particulars</th>
              <th scope="col" style={{ width: '115px', minWidth: '110px', textAlign: 'right' }}>Debit</th>
              <th scope="col" style={{ width: '115px', minWidth: '110px', textAlign: 'right' }}>Credit</th>
              <th scope="col" style={{ width: '125px', minWidth: '120px', textAlign: 'right' }}>Balance</th>
              <th scope="col" style={{ width: '250px', minWidth: '230px' }}>Remarks</th>
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
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: '#1e293b' }}>
                    No Transactions Found for {formatMonthDisplay(currentYearMonth)}
                  </div>
                  <div style={{ fontSize: '12px', marginBottom: '12px' }}>
                    Upload a bank statement PDF from the Banking dashboard to import transactions for this account.
                  </div>
                  <Button variant="secondary" size="sm" onClick={onBack}>
                    Return to Dashboard
                  </Button>
                </td>
              </tr>
            ) : (
              transactions.map(t => {
                const hasRemark = Boolean(t.remarks && t.remarks.trim());
                const isEditing = editingTxnId === t.id;
                const rowClass = hasRemark ? 'txn-row-filled' : 'txn-row-empty';

                return (
                  <tr key={t.id} className={rowClass}>
                    {/* 1. Transaction Date (DD-MM-YYYY) */}
                    <td style={{ fontSize: '12px', color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDisplayDate(t.transaction_date)}
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

                    {/* 3. Debit (Plain numeric, No ₹ symbol) */}
                    <td className="txn-amount-num" style={{ color: t.debit > 0 ? '#b91c1c' : '#94a3b8', fontWeight: t.debit > 0 ? 600 : 400 }}>
                      {t.debit > 0 ? formatAmount(t.debit) : '—'}
                    </td>

                    {/* 4. Credit (Plain numeric, No ₹ symbol) */}
                    <td className="txn-amount-num" style={{ color: t.credit > 0 ? '#15803d' : '#94a3b8', fontWeight: t.credit > 0 ? 600 : 400 }}>
                      {t.credit > 0 ? formatAmount(t.credit) : '—'}
                    </td>

                    {/* 5. Balance (Plain numeric, No ₹ symbol) */}
                    <td className="txn-amount-num" style={{ fontWeight: 600, color: '#0f172a' }}>
                      {formatAmount(t.balance)}
                    </td>

                    {/* 6. Remarks: State A (Empty: editable) vs State B (Existing: read-only + Edit button) */}
                    <td>
                      {!hasRemark || isEditing ? (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={t.remarks || ''}
                            onChange={e => handleRemarksChange(t.id, e.target.value)}
                            onBlur={e => {
                              handleRemarksBlur(t.id, e.target.value);
                              setEditingTxnId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                handleRemarksBlur(t.id, t.remarks || '');
                                setEditingTxnId(null);
                              } else if (e.key === 'Escape') {
                                setEditingTxnId(null);
                              }
                            }}
                            placeholder="Add remark..."
                            className="inline-field-input"
                            autoFocus={isEditing}
                            style={{
                              fontSize: '12px',
                              padding: '5px 28px 5px 8px',
                              height: '32px',
                              width: '100%',
                              backgroundColor: '#ffffff'
                            }}
                          />
                          {saveStatus[t.id] === 'saving' && (
                            <span style={{ position: 'absolute', right: '8px', fontSize: '10px', color: '#64748b' }}>
                              <RefreshCw size={12} className="animate-spin" />
                            </span>
                          )}
                          {saveStatus[t.id] === 'saved' && (
                            <span style={{ position: 'absolute', right: '8px', color: '#16a34a' }} title="Saved">
                              <Check size={14} />
                            </span>
                          )}
                          {saveStatus[t.id] === 'error' && (
                            <span style={{ position: 'absolute', right: '8px', color: '#dc2626' }} title="Failed to save">
                              <AlertCircle size={14} />
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            minHeight: '32px',
                            padding: '2px 0'
                          }}
                        >
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#0f172a',
                              lineHeight: 1.35,
                              wordBreak: 'break-word',
                              flex: 1
                            }}
                            title={t.remarks}
                          >
                            {t.remarks}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingTxnId(t.id)}
                            className="btn-remark-edit"
                            title="Edit remark"
                          >
                            <Pencil size={13} />
                          </button>
                          {saveStatus[t.id] === 'saved' && (
                            <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center' }} title="Saved">
                              <Check size={13} />
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

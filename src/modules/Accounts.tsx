import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { AccountsRecord, VoucherType, ReceivingAccount } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { Select } from '../components/Select.js';

export const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountsRecord[]>([]);
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [bankAccounts, setBankAccounts] = useState<ReceivingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expanded rows tracking: set of expanded invoice IDs
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Local draft edits per invoice ID: { [invoiceId]: Partial<AccountsRecord> }
  const [editDrafts, setEditDrafts] = useState<Record<string, any>>({});
  const [savingInvoiceId, setSavingInvoiceId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [accRes, vRes, bRes] = await Promise.all([
        apiRequest<{ accounts: AccountsRecord[] }>('/api/accounts'),
        apiRequest<{ voucherTypes: VoucherType[] }>('/api/voucher-types'),
        apiRequest<{ accounts: ReceivingAccount[] }>('/api/receiving-accounts')
      ]);

      setAccounts(accRes.accounts || []);
      setVoucherTypes(vRes.voucherTypes || []);
      setBankAccounts(bRes.accounts || []);

      // Initialize drafts with loaded database values
      const initialDrafts: Record<string, any> = {};
      (accRes.accounts || []).forEach(item => {
        initialDrafts[item.invoice_id] = {
          voucher_id: item.voucher_id || '',
          taxable_received_date: item.taxable_received_date || '',
          taxable_amount: item.taxable_amount !== null && item.taxable_amount !== undefined ? String(item.taxable_amount) : '',
          taxable_bank_account_id: item.taxable_bank_account_id || '',
          gst_received_date: item.gst_received_date || '',
          gst_amount: item.gst_amount !== null && item.gst_amount !== undefined ? String(item.gst_amount) : '',
          gst_account_id: item.gst_account_id || '',
          tds_amount: item.tds_amount !== null && item.tds_amount !== undefined ? String(item.tds_amount) : '',
          tds_recovery_status: item.tds_recovery_status || 'Pending'
        };
      });
      setEditDrafts(initialDrafts);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts ledger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const toggleRowExpansion = (invoiceId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const handleDraftChange = (invoiceId: string, field: string, val: any) => {
    setEditDrafts(prev => ({
      ...prev,
      [invoiceId]: {
        ...(prev[invoiceId] || {}),
        [field]: val
      }
    }));
  };

  const handleSaveRow = async (invoiceId: string) => {
    const draft = editDrafts[invoiceId];
    if (!draft) return;

    setSavingInvoiceId(invoiceId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest<{ message: string; account: AccountsRecord }>(`/api/accounts/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(draft)
      });

      setSuccessMsg(`Ledger sections updated successfully for Invoice.`);
      // Update local accounts state
      setAccounts(prev =>
        prev.map(item => (item.invoice_id === invoiceId ? { ...item, ...res.account } : item))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update accounts ledger');
    } finally {
      setSavingInvoiceId(null);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <div className="page-subtitle">
            Financial ledger of saved invoices with expandable receipt tracking for Taxable Value, GST, and TDS.
          </div>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            onClick={fetchAccounts}
            isLoading={isLoading}
            icon={<RefreshCw size={14} />}
          >
            Refresh Ledger
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setSuccessMsg(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Ledger Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }} aria-label="Expand row"></th>
              <th>Firm</th>
              <th>Invoice ID</th>
              <th>Year & Month</th>
              <th>Voucher</th>
              <th>Trade / Legal Name</th>
              <th>Client GST No.</th>
              <th>Invoice No.</th>
              <th>Invoice Date</th>
              <th style={{ textAlign: 'right' }}>Total Amount</th>
              <th style={{ textAlign: 'center' }}>Ledger Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={11} className="table-empty">
                  <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>No invoice ledger entries found</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                    Generate an invoice in Create Invoices to initialize an accounts ledger row.
                  </div>
                </td>
              </tr>
            ) : (
              accounts.map(acc => {
                const isExpanded = expandedRows.has(acc.invoice_id);
                const draft = editDrafts[acc.invoice_id] || {};
                const isSavingThis = savingInvoiceId === acc.invoice_id;

                const monthNames = [
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ];
                const yearMonthLabel = acc.month ? `${monthNames[acc.month - 1]} ${acc.year}` : `${acc.year}`;

                return (
                  <React.Fragment key={acc.invoice_id}>
                    {/* Read-Only Master Invoice Row */}
                    <tr>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn-icon-only"
                          onClick={() => toggleRowExpansion(acc.invoice_id)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse ledger sections' : 'Expand ledger sections'}
                          icon={isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>{acc.firm_name}</td>
                      <td>
                        <span className="num-tabular" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {acc.invoice_id.substring(0, 8)}...
                        </span>
                      </td>
                      <td>
                        <span className="num-tabular">{yearMonthLabel}</span>
                      </td>
                      <td style={{ minWidth: '150px' }}>
                        <select
                          value={draft.voucher_id || ''}
                          onChange={e => handleDraftChange(acc.invoice_id, 'voucher_id', e.target.value)}
                          className="select-control"
                          style={{ height: '32px', fontSize: 'var(--font-size-xs)' }}
                        >
                          <option value="">-- Select Voucher --</option>
                          {voucherTypes.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.voucher_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ fontWeight: 500 }}>{acc.trade_legal_name}</td>
                      <td>
                        <span className="num-tabular" style={{ fontSize: 'var(--font-size-xs)' }}>
                          {acc.gst_no || 'Unregistered'}
                        </span>
                      </td>
                      <td>
                        <span className="num-tabular" style={{ fontWeight: 600 }}>
                          {acc.invoice_number}
                        </span>
                      </td>
                      <td>
                        <span className="num-tabular">{acc.invoice_date}</span>
                      </td>
                      <td className="table-cell-num" style={{ fontWeight: 600 }}>
                        ₹{Number(acc.invoice_total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => toggleRowExpansion(acc.invoice_id)}
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                            textDecoration: 'underline',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {isExpanded ? 'Hide Details' : 'View / Edit Sections'}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Ledger Sections: Taxable Value, GST, TDS */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={11} className="expanded-row-cell">
                          <div className="expanded-row-content">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                Collection Ledger for Invoice {acc.invoice_number}
                              </div>
                              <Button
                                variant="primary"
                                size="sm"
                                isLoading={isSavingThis}
                                onClick={() => handleSaveRow(acc.invoice_id)}
                                icon={<Save size={14} />}
                              >
                                Save Ledger Details
                              </Button>
                            </div>

                            <div className="ledger-subsections">
                              {/* Section 1: Taxable Value */}
                              <div className="ledger-card">
                                <div className="ledger-card-title">
                                  <span>1. Taxable Value</span>
                                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    Inv: ₹{Number(acc.invoice_taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>

                                <Input
                                  type="date"
                                  label="Taxable Value Received Date"
                                  required
                                  value={draft.taxable_received_date || ''}
                                  onChange={e => handleDraftChange(acc.invoice_id, 'taxable_received_date', e.target.value)}
                                />

                                <Input
                                  type="number"
                                  step="0.01"
                                  label="Taxable Amount Received (₹)"
                                  required
                                  placeholder="e.g. 100000"
                                  value={draft.taxable_amount || ''}
                                  onChange={e => handleDraftChange(acc.invoice_id, 'taxable_amount', e.target.value)}
                                />

                                <Select
                                  label="Bank Account"
                                  required
                                  value={draft.taxable_bank_account_id || ''}
                                  onChange={e => handleDraftChange(acc.invoice_id, 'taxable_bank_account_id', e.target.value)}
                                >
                                  <option value="">-- Select Receiving Bank A/C --</option>
                                  {bankAccounts.map(b => (
                                    <option key={b.id} value={b.id}>
                                      {b.account_name} ({b.account_number})
                                    </option>
                                  ))}
                                </Select>
                              </div>

                              {/* Section 2: GST */}
                              <div className="ledger-card">
                                <div className="ledger-card-title">
                                  <span>2. GST Collection</span>
                                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    Statutory Tax
                                  </span>
                                </div>

                                <Input
                                  type="date"
                                  label="GST Value Received Date"
                                  required
                                  value={draft.gst_received_date || ''}
                                  onChange={e => handleDraftChange(acc.invoice_id, 'gst_received_date', e.target.value)}
                                />

                                <Input
                                  type="number"
                                  step="0.01"
                                  label="GST Amount Received (₹)"
                                  required
                                  placeholder="e.g. 18000"
                                  value={draft.gst_amount || ''}
                                  onChange={e => handleDraftChange(acc.invoice_id, 'gst_amount', e.target.value)}
                                />

                                <Select
                                  label="GST Account"
                                  required
                                  value={draft.gst_account_id || ''}
                                  onChange={e => handleDraftChange(acc.invoice_id, 'gst_account_id', e.target.value)}
                                >
                                  <option value="">-- Select GST Account --</option>
                                  {bankAccounts.map(b => (
                                    <option key={b.id} value={b.id}>
                                      {b.account_name} ({b.account_number})
                                    </option>
                                  ))}
                                </Select>
                              </div>

                              {/* Section 3: TDS */}
                              <div className="ledger-card">
                                <div className="ledger-card-title">
                                  <span>3. TDS Recovery</span>
                                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    Sec 194J / 194H
                                  </span>
                                </div>

                                <Input
                                  type="number"
                                  step="0.01"
                                  label="TDS Amount (₹)"
                                  required
                                  placeholder="e.g. 2000"
                                  value={draft.tds_amount || ''}
                                  onChange={e => handleDraftChange(acc.invoice_id, 'tds_amount', e.target.value)}
                                />

                                <Select
                                  label="TDS Recovery Status"
                                  required
                                  value={draft.tds_recovery_status || 'Pending'}
                                  onChange={e => handleDraftChange(acc.invoice_id, 'tds_recovery_status', e.target.value)}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Recovered">Recovered</option>
                                  <option value="Claimed in Return">Claimed in Return</option>
                                  <option value="Written Off">Written Off</option>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

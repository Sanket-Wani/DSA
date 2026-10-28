import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle, AlertCircle, Search, X } from 'lucide-react';
import { AccountsRecord, ReceivingAccount } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';

export type SectionStatus = 'Pending' | 'Partial' | 'Complete';

/**
 * Computes section status based on entered amount vs total target amount:
 * - 0 or empty -> Pending (Red)
 * - > 0 and < total -> Partial (Yellow)
 * - >= total -> Complete (Green)
 */
export function computeSectionStatus(enteredAmt: number, totalAmt: number): SectionStatus {
  if (isNaN(enteredAmt) || enteredAmt <= 0) {
    return 'Pending';
  }
  if (totalAmt > 0 && enteredAmt >= totalAmt) {
    return 'Complete';
  }
  return 'Partial';
}

/**
 * Computes table row record status:
 * - if all 3 sections have amount 0 -> Pending (Red)
 * - if all 3 sections are complete -> Complete (Green)
 * - if at least one section has partial status (or mixed complete/pending) -> Partial (Yellow)
 */
export function computeRecordStatus(
  taxableAmt: number,
  taxableTotal: number,
  gstAmt: number,
  gstTotal: number,
  tdsAmt: number,
  tdsTotal: number
): SectionStatus {
  if (taxableAmt <= 0 && gstAmt <= 0 && tdsAmt <= 0) {
    return 'Pending';
  }

  const s1 = computeSectionStatus(taxableAmt, taxableTotal);
  const s2 = computeSectionStatus(gstAmt, gstTotal);
  const s3 = computeSectionStatus(tdsAmt, tdsTotal);

  if (s1 === 'Complete' && s2 === 'Complete' && s3 === 'Complete') {
    return 'Complete';
  }

  return 'Partial';
}

function getSectionCardStyle(status: SectionStatus): React.CSSProperties {
  switch (status) {
    case 'Complete':
      return {
        backgroundColor: '#f0fdf4',
        border: '1.5px solid #86efac',
        borderRadius: '6px',
        padding: '12px 14px',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)'
      };
    case 'Partial':
      return {
        backgroundColor: '#fffbeb',
        border: '1.5px solid #fcd34d',
        borderRadius: '6px',
        padding: '12px 14px',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)'
      };
    case 'Pending':
    default:
      return {
        backgroundColor: '#fef2f2',
        border: '1.5px solid #fca5a5',
        borderRadius: '6px',
        padding: '12px 14px',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)'
      };
  }
}

function getRowStyle(status: SectionStatus, isExpanded: boolean): React.CSSProperties {
  switch (status) {
    case 'Complete':
      return {
        cursor: 'pointer',
        backgroundColor: isExpanded ? '#dcfce7' : '#f0fdf4',
        borderLeft: '4px solid #22c55e',
        transition: 'background-color 0.15s ease'
      };
    case 'Partial':
      return {
        cursor: 'pointer',
        backgroundColor: isExpanded ? '#fef3c7' : '#fffbeb',
        borderLeft: '4px solid #f59e0b',
        transition: 'background-color 0.15s ease'
      };
    case 'Pending':
    default:
      return {
        cursor: 'pointer',
        backgroundColor: isExpanded ? '#fee2e2' : '#fef2f2',
        borderLeft: '4px solid #ef4444',
        transition: 'background-color 0.15s ease'
      };
  }
}

function getStatusBadgeStyle(status: SectionStatus): React.CSSProperties {
  switch (status) {
    case 'Complete':
      return {
        backgroundColor: '#dcfce7',
        color: '#166534',
        border: '1px solid #86efac',
        padding: '2px 8px',
        borderRadius: '4px',
        fontWeight: 700,
        fontSize: '10.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.03em'
      };
    case 'Partial':
      return {
        backgroundColor: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fde68a',
        padding: '2px 8px',
        borderRadius: '4px',
        fontWeight: 700,
        fontSize: '10.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.03em'
      };
    case 'Pending':
    default:
      return {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        border: '1px solid #fca5a5',
        padding: '2px 8px',
        borderRadius: '4px',
        fontWeight: 700,
        fontSize: '10.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.03em'
      };
  }
}

export const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountsRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<ReceivingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Expanded rows tracking: set of expanded invoice IDs
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Local draft edits per invoice ID: { [invoiceId]: Partial<AccountsRecord> }
  const [editDrafts, setEditDrafts] = useState<Record<string, any>>({});
  const [savingInvoiceId, setSavingInvoiceId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [accRes, bRes] = await Promise.all([
        apiRequest<{ accounts: AccountsRecord[] }>('/api/accounts'),
        apiRequest<{ accounts: ReceivingAccount[] }>('/api/receiving-accounts')
      ]);

      setAccounts(accRes.accounts || []);
      setBankAccounts(bRes.accounts || []);

      // Initialize drafts with auto-computed statuses from database values
      const initialDrafts: Record<string, any> = {};
      (accRes.accounts || []).forEach(item => {
        const taxableVal = Number(item.invoice_taxable_amount || 0);
        const enteredTaxable = Number(item.taxable_amount || 0);
        const autoTaxableStatus = computeSectionStatus(enteredTaxable, taxableVal);

        const totalGst = item.invoice_gst_amount !== undefined
          ? Number(item.invoice_gst_amount)
          : (Number(item.invoice_total_amount || 0) - taxableVal);
        const enteredGst = Number(item.gst_amount || 0);
        const autoGstStatus = computeSectionStatus(enteredGst, totalGst);

        const tdsSec = (item.tds_section as '194J' | '194H') || '194J';
        const totalTds = tdsSec === '194H' ? taxableVal * 0.10 : taxableVal * 0.02;
        const enteredTds = Number(item.tds_amount || 0);
        const autoTdsStatus = computeSectionStatus(enteredTds, totalTds);

        initialDrafts[item.invoice_id] = {
          voucher_id: item.voucher_id || '',
          taxable_received_date: item.taxable_received_date || '',
          taxable_amount: item.taxable_amount !== null && item.taxable_amount !== undefined ? String(item.taxable_amount) : '',
          taxable_bank_account_id: item.taxable_bank_account_id || '',
          taxable_status: item.taxable_status || autoTaxableStatus,
          gst_received_date: item.gst_received_date || '',
          gst_amount: item.gst_amount !== null && item.gst_amount !== undefined ? String(item.gst_amount) : '',
          gst_account_id: item.gst_account_id || '',
          gst_status: item.gst_status || autoGstStatus,
          tds_received_date: item.tds_received_date || '',
          tds_amount: item.tds_amount !== null && item.tds_amount !== undefined ? String(item.tds_amount) : '',
          tds_bank_account_id: item.tds_bank_account_id || '',
          tds_section: tdsSec,
          tds_status: item.tds_status || autoTdsStatus
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

  // Auto-calculates status when amount changes
  const handleAmountChange = (
    invoiceId: string,
    section: 'taxable' | 'gst' | 'tds',
    value: string,
    targetTotal: number
  ) => {
    const num = parseFloat(value);
    const autoStatus = computeSectionStatus(isNaN(num) ? 0 : num, targetTotal);

    setEditDrafts(prev => {
      const cur = prev[invoiceId] || {};
      if (section === 'taxable') {
        return {
          ...prev,
          [invoiceId]: { ...cur, taxable_amount: value, taxable_status: autoStatus }
        };
      } else if (section === 'gst') {
        return {
          ...prev,
          [invoiceId]: { ...cur, gst_amount: value, gst_status: autoStatus }
        };
      } else {
        return {
          ...prev,
          [invoiceId]: { ...cur, tds_amount: value, tds_status: autoStatus }
        };
      }
    });
  };

  // Re-calculates TDS status when radio button 194J vs 194H changes
  const handleTdsSectionChange = (invoiceId: string, section: '194J' | '194H', taxableAmount: number) => {
    const tdsTarget = section === '194H' ? taxableAmount * 0.10 : taxableAmount * 0.02;
    setEditDrafts(prev => {
      const cur = prev[invoiceId] || {};
      const enteredTds = parseFloat(cur.tds_amount || '0');
      const autoStatus = computeSectionStatus(isNaN(enteredTds) ? 0 : enteredTds, tdsTarget);
      return {
        ...prev,
        [invoiceId]: {
          ...cur,
          tds_section: section,
          tds_status: autoStatus
        }
      };
    });
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

      setSuccessMsg(`Ledger sections updated successfully.`);
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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const filteredAccounts = accounts.filter(acc => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const mName = acc.month ? monthNames[acc.month - 1].toLowerCase() : '';
    return (
      (acc.firm_name && acc.firm_name.toLowerCase().includes(q)) ||
      (acc.company_name && acc.company_name.toLowerCase().includes(q)) ||
      (acc.trade_legal_name && acc.trade_legal_name.toLowerCase().includes(q)) ||
      (acc.client_name && acc.client_name.toLowerCase().includes(q)) ||
      (acc.gst_no && acc.gst_no.toLowerCase().includes(q)) ||
      (acc.invoice_number && acc.invoice_number.toLowerCase().includes(q)) ||
      String(acc.year).includes(q) ||
      mName.includes(q)
    );
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <div className="page-subtitle">
            Financial ledger of saved invoices with automated collection tracking for Taxable Value, GST, and TDS.
          </div>
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

      {/* Search & Actions Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div className="search-input-wrapper" style={{ width: '340px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search firm, client, GSTIN, year/month..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="search-clear"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
            {filteredAccounts.length} record{filteredAccounts.length === 1 ? '' : 's'}
          </span>
          <Button
            variant="secondary"
            size="md"
            onClick={fetchAccounts}
            isLoading={isLoading}
            icon={<RefreshCw size={14} />}
            aria-label="Refresh ledger"
          >
            Refresh Ledger
          </Button>
        </div>
      </div>

      {/* Main Ledger Table (5 Columns: Firm, Year & Month, Client / Company & GSTIN, Invoice Amount, Invoice Date) */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', width: '18%' }}>Firm</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', width: '16%' }}>Year & Month</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', width: '36%' }}>Client / Company & GSTIN</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right', width: '16%' }}>Invoice Amount (₹)</th>
              <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', width: '14%' }}>Invoice Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {search ? 'No ledger entries match your search query' : 'No invoice ledger entries found'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                    {search ? 'Try clearing or modifying your search filter.' : 'Generate an invoice in Create Invoices to initialize an accounts ledger row.'}
                  </div>
                </td>
              </tr>
            ) : (
              filteredAccounts.map(acc => {
                const isExpanded = expandedRows.has(acc.invoice_id);
                const draft = editDrafts[acc.invoice_id] || {};
                const isSavingThis = savingInvoiceId === acc.invoice_id;

                const yearMonthLabel = acc.month ? `${monthNames[acc.month - 1]} ${acc.year}` : `${acc.year}`;

                // Target total amounts for each section
                const totalTaxable = Number(acc.invoice_taxable_amount || 0);
                const totalGst = acc.invoice_gst_amount !== undefined
                  ? Number(acc.invoice_gst_amount)
                  : (Number(acc.invoice_total_amount || 0) - totalTaxable);
                const tdsSec = (draft.tds_section as '194J' | '194H') || '194J';
                const totalTds = tdsSec === '194H' ? totalTaxable * 0.10 : totalTaxable * 0.02;

                // Currently entered / draft amounts
                const enteredTaxable = draft.taxable_amount !== undefined && draft.taxable_amount !== ''
                  ? Number(draft.taxable_amount)
                  : Number(acc.taxable_amount || 0);
                const enteredGst = draft.gst_amount !== undefined && draft.gst_amount !== ''
                  ? Number(draft.gst_amount)
                  : Number(acc.gst_amount || 0);
                const enteredTds = draft.tds_amount !== undefined && draft.tds_amount !== ''
                  ? Number(draft.tds_amount)
                  : Number(acc.tds_amount || 0);

                // Section statuses and colors
                const taxableStatus = (draft.taxable_status as SectionStatus) || computeSectionStatus(enteredTaxable, totalTaxable);
                const gstStatus = (draft.gst_status as SectionStatus) || computeSectionStatus(enteredGst, totalGst);
                const tdsStatus = (draft.tds_status as SectionStatus) || computeSectionStatus(enteredTds, totalTds);

                // Overall record status and color
                const recordStatus = computeRecordStatus(
                  enteredTaxable, totalTaxable,
                  enteredGst, totalGst,
                  enteredTds, totalTds
                );

                const tdsRatePct = tdsSec === '194H' ? '10%' : '2%';
                const calculatedTdsHeader = `TDS: ₹${totalTds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

                return (
                  <React.Fragment key={acc.invoice_id}>
                    {/* Entire record row is clickable with dynamic color coding */}
                    <tr
                      className={`clickable-row ${isExpanded ? 'selected-row' : ''}`}
                      onClick={() => toggleRowExpansion(acc.invoice_id)}
                      style={getRowStyle(recordStatus, isExpanded)}
                      title={`Status: ${recordStatus}. Click to view and edit collection ledger details.`}
                    >
                      {/* 1. Firm */}
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>
                        {acc.firm_name || '—'}
                      </td>

                      {/* 2. Year & Month */}
                      <td>
                        <span className="num-tabular" style={{ fontWeight: 500, color: '#334155' }}>
                          {yearMonthLabel}
                        </span>
                      </td>

                      {/* 3. Client Company Name, Client Name, Client GSTIN */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>
                          {acc.company_name || acc.trade_legal_name || '—'}
                        </div>
                        {acc.client_name && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {acc.client_name}
                          </div>
                        )}
                        {acc.gst_no && acc.gst_no !== 'URP' && acc.gst_no !== 'Unregistered' ? (
                          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#475569', marginTop: '2px' }}>
                            GSTIN: <span style={{ fontWeight: 600, color: '#1e293b' }}>{acc.gst_no}</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            GSTIN: Unregistered (URP)
                          </div>
                        )}
                      </td>

                      {/* 4. Invoice Amount with Record Status Badge */}
                      <td className="table-cell-num">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            ₹{Number(acc.invoice_total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span style={getStatusBadgeStyle(recordStatus)}>
                            {recordStatus}
                          </span>
                        </div>
                      </td>

                      {/* 5. Invoice Date */}
                      <td>
                        <span className="num-tabular" style={{ color: '#475569', fontSize: '12.5px' }}>
                          {acc.invoice_date || '—'}
                        </span>
                      </td>
                    </tr>

                    {/* Expandable Ledger Sections: Taxable Value, GST, TDS */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="expanded-row-cell">
                          <div className="expanded-row-content" onClick={e => e.stopPropagation()}>
                            {/* Top action buttons: 'Collection Ledger for Invoice: ... Voucher:' removed */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '14px' }}>
                              <Button
                                variant="primary"
                                size="sm"
                                isLoading={isSavingThis}
                                onClick={() => handleSaveRow(acc.invoice_id)}
                                icon={<Save size={14} />}
                              >
                                Save Ledger Details
                              </Button>
                              <button
                                type="button"
                                onClick={() => toggleRowExpansion(acc.invoice_id)}
                                className="inline-btn-cancel"
                                style={{ height: '30px', padding: '0 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Close ledger details"
                              >
                                <X size={12} /> Close
                              </button>
                            </div>

                            <div className="ledger-subsections">
                              {/* Section 1: 1. Taxable Value */}
                              <div style={getSectionCardStyle(taxableStatus)}>
                                <div className="ledger-card-title">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>1. Taxable Value</span>
                                    <span style={getStatusBadgeStyle(taxableStatus)}>{taxableStatus}</span>
                                  </div>
                                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                    Inv: ₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                                  <input
                                    type="date"
                                    placeholder="Taxable Value Received Date"
                                    className="input-control"
                                    value={draft.taxable_received_date || ''}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'taxable_received_date', e.target.value)}
                                    title="Taxable Value Received Date"
                                  />

                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Taxable Amount Received (₹)"
                                    className="input-control"
                                    value={draft.taxable_amount || ''}
                                    onChange={e => handleAmountChange(acc.invoice_id, 'taxable', e.target.value, totalTaxable)}
                                    title="Taxable Amount Received (₹)"
                                  />

                                  <select
                                    value={draft.taxable_bank_account_id || ''}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'taxable_bank_account_id', e.target.value)}
                                    className="select-control"
                                    title="Bank Account"
                                  >
                                    <option value="">-- Bank Account --</option>
                                    {bankAccounts.map(b => (
                                      <option key={b.id} value={b.id}>
                                        {b.account_name} ({b.account_number})
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={draft.taxable_status || taxableStatus}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'taxable_status', e.target.value)}
                                    className="select-control"
                                    title="Status (Pending, Partial, Complete)"
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="Partial">Partial</option>
                                    <option value="Complete">Complete</option>
                                  </select>
                                </div>
                              </div>

                              {/* Section 2: 2. GST Collection */}
                              <div style={getSectionCardStyle(gstStatus)}>
                                <div className="ledger-card-title">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>2. GST Collection</span>
                                    <span style={getStatusBadgeStyle(gstStatus)}>{gstStatus}</span>
                                  </div>
                                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                    GST: ₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                                  <input
                                    type="date"
                                    placeholder="GST Value Received Date"
                                    className="input-control"
                                    value={draft.gst_received_date || ''}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'gst_received_date', e.target.value)}
                                    title="GST Value Received Date"
                                  />

                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="GST Amount Received (₹)"
                                    className="input-control"
                                    value={draft.gst_amount || ''}
                                    onChange={e => handleAmountChange(acc.invoice_id, 'gst', e.target.value, totalGst)}
                                    title="GST Amount Received (₹)"
                                  />

                                  <select
                                    value={draft.gst_account_id || ''}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'gst_account_id', e.target.value)}
                                    className="select-control"
                                    title="Bank Account"
                                  >
                                    <option value="">-- Bank Account --</option>
                                    {bankAccounts.map(b => (
                                      <option key={b.id} value={b.id}>
                                        {b.account_name} ({b.account_number})
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={draft.gst_status || gstStatus}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'gst_status', e.target.value)}
                                    className="select-control"
                                    title="Status (Pending, Partial, Complete)"
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="Partial">Partial</option>
                                    <option value="Complete">Complete</option>
                                  </select>
                                </div>
                              </div>

                              {/* Section 3: 3. TDS Recovery */}
                              <div style={getSectionCardStyle(tdsStatus)}>
                                <div className="ledger-card-title">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>3. TDS Recovery</span>
                                    <span style={getStatusBadgeStyle(tdsStatus)}>{tdsStatus}</span>
                                  </div>
                                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                    {calculatedTdsHeader}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                                  {/* Radio buttons for Sec 194J vs Sec 194H */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-around',
                                      padding: '6px 8px',
                                      backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(0, 0, 0, 0.08)'
                                    }}
                                  >
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', fontWeight: 600, color: tdsSec === '194J' ? '#1e3a8a' : '#475569' }}>
                                      <input
                                        type="radio"
                                        name={`tds_section_${acc.invoice_id}`}
                                        value="194J"
                                        checked={tdsSec === '194J'}
                                        onChange={() => handleTdsSectionChange(acc.invoice_id, '194J', totalTaxable)}
                                      />
                                      Sec 194J (2%)
                                    </label>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', fontWeight: 600, color: tdsSec === '194H' ? '#1e3a8a' : '#475569' }}>
                                      <input
                                        type="radio"
                                        name={`tds_section_${acc.invoice_id}`}
                                        value="194H"
                                        checked={tdsSec === '194H'}
                                        onChange={() => handleTdsSectionChange(acc.invoice_id, '194H', totalTaxable)}
                                      />
                                      Sec 194H (10%)
                                    </label>
                                  </div>

                                  <input
                                    type="date"
                                    placeholder="TDS Value Received Date"
                                    className="input-control"
                                    value={draft.tds_received_date || ''}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'tds_received_date', e.target.value)}
                                    title="TDS Value Received Date"
                                  />

                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="TDS Amount Received (₹)"
                                    className="input-control"
                                    value={draft.tds_amount || ''}
                                    onChange={e => handleAmountChange(acc.invoice_id, 'tds', e.target.value, totalTds)}
                                    title="TDS Amount Received (₹)"
                                  />

                                  <select
                                    value={draft.tds_bank_account_id || ''}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'tds_bank_account_id', e.target.value)}
                                    className="select-control"
                                    title="Bank Account"
                                  >
                                    <option value="">-- Bank Account --</option>
                                    {bankAccounts.map(b => (
                                      <option key={b.id} value={b.id}>
                                        {b.account_name} ({b.account_number})
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={draft.tds_status || tdsStatus}
                                    onChange={e => handleDraftChange(acc.invoice_id, 'tds_status', e.target.value)}
                                    className="select-control"
                                    title="Status (Pending, Partial, Complete)"
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="Partial">Partial</option>
                                    <option value="Complete">Complete</option>
                                  </select>
                                </div>
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

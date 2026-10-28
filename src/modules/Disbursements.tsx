import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, CheckCircle, AlertCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { FileRecord, DisbursementRecord } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';

interface EditableRow {
  id: string;
  amount: string;
  date: string;
}

export interface FileDisbursementRecord {
  file_id: string;
  sanction_loan_amount: number;
  company_name: string;
  client_name: string;
  gst_no?: string;
  bank_name: string;
  bank_manager_name?: string;
  product_name?: string;
  product_acronym?: string;
  disbursement_count: number;
  total_disbursed_amount: number;
  remaining_amount: number;
  latest_disbursement_date: string;
  latest_created_at: string;
}

export const Disbursements: React.FC = () => {
  // Search state
  const [search, setSearch] = useState('');

  // Lookup state
  const [lookupFileId, setLookupFileId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [fileData, setFileData] = useState<FileRecord | null>(null);
  const [existingDisbursements, setExistingDisbursements] = useState<DisbursementRecord[]>([]);
  const [totalDisbursed, setTotalDisbursed] = useState(0);

  // Individual Files Disbursements State
  const [fileDisbursements, setFileDisbursements] = useState<FileDisbursementRecord[]>([]);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'all'>('current');

  // Errors / Feedback
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Unsubmitted Rows for new disbursement entry
  const [rows, setRows] = useState<EditableRow[]>([
    { id: '1', amount: '', date: new Date().toISOString().split('T')[0] }
  ]);

  const loadAllPreviousDisbursements = async () => {
    setIsLoadingPrevious(true);
    try {
      const res = await apiRequest<{ 
        fileDisbursements: FileDisbursementRecord[];
        disbursements: any[];
      }>('/api/disbursements');
      setFileDisbursements(res.fileDisbursements || []);
    } catch (err) {
      console.error('Failed to load previous disbursements:', err);
    } finally {
      setIsLoadingPrevious(false);
    }
  };

  useEffect(() => {
    loadAllPreviousDisbursements();
  }, []);

  const fetchDisbursementsForFile = async (fileId: string) => {
    const query = fileId.trim();
    if (!query) {
      setLookupError('Please enter a File Logged-in ID');
      return;
    }

    setIsSearching(true);
    setLookupError(null);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const data = await apiRequest<{
        file: FileRecord;
        existingDisbursements: DisbursementRecord[];
        totalDisbursed: number;
      }>(`/api/disbursements/lookup/${encodeURIComponent(query)}`);

      setFileData(data.file);
      setExistingDisbursements(data.existingDisbursements || []);
      setTotalDisbursed(data.totalDisbursed || 0);
      setActiveTab('current');

      // Initialize with one empty row for new tranche entry
      setRows([{ id: String(Date.now()), amount: '', date: new Date().toISOString().split('T')[0] }]);
    } catch (err: any) {
      setLookupError(err.message || 'Lookup failed');
      setFileData(null);
      setExistingDisbursements([]);
      setTotalDisbursed(0);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLookup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchDisbursementsForFile(lookupFileId);
  };

  const handleSelectApprovedFile = (file: FileRecord) => {
    setLookupFileId(file.id);
    fetchDisbursementsForFile(file.id);
  };

  const handleAddRow = () => {
    setRows(prev => [
      ...prev,
      { id: String(Date.now() + Math.random()), amount: '', date: new Date().toISOString().split('T')[0] }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) {
      setRows([{ id: rows[0].id, amount: '', date: new Date().toISOString().split('T')[0] }]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleRowChange = (id: string, field: 'amount' | 'date', val: string) => {
    setRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const sanctionLoanAmount = fileData ? Number(fileData.sanction_loan_amount) : 0;
  const remainingBalance = fileData
    ? Math.max(0, sanctionLoanAmount - totalDisbursed)
    : 0;

  // Real-time calculation of new disbursement entries in form
  const newDisbursementsSum = rows.reduce((sum, r) => {
    const val = parseFloat(r.amount);
    return sum + (!isNaN(val) && val > 0 ? val : 0);
  }, 0);

  const projectedTotalDisbursed = totalDisbursed + newDisbursementsSum;
  const isExceedingSanction = fileData !== null && projectedTotalDisbursed > sanctionLoanAmount;
  const excessAmount = isExceedingSanction ? projectedTotalDisbursed - sanctionLoanAmount : 0;
  const isFullyDisbursed = fileData !== null && totalDisbursed >= sanctionLoanAmount;
  const validRows = rows.filter(r => r.amount.trim() !== '' && !isNaN(Number(r.amount)) && Number(r.amount) > 0);

  const filteredDisbursements = fileDisbursements.filter(f => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (f.file_id && f.file_id.toLowerCase().includes(q)) ||
      (f.company_name && f.company_name.toLowerCase().includes(q)) ||
      (f.client_name && f.client_name.toLowerCase().includes(q)) ||
      (f.gst_no && f.gst_no.toLowerCase().includes(q)) ||
      (f.bank_name && f.bank_name.toLowerCase().includes(q)) ||
      (f.bank_manager_name && f.bank_manager_name.toLowerCase().includes(q)) ||
      (f.product_name && f.product_name.toLowerCase().includes(q)) ||
      (f.product_acronym && f.product_acronym.toLowerCase().includes(q))
    );
  });

  const handleSaveDisbursements = async () => {
    if (!fileData) return;

    if (isExceedingSanction) {
      setSaveError(
        `Disbursement amount exceeds sanctioned loan limit by ₹${excessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Maximum allowable remaining disbursement is ₹${remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
      );
      return;
    }

    if (validRows.length === 0) {
      setSaveError('Please enter at least one valid disbursement amount to record.');
      return;
    }

    for (let i = 0; i < validRows.length; i++) {
      const amt = Number(validRows[i].amount);
      if (isNaN(amt) || amt <= 0) {
        setSaveError(`Row ${i + 1}: Disbursement amount must be a positive number.`);
        return;
      }
      if (!validRows[i].date) {
        setSaveError(`Row ${i + 1}: Disbursement date is required.`);
        return;
      }
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const payload = {
        file_id: fileData.id,
        rows: validRows.map(r => ({
          disbursement_amount: Number(r.amount),
          disbursement_date: r.date
        }))
      };

      const res = await apiRequest<{
        message: string;
        disbursements: DisbursementRecord[];
      }>('/api/disbursements', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSaveSuccess(res.message);
      setExistingDisbursements(res.disbursements || []);
      const newTotal = (res.disbursements || []).reduce((sum, d) => sum + Number(d.disbursement_amount), 0);
      setTotalDisbursed(newTotal);

      // Refresh all previous disbursements list
      loadAllPreviousDisbursements();

      // Reset new entry rows
      setRows([{ id: String(Date.now()), amount: '', date: new Date().toISOString().split('T')[0] }]);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save disbursements');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Disbursements</h1>
          <div className="page-subtitle">
            Record single or multi-tranche loan disbursements against verified and approved client files.
          </div>
        </div>
      </div>

      {/* Save Success / Error Alerts */}
      {saveSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          <CheckCircle size={16} />
          <span>{saveSuccess}</span>
          <Button variant="ghost" size="sm" onClick={() => setSaveSuccess(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}
      {saveError && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} />
          <span>{saveError}</span>
          <Button variant="ghost" size="sm" onClick={() => setSaveError(null)} style={{ marginLeft: 'auto' }}>
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
          marginBottom: '20px',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div className="search-input-wrapper" style={{ width: '340px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search file ID, client, product, bank..."
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

        <Button
          variant="secondary"
          size="md"
          onClick={loadAllPreviousDisbursements}
          isLoading={isLoadingPrevious}
        >
          Refresh
        </Button>
      </div>

      {/* 'Disbursed Amounts' List under the input field */}
      <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Disbursed Amounts {fileData ? `for File: ${fileData.id}` : ''}
              </div>
              {!fileData && (
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                  {filteredDisbursements.length} disbursed account{filteredDisbursements.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {fileData ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', borderRadius: '4px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: activeTab === 'current' ? 600 : 400,
                      backgroundColor: activeTab === 'current' ? 'var(--color-surface-subtle)' : '#fff',
                      color: activeTab === 'current' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      border: 'none',
                      borderRight: '1px solid var(--color-border)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveTab('current')}
                  >
                    File {fileData.id} ({existingDisbursements.length} tranches)
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: activeTab === 'all' ? 600 : 400,
                      backgroundColor: activeTab === 'all' ? 'var(--color-surface-subtle)' : '#fff',
                      color: activeTab === 'all' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveTab('all')}
                  >
                    All Disbursed Accounts ({filteredDisbursements.length})
                  </button>
                </div>

                {activeTab === 'current' && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Total Disbursed: <strong style={{ color: 'var(--color-text-primary)' }}>₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> of ₹{fileData.sanction_loan_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    <span style={{ margin: '0 6px', color: 'var(--color-text-tertiary)' }}>•</span>
                    Remaining: <strong style={{ color: remainingBalance > 0 ? '#b45309' : 'var(--color-success)' }}>₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Individual accounts showing the number of disbursements done till now
              </div>
            )}
          </div>

          {/* Render Current File Disbursements */}
          {fileData && activeTab === 'current' ? (
            existingDisbursements.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface-subtle)',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '13px'
                }}
              >
                No disbursement tranches recorded yet for file <strong>{fileData.id}</strong>. Add entries using the form below.
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tranche #</th>
                      <th>Disbursement Date</th>
                      <th style={{ textAlign: 'right' }}>Disbursed Amount (₹)</th>
                      <th>Recorded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingDisbursements.map((d, idx) => (
                      <tr key={d.id || idx}>
                        <td style={{ fontWeight: 600 }}>Tranche {idx + 1}</td>
                        <td className="num-tabular">{d.disbursement_date}</td>
                        <td className="table-cell-num" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          ₹{Number(d.disbursement_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {d.created_at ? d.created_at.split('T')[0] : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: 'var(--color-surface-subtle)', fontWeight: 600 }}>
                      <td colSpan={2} style={{ textAlign: 'right' }}>Total Disbursed:</td>
                      <td className="table-cell-num" style={{ fontWeight: 700, color: 'var(--color-action-primary)' }}>
                        ₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Render All Disbursed Files with Disbursement Count */
            filteredDisbursements.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface-subtle)',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '13px'
                }}
              >
                {isLoadingPrevious
                  ? 'Loading disbursement records...'
                  : search
                  ? 'No disbursement records match your search query.'
                  : 'No disbursed accounts recorded yet in the system.'}
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', width: '14%' }}>File ID</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', width: '28%' }}>Client / Company & GSTIN</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', width: '20%' }}>Bank & Bank Manager</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right', width: '13%' }}>Sanction Amount (₹)</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right', width: '13%' }}>Total Disbursed (₹)</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right', width: '12%' }}>Remaining Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDisbursements.map((f) => {
                      const isCurrentFile = fileData?.id === f.file_id;
                      return (
                        <tr
                          key={f.file_id}
                          className={`clickable-row ${isCurrentFile ? 'selected-row' : ''}`}
                          onClick={() => {
                            setLookupFileId(f.file_id);
                            fetchDisbursementsForFile(f.file_id);
                          }}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: isCurrentFile ? '#eff6ff' : undefined,
                            transition: 'background-color 0.15s ease'
                          }}
                          title={`Click to select file ${f.file_id} and view disbursement details`}
                        >
                          {/* 1. File ID */}
                          <td>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLookupFileId(f.file_id);
                                fetchDisbursementsForFile(f.file_id);
                              }}
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                fontSize: '12px',
                                color: isCurrentFile ? '#1d4ed8' : '#1e293b',
                                backgroundColor: isCurrentFile ? '#eff6ff' : '#f1f5f9',
                                border: `1px solid ${isCurrentFile ? '#bfdbfe' : '#e2e8f0'}`,
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              title={`Click to select ${f.file_id}`}
                            >
                              {f.file_id}
                            </button>
                          </td>

                          {/* 2. Client Company Name and Client Name and GSTIN */}
                          <td>
                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>
                              {f.company_name || '—'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              {f.client_name || ''}
                            </div>
                            {f.gst_no && f.gst_no !== 'URP' ? (
                              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#475569', marginTop: '2px' }}>
                                GSTIN: <span style={{ fontWeight: 600, color: '#1e293b' }}>{f.gst_no}</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                GSTIN: Unregistered (URP)
                              </div>
                            )}
                          </td>

                          {/* 3. Bank and Bank Manager */}
                          <td>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                              {f.bank_name || '—'}
                            </div>
                            {f.bank_manager_name ? (
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                Mgr: <span style={{ color: '#334155' }}>{f.bank_manager_name}</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                                Mgr: —
                              </div>
                            )}
                          </td>

                          {/* 4. Sanction Amount */}
                          <td className="table-cell-num" style={{ fontWeight: 600 }}>
                            ₹{Number(f.sanction_loan_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* 5. Total Disbursed */}
                          <td className="table-cell-num" style={{ fontWeight: 700, color: '#111827' }}>
                            ₹{Number(f.total_disbursed_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* 6. Remaining Amount */}
                          <td
                            className="table-cell-num"
                            style={{
                              color: f.remaining_amount > 0 ? '#b45309' : '#16a34a',
                              fontWeight: 600
                            }}
                          >
                            ₹{Number(f.remaining_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

      {/* Autofetched File Details and Disbursement Entry */}
      {fileData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* File Metadata Overview Card */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Linked Approved File: {fileData.id}</h2>
                <div className="panel-description">Autofetched canonical details from database</div>
              </div>
              <span className="badge badge-success">
                <span className="badge-dot" /> {fileData.status || 'Disburse'}
              </span>
            </div>

            <div className="grid-3" style={{ marginTop: '12px' }}>
              <div>
                <label className="form-label">Client Company Name</label>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>{fileData.company_name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  GST: {fileData.gst_no}
                </div>
              </div>

              <div>
                <label className="form-label">Client Contact & Email</label>
                <div style={{ fontWeight: 500 }}>{fileData.client_name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {fileData.client_email}
                </div>
              </div>

              <div>
                <label className="form-label">Sanction Loan Amount</label>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
                  ₹{fileData.sanction_loan_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid-3" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <div>
                <label className="form-label">Bank Name</label>
                <div>{fileData.bank_name}</div>
              </div>

              <div>
                <label className="form-label">Product</label>
                <div>{fileData.product_name} ({fileData.product_acronym})</div>
              </div>

              <div>
                <label className="form-label">Case Sourced</label>
                <div>{fileData.source || '—'}</div>
              </div>
            </div>
          </div>

          {/* Multiple Disbursements Entry Form */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title" style={{ fontSize: 'var(--font-size-md)' }}>
                  Record New Disbursement Tranche(s)
                </h3>
                <div className="panel-description">
                  Add one or more disbursement tranches for this file. Each entry requires an amount and a date.
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddRow}
                icon={<Plus size={14} />}
                disabled={isFullyDisbursed}
              >
                Add Disbursement Row
              </Button>
            </div>

            {/* Alert when total disbursement exceeds sanction amount */}
            {isExceedingSanction && (
              <div
                className="alert alert-danger"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }}
              >
                <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#991b1b', marginBottom: '4px' }}>
                    Exceeds Sanctioned Loan Amount Limit!
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: '1.5' }}>
                    The addition of disbursement amounts (Existing: <strong>₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> + New Entries: <strong>₹{newDisbursementsSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> = <strong>₹{projectedTotalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>) exceeds the sanctioned loan amount of <strong>₹{sanctionLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> by <strong style={{ color: '#b91c1c', fontSize: '13px' }}>₹{excessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>.
                  </div>
                  <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '6px', fontWeight: 600 }}>
                    Maximum allowable remaining disbursement for this file is <u>₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</u>. Please reduce the entered tranche amount(s) to enable saving.
                  </div>
                </div>
              </div>
            )}

            {/* Fully Disbursed Notice */}
            {isFullyDisbursed && !isExceedingSanction && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  color: '#166534',
                  fontSize: '13px'
                }}
              >
                <CheckCircle size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div>
                  <strong>Sanction Limit Reached:</strong> This file is already 100% disbursed (<strong>₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> of ₹{sanctionLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}). Remaining allowable disbursement is <strong>₹0.00</strong>.
                </div>
              </div>
            )}

            {/* Real-time Calculation Summary Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: isExceedingSanction ? '#fff1f2' : 'var(--color-surface-subtle)',
                borderRadius: '6px',
                border: `1px solid ${isExceedingSanction ? '#fecdd3' : 'var(--color-border)'}`,
                fontSize: '12px',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div>
                Sanction Amount: <strong className="num-tabular">₹{sanctionLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>•</div>
              <div>
                Already Disbursed: <strong className="num-tabular">₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>•</div>
              <div>
                New Tranches: <strong className="num-tabular" style={{ color: isExceedingSanction ? '#dc2626' : 'var(--color-text-primary)' }}>₹{newDisbursementsSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>•</div>
              <div>
                Projected Total: <strong className="num-tabular" style={{ color: isExceedingSanction ? '#dc2626' : 'var(--color-action-primary)' }}>₹{projectedTotalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>•</div>
              <div>
                {isExceedingSanction ? (
                  <span style={{ color: '#dc2626', fontWeight: 700 }} className="num-tabular">
                    Exceeds Limit by ₹{excessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span style={{ color: remainingBalance - newDisbursementsSum > 0 ? '#b45309' : 'var(--color-success)', fontWeight: 600 }} className="num-tabular">
                    Remaining: ₹{Math.max(0, remainingBalance - newDisbursementsSum).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rows.map((row, index) => {
                const rowAmt = parseFloat(row.amount);
                const isRowExcessive = !isNaN(rowAmt) && rowAmt > remainingBalance;
                return (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px minmax(0, 1fr) minmax(0, 1fr) 48px',
                      gap: '12px',
                      alignItems: 'flex-start',
                      padding: '12px',
                      backgroundColor: isRowExcessive ? '#fff5f5' : 'var(--color-surface-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isRowExcessive ? '#fca5a5' : 'var(--color-border)'}`
                    }}
                  >
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, paddingTop: '10px' }}>
                      #{index + 1}
                    </div>

                    <div>
                      <Input
                        type="number"
                        step="0.01"
                        label="Disbursement Loan Amount (₹)"
                        required
                        placeholder="e.g. 1500000"
                        value={row.amount}
                        onChange={e => handleRowChange(row.id, 'amount', e.target.value)}
                        error={isRowExcessive ? `Exceeds max available remaining ₹${remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : undefined}
                      />
                    </div>

                    <div>
                      <Input
                        type="date"
                        label="Disbursement Date"
                        required
                        value={row.date}
                        onChange={e => handleRowChange(row.id, 'date', e.target.value)}
                      />
                    </div>

                    <div style={{ paddingTop: '24px' }}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        className="btn-icon-only"
                        onClick={() => handleRemoveRow(row.id)}
                        aria-label="Remove row"
                        icon={<Trash2 size={16} color="var(--color-danger)" />}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: isExceedingSanction ? '#dc2626' : 'var(--color-text-secondary)', fontWeight: isExceedingSanction ? 600 : 400 }}>
                {isExceedingSanction
                  ? `Cannot save: Total disbursements exceed sanctioned loan limit by ₹${excessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
                  : isFullyDisbursed
                  ? 'File is already fully disbursed.'
                  : `Allowable limit remaining: ₹${remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`}
              </div>

              <Button
                variant="primary"
                onClick={handleSaveDisbursements}
                isLoading={isSaving}
                disabled={isExceedingSanction || isFullyDisbursed || validRows.length === 0}
                icon={<CheckCircle size={16} />}
                title={
                  isExceedingSanction
                    ? `Cannot save: Total disbursements exceed sanctioned loan amount by ₹${excessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : isFullyDisbursed
                    ? 'Loan amount already fully disbursed'
                    : validRows.length === 0
                    ? 'Please enter valid disbursement amounts'
                    : 'Save Disbursement Entries'
                }
              >
                Save Disbursement Entries
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

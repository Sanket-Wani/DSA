import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, CheckCircle, AlertCircle, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { FileRecord, DisbursementRecord } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { numberToWordsIndian } from '../utils/numberToWords.js';

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

      // Refresh all previous disbursements list in table
      await loadAllPreviousDisbursements();

      // Reset new entry rows
      setRows([{ id: String(Date.now()), amount: '', date: new Date().toISOString().split('T')[0] }]);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save disbursements');
    } finally {
      setIsSaving(false);
    }
  };

  const formatLoginDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const fileBanks = fileData?.banks && fileData.banks.length > 0
    ? fileData.banks
    : fileData
    ? [
        {
          bank_name: fileData.bank_name || '—',
          bank_manager_name: fileData.bank_manager_name || '—',
          sanction_loan_amount: fileData.sanction_loan_amount
        }
      ]
    : [];

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
      {lookupError && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} />
          <span>{lookupError}</span>
          <Button variant="ghost" size="sm" onClick={() => setLookupError(null)} style={{ marginLeft: 'auto' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
            {filteredDisbursements.length} record{filteredDisbursements.length === 1 ? '' : 's'}
          </span>
          <Button
            variant="secondary"
            size="md"
            onClick={loadAllPreviousDisbursements}
            isLoading={isLoadingPrevious}
            icon={<RefreshCw size={14} />}
            aria-label="Refresh list"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* DETAILED VIEW: FILE LOGGED-IN HORIZONTAL FORM DISPLAY WITH ATTACHED DISBURSEMENT SECTION */}
      {fileData && (
        <div className="separate-file-form-card" style={{ marginBottom: '24px' }}>
          {/* Header of Detailed View */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              paddingBottom: '8px',
              borderBottom: '1px solid #cbd5e1',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1e3a8a',
                  backgroundColor: '#dbeafe',
                  border: '1px solid #bfdbfe',
                  padding: '3px 10px',
                  borderRadius: '4px'
                }}
              >
                Disbursed File Details: {fileData.id}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {fileData.firm_name || 'Mavin Credits'} • {fileData.company_name} ({fileData.client_name})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFileData(null);
                setLookupFileId('');
              }}
              className="inline-btn-cancel"
              style={{
                height: '28px',
                padding: '0 10px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title="Close detailed view and revert to table"
            >
              <X size={13} /> Close View
            </button>
          </div>

          {/* 6-Column Horizontal Grid Replicating File Logged-In Formatting */}
          <div className="new-file-form-6col-grid">
            {/* Column 1 Box: File ID, Date, Product */}
            <div className="form-card-box">
              <input
                type="text"
                readOnly
                value={fileData.id}
                className="inline-field-input inline-field-input-readonly"
                title={`File ID: ${fileData.id}`}
              />

              <input
                type="text"
                readOnly
                value={formatLoginDate(fileData.login_date) || fileData.login_date || ''}
                className="inline-field-input inline-field-input-readonly"
                title={`Login Date: ${formatLoginDate(fileData.login_date)}`}
              />

              <input
                type="text"
                readOnly
                value={`${fileData.product_acronym ? fileData.product_acronym + ' — ' : ''}${fileData.product_name || 'Product'}`}
                className="inline-field-input inline-field-input-readonly"
                title={`Product: ${fileData.product_name} (${fileData.product_acronym})`}
              />
            </div>

            {/* Column 2 Box: Clients Company name, Clients name, Clients GSTIN */}
            <div className="form-card-box">
              <input
                type="text"
                readOnly
                value={fileData.company_name || ''}
                className="inline-field-input inline-field-input-readonly"
                title={`Company Name: ${fileData.company_name}`}
              />

              <input
                type="text"
                readOnly
                value={fileData.client_name || ''}
                className="inline-field-input inline-field-input-readonly"
                title={`Client Name: ${fileData.client_name}`}
              />

              <input
                type="text"
                readOnly
                value={fileData.gst_no && fileData.gst_no !== 'URP' ? fileData.gst_no : 'URP (Unregistered)'}
                className="inline-field-input inline-field-input-readonly"
                style={{ textTransform: 'uppercase' }}
                title={`GSTIN: ${fileData.gst_no || 'URP'}`}
              />
            </div>

            {/* Columns 3 to 5 Middle Area: Spans 3 columns with Upper & Lower boxes */}
            <div className="form-6col-middle-area">
              {/* Upper Box: Firm name, Office Sales Member Name, Code, Case source */}
              <div className="form-card-box form-middle-upper-box">
                <div className="form-3col-row">
                  <input
                    type="text"
                    readOnly
                    value={fileData.firm_name || 'Mavin Credits'}
                    className="inline-field-input inline-field-input-readonly"
                    title={`Firm: ${fileData.firm_name || 'Mavin Credits'}`}
                  />

                  <input
                    type="text"
                    readOnly
                    value={fileData.sales_member_name || (fileData as any).sales_member || '—'}
                    className="inline-field-input inline-field-input-readonly"
                    title={`Sales Member: ${fileData.sales_member_name || '—'}`}
                  />

                  <input
                    type="text"
                    readOnly
                    value={fileData.code || '—'}
                    className="inline-field-input inline-field-input-readonly"
                    title={`Code: ${fileData.code || '—'}`}
                  />
                </div>

                <div className="form-3col-row">
                  <input
                    type="text"
                    readOnly
                    value={fileData.source ? `Source: ${fileData.source}` : 'Source: —'}
                    className="inline-field-input inline-field-input-readonly"
                    title={`Source: ${fileData.source || '—'}`}
                  />

                  <input
                    type="text"
                    readOnly
                    value={fileData.client_phone ? `Phone: ${fileData.client_phone}` : 'Phone: —'}
                    className="inline-field-input inline-field-input-readonly"
                    title={`Phone: ${fileData.client_phone || '—'}`}
                  />

                  <input
                    type="text"
                    readOnly
                    value={fileData.client_email ? `Email: ${fileData.client_email}` : 'Email: —'}
                    className="inline-field-input inline-field-input-readonly"
                    title={`Email: ${fileData.client_email || '—'}`}
                  />
                </div>
              </div>

              {/* Lower Box: Bank, Bank Manager / Consultant Name */}
              <div className="form-card-box form-middle-lower-box">
                {fileBanks.map((b, idx) => (
                  <div key={idx} className="form-3col-row" style={{ alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={b.bank_name || '—'}
                      className="inline-field-input inline-field-input-readonly"
                      title={`Bank: ${b.bank_name}`}
                    />

                    <input
                      type="text"
                      readOnly
                      value={b.bank_manager_name ? `Mgr: ${b.bank_manager_name}` : 'Mgr: —'}
                      className="inline-field-input inline-field-input-readonly"
                      title={`Bank Manager: ${b.bank_manager_name || '—'}`}
                    />

                    <input
                      type="text"
                      readOnly
                      value={b.sanction_loan_amount ? `Sanction: ₹${Number(b.sanction_loan_amount).toLocaleString('en-IN')}` : '—'}
                      className="inline-field-input inline-field-input-readonly"
                      style={{ fontWeight: 600, color: '#047857' }}
                      title={`Sanction: ₹${Number(b.sanction_loan_amount || 0).toLocaleString('en-IN')}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Column 6: Status at top, TOTAL SANCTIONED AMOUNT prominently featured */}
            <div className="col-6-status-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'space-between', height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* File Status Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px 8px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '6px',
                    color: '#065f46',
                    fontWeight: 700,
                    fontSize: '11.5px',
                    textAlign: 'center',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  title="File Status: Disburse"
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '6px', display: 'inline-block' }} />
                  {fileData.status || 'Disburse'}
                </div>

                {/* Total Sanctioned Amount Highlight Box */}
                <div
                  style={{
                    backgroundColor: '#eff6ff',
                    border: '1.5px solid #93c5fd',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    textAlign: 'center',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Sanctioned Amount
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e3a8a', marginTop: '2px', fontFamily: 'monospace' }}>
                    ₹{Number(fileData.sanction_loan_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#2563eb', marginTop: '2px', fontWeight: 500, lineHeight: 1.2 }}>
                    {numberToWordsIndian(Number(fileData.sanction_loan_amount))}
                  </div>
                </div>
              </div>

              {/* Close View Action */}
              <button
                type="button"
                onClick={() => {
                  setFileData(null);
                  setLookupFileId('');
                }}
                className="inline-btn-cancel"
                style={{
                  width: '100%',
                  height: '32px',
                  fontSize: '11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title="Close detailed view"
              >
                <X size={12} /> Close View
              </button>
            </div>
          </div>

          {/* ATTACHED SECTION DIRECTLY UNDERNEATH TO ADD DISBURSEMENT AMOUNT & DATE */}
          <div
            style={{
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px dashed #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {/* Financial Summary & Visual Progress Bar */}
            <div
              style={{
                backgroundColor: isExceedingSanction ? '#fff1f2' : '#f8fafc',
                border: `1px solid ${isExceedingSanction ? '#fecdd3' : '#e2e8f0'}`,
                borderRadius: '6px',
                padding: '10px 14px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  fontSize: '12px'
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>Total Sanctioned:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>
                    ₹{sanctionLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div style={{ color: '#cbd5e1' }}>•</div>

                <div>
                  <span style={{ color: '#64748b' }}>Already Disbursed:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>
                    ₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>{' '}
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    ({((totalDisbursed / (sanctionLoanAmount || 1)) * 100).toFixed(1)}%)
                  </span>
                </div>

                <div style={{ color: '#cbd5e1' }}>•</div>

                <div>
                  <span style={{ color: '#64748b' }}>New Tranche Entries:</span>{' '}
                  <strong style={{ color: isExceedingSanction ? '#dc2626' : '#2563eb' }}>
                    ₹{newDisbursementsSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div style={{ color: '#cbd5e1' }}>•</div>

                <div>
                  <span style={{ color: '#64748b' }}>Remaining Balance:</span>{' '}
                  <strong
                    style={{
                      color:
                        remainingBalance - newDisbursementsSum > 0
                          ? '#b45309'
                          : isExceedingSanction
                          ? '#dc2626'
                          : '#16a34a'
                    }}
                  >
                    ₹{Math.max(0, remainingBalance - newDisbursementsSum).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  marginTop: '8px'
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (projectedTotalDisbursed / (sanctionLoanAmount || 1)) * 100)}%`,
                    height: '100%',
                    backgroundColor: isExceedingSanction
                      ? '#dc2626'
                      : isFullyDisbursed
                      ? '#16a34a'
                      : '#2563eb',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>

            {/* PREVIOUS DISBURSEMENTS (Shown when 1 or more previous disbursements exist) */}
            {existingDisbursements.length > 0 && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Recorded Previous Disbursements ({existingDisbursements.length} Tranche{existingDisbursements.length === 1 ? '' : 's'})
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Total Disbursed: <strong style={{ color: '#0f172a' }}>₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> of ₹{sanctionLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="table-container" style={{ margin: 0, border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <table className="data-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '6px 12px', fontSize: '11px', width: '20%' }}>Tranche #</th>
                        <th style={{ padding: '6px 12px', fontSize: '11px', width: '25%' }}>Disbursement Date</th>
                        <th style={{ padding: '6px 12px', fontSize: '11px', textAlign: 'right', width: '30%' }}>Disbursed Amount (₹)</th>
                        <th style={{ padding: '6px 12px', fontSize: '11px', width: '25%' }}>Recorded Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingDisbursements.map((d, idx) => (
                        <tr key={d.id || idx}>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>Tranche {idx + 1}</td>
                          <td style={{ padding: '6px 12px' }} className="num-tabular">{d.disbursement_date}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }} className="table-cell-num">
                            ₹{Number(d.disbursement_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '6px 12px', fontSize: '11px', color: '#64748b' }}>
                            {d.created_at ? d.created_at.split('T')[0] : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ADD NEW DISBURSEMENT AMOUNT & DATE FORM */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Add New Disbursement
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    (Maximum allowable: <strong style={{ color: remainingBalance > 0 ? '#0f172a' : '#16a34a' }}>₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>)
                  </span>
                </div>

                {!isFullyDisbursed && (
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-add-bank-btn"
                    style={{ height: '28px', fontSize: '11px', padding: '0 10px' }}
                    title="Add another tranche row"
                  >
                    <Plus size={12} /> Add Tranche Row
                  </button>
                )}
              </div>

              {/* Limit Exceeded Alert */}
              {isExceedingSanction && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #f87171',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    color: '#991b1b',
                    fontSize: '12px'
                  }}
                >
                  <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ lineHeight: 1.4 }}>
                    <strong>Cannot save: Exceeds Total Sanctioned Amount!</strong> The total disbursement amount (Existing: ₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })} + New: ₹{newDisbursementsSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })} = <strong>₹{projectedTotalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>) exceeds the total sanctioned limit of <strong>₹{sanctionLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> by <strong style={{ color: '#b91c1c' }}>₹{excessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>. Maximum allowable remaining disbursement is <strong>₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>.
                  </div>
                </div>
              )}

              {/* Fully Disbursed Notice */}
              {isFullyDisbursed && !isExceedingSanction && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    color: '#166534',
                    fontSize: '12px'
                  }}
                >
                  <CheckCircle size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <div>
                    <strong>Sanction Limit Reached:</strong> This file is 100% disbursed (₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })} of ₹{sanctionLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}). All sanctioned funds have been disbursed.
                  </div>
                </div>
              )}

              {/* Entry Rows for Amount and Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rows.map((row, index) => {
                  const rowAmt = parseFloat(row.amount);
                  const isRowExcessive = !isNaN(rowAmt) && rowAmt > remainingBalance;
                  return (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px minmax(0, 1.4fr) minmax(0, 1fr) 36px',
                        gap: '10px',
                        alignItems: 'center',
                        padding: '8px 10px',
                        backgroundColor: isRowExcessive ? '#fff5f5' : '#f8fafc',
                        border: `1px solid ${isRowExcessive ? '#fca5a5' : '#e2e8f0'}`,
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                        #{index + 1}
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Disbursement Amount (₹) *"
                          value={row.amount}
                          onChange={e => handleRowChange(row.id, 'amount', e.target.value)}
                          className="inline-field-input"
                          style={{
                            borderColor: isRowExcessive ? '#ef4444' : undefined,
                            fontWeight: 600
                          }}
                          disabled={isFullyDisbursed}
                        />
                        {isRowExcessive && (
                          <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>
                            Exceeds allowable remaining ₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          type="date"
                          value={row.date}
                          onChange={e => handleRowChange(row.id, 'date', e.target.value)}
                          className="inline-field-input"
                          disabled={isFullyDisbursed}
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="inline-btn-cancel"
                          style={{ width: '32px', height: '32px', padding: 0, color: '#dc2626' }}
                          title="Remove row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '12px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div
                  style={{
                    fontSize: '11.5px',
                    color: isExceedingSanction ? '#dc2626' : '#64748b',
                    fontWeight: isExceedingSanction ? 600 : 400
                  }}
                >
                  {isExceedingSanction
                    ? `Cannot save: Exceeds limit by ₹${excessAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : isFullyDisbursed
                    ? 'All sanction funds have been disbursed.'
                    : `Remaining allowable after new entry: ₹${Math.max(0, remainingBalance - newDisbursementsSum).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                </div>

                <button
                  type="button"
                  onClick={handleSaveDisbursements}
                  disabled={isSaving || isExceedingSanction || isFullyDisbursed || validRows.length === 0}
                  className="inline-btn-save"
                  style={{
                    padding: '0 18px',
                    height: '34px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle size={14} />
                  {isSaving ? 'Saving...' : 'Save Disbursements'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISBURSED ACCOUNTS DATA TABLE (6 COLUMNS, ENTIRE ROW CLICKABLE) */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Disbursed Accounts
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              {filteredDisbursements.length} account{filteredDisbursements.length === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Click on any row to open the horizontal file details and manage disbursement tranches.
          </div>
        </div>

        {filteredDisbursements.length === 0 ? (
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
                        if (fileData?.id === f.file_id) {
                          setFileData(null);
                          setLookupFileId('');
                        } else {
                          setLookupFileId(f.file_id);
                          fetchDisbursementsForFile(f.file_id);
                          window.scrollTo({ top: 120, behavior: 'smooth' });
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isCurrentFile ? '#eff6ff' : undefined,
                        borderLeft: isCurrentFile ? '3px solid #2563eb' : undefined,
                        transition: 'background-color 0.15s ease'
                      }}
                      title={`Click to open horizontal file details for ${f.file_id}`}
                    >
                      {/* 1. File ID */}
                      <td>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (fileData?.id === f.file_id) {
                              setFileData(null);
                              setLookupFileId('');
                            } else {
                              setLookupFileId(f.file_id);
                              fetchDisbursementsForFile(f.file_id);
                              window.scrollTo({ top: 120, behavior: 'smooth' });
                            }
                          }}
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            fontSize: '12px',
                            color: isCurrentFile ? '#1d4ed8' : '#1e293b',
                            backgroundColor: isCurrentFile ? '#dbeafe' : '#f1f5f9',
                            border: `1px solid ${isCurrentFile ? '#93c5fd' : '#e2e8f0'}`,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          title={`Click to view ${f.file_id}`}
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
        )}
      </div>
    </div>
  );
};

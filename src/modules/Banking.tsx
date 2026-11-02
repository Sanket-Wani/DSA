import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  Check,
  Building2,
  RefreshCw,
  Upload,
  FileText,
  AlertTriangle,
  ArrowRight,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Select } from '../components/Select.js';
import { Badge } from '../components/Badge.js';
import {
  BankingAccount,
  BankingAccountType,
  MonthlyStatus,
  StatementGapDetails,
  StatementUploadResponse
} from '../types/index.js';
import { BankingTransactions } from './BankingTransactions';

export const Banking: React.FC = () => {
  // Navigation / View Mode
  const [viewMode, setViewMode] = useState<'dashboard' | 'transactions'>('dashboard');

  // Accounts list state
  const [accounts, setAccounts] = useState<BankingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected Bank Account Row State
  const [selectedAccount, setSelectedAccount] = useState<BankingAccount | null>(null);

  // Year Selection (dynamic default to current calendar year, matching GSTReport/TDSReport)
  const currentSystemYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentSystemYear));
  const yearOptions = [
    String(currentSystemYear - 2),
    String(currentSystemYear - 1),
    String(currentSystemYear),
    String(currentSystemYear + 1)
  ];

  // Horizontal Add Bank Form State
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Six Form Fields
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [accountType, setAccountType] = useState<BankingAccountType>('CA');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Upload Statement Modal & Workflows State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal Stage States: 'input' | 'duplicates_prompt' | 'gap_alert' | 'all_duplicates' | 'success_prompt'
  const [modalStage, setModalStage] = useState<
    'input' | 'duplicates_prompt' | 'gap_alert' | 'all_duplicates' | 'success_prompt'
  >('input');
  const [duplicateInfo, setDuplicateInfo] = useState<{ duplicate_count: number; new_count: number } | null>(null);
  const [gapInfo, setGapInfo] = useState<StatementGapDetails | null>(null);
  const [successSummary, setSuccessSummary] = useState<{ imported_count: number; months_updated?: string[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Accounts
  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ accounts: BankingAccount[] }>('/api/banking/accounts');
      setAccounts(data.accounts || []);
      // Keep selectedAccount synchronized if it exists
      if (selectedAccount) {
        const refreshed = (data.accounts || []).find(a => a.id === selectedAccount.id);
        if (refreshed) setSelectedAccount(refreshed);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bank accounts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Form Reset
  const resetForm = () => {
    setBankName('');
    setBranch('');
    setAccountType('CA');
    setIfscCode('');
    setAccountNumber('');
    setAccountHolderName('');
    setFormError(null);
  };

  const handleToggleAddBank = () => {
    if (isAddBankOpen) {
      setIsAddBankOpen(false);
      resetForm();
    } else {
      setIsAddBankOpen(true);
      setFormError(null);
    }
  };

  // Form Save
  const handleSaveAccount = async () => {
    setFormError(null);

    // 1. Validations
    if (!bankName.trim()) {
      setFormError('Please enter Bank Name.');
      return;
    }
    if (!branch.trim()) {
      setFormError('Please enter Bank Branch.');
      return;
    }
    const cleanIfsc = ifscCode.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      setFormError('Invalid IFSC Code format. Must be 11 characters (e.g. HDFC0000240).');
      return;
    }
    const cleanAccNo = accountNumber.trim();
    if (!cleanAccNo) {
      setFormError('Please enter Account Number.');
      return;
    }
    if (!/^[0-9A-Za-z]{6,25}$/.test(cleanAccNo)) {
      setFormError('Account Number must contain between 6 and 25 alphanumeric characters.');
      return;
    }
    if (!accountHolderName.trim()) {
      setFormError('Please enter Account Holder Name.');
      return;
    }

    // 2. Submit to API
    setIsSubmitting(true);
    try {
      const res = await apiRequest<{ account: BankingAccount; message: string }>('/api/banking/accounts', {
        method: 'POST',
        body: JSON.stringify({
          bank_name: bankName.trim(),
          branch: branch.trim(),
          account_type: accountType,
          ifsc_code: cleanIfsc,
          account_number: cleanAccNo,
          account_holder_name: accountHolderName.trim()
        })
      });

      setAccounts(prev => [...prev, res.account]);
      setSuccessMsg(`Bank account "${res.account.bank_name} - ${res.account.account_number}" registered successfully.`);
      setIsAddBankOpen(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register bank account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Row selection handler
  const handleRowClick = (acc: BankingAccount) => {
    if (selectedAccount?.id === acc.id) {
      setSelectedAccount(null); // Deselect on toggle
    } else {
      setSelectedAccount(acc);
    }
  };

  // Open Upload Statement Dialog
  const handleOpenUploadModal = () => {
    if (!selectedAccount) return;
    setUploadFile(null);
    setUploadError(null);
    setModalStage('input');
    setDuplicateInfo(null);
    setGapInfo(null);
    setSuccessSummary(null);
    setIsUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadFile(null);
    setUploadError(null);
    setModalStage('input');
  };

  // File submission handler
  const handleUploadSubmit = async (skipDuplicates: boolean = false) => {
    if (!uploadFile || !selectedAccount) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('statement', uploadFile);

    try {
      const url = `/api/banking/accounts/${selectedAccount.id}/upload-statement${
        skipDuplicates ? '?skip_duplicates=true' : ''
      }`;
      const token = localStorage.getItem('token');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      const data = (await response.json()) as StatementUploadResponse & { error?: string };

      if (!response.ok) {
        if (response.status === 409 && data.status === 'duplicates_detected') {
          // Duplicates detected popup
          setDuplicateInfo({
            duplicate_count: data.duplicate_count || 0,
            new_count: data.imported_count || 0
          });
          setModalStage('duplicates_prompt');
          return;
        }

        if (response.status === 422 && data.status === 'gap_detected') {
          // Missing gap blocking popup
          setGapInfo(data.gap_details || null);
          setModalStage('gap_alert');
          return;
        }

        throw new Error(data.error || data.message || 'Failed to process bank statement.');
      }

      if (data.status === 'all_duplicates') {
        setDuplicateInfo({
          duplicate_count: data.duplicate_count || 0,
          new_count: 0
        });
        setModalStage('all_duplicates');
        return;
      }

      if (data.status === 'success') {
        // Successful upload workflow
        setSuccessSummary({
          imported_count: data.imported_count || 0,
          months_updated: data.months_updated
        });
        setModalStage('success_prompt');
        fetchAccounts(); // refresh status indicators on dashboard
      }
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred while uploading the statement.');
    } finally {
      setIsUploading(false);
    }
  };

  // Monthly Calendar Columns: January (1) to December (12)
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Determine whether a given month in selectedYear is a future month
  const isFutureMonth = (year: number, month: number): boolean => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1; // 1 to 12
    if (year > curYear) return true;
    if (year === curYear && month > curMonth) return true;
    return false;
  };

  const selectedYearNum = parseInt(selectedYear, 10) || currentSystemYear;

  // Render monthly indicator cell
  const renderStatusCell = (status: MonthlyStatus) => {
    switch (status) {
      case 'complete':
        return (
          <span
            className="banking-checkbox-indicator"
            style={{ backgroundColor: '#15803d', color: '#ffffff' }}
            title="Complete"
          >
            <Check size={12} strokeWidth={3} />
          </span>
        );
      case 'partially_complete':
        return (
          <span
            className="banking-checkbox-indicator"
            style={{ backgroundColor: '#b91c1c', color: '#ffffff' }}
            title="Partially Complete"
          >
            <Check size={12} strokeWidth={3} />
          </span>
        );
      case 'fully_incomplete':
        return (
          <span
            className="banking-checkbox-indicator"
            style={{ backgroundColor: '#ffffff', border: '1.5px solid #b91c1c' }}
            title="Fully Incomplete"
          />
        );
      case 'unuploaded':
      default:
        return null;
    }
  };

  // If in transaction view, render dedicated BankingTransactions module
  if (viewMode === 'transactions' && selectedAccount) {
    return (
      <BankingTransactions
        account={selectedAccount}
        onBack={() => setViewMode('dashboard')}
        onAccountUpdated={fetchAccounts}
      />
    );
  }

  return (
    <div className="page-content">
      {/* Page Header with Actions: Upload Statement immediately to the left of Year Selector */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Banking</h1>
          <div className="page-subtitle">
            Manage registered bank accounts and view monthly statement submission status.
          </div>
        </div>

        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Upload Statement Action (Visible ONLY when an account row is selected) */}
          {selectedAccount && (
            <Button
              variant="primary"
              onClick={handleOpenUploadModal}
              icon={<Upload size={15} />}
              title={`Upload statement for ${selectedAccount.bank_name}`}
            >
              Upload Statement
            </Button>
          )}

          {/* Calendar Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Year:</span>
            <div style={{ width: '100px' }}>
              <Select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                options={yearOptions.map(y => ({ value: y, label: y }))}
                aria-label="Select Calendar Year"
              />
            </div>
          </div>

          {/* Refresh Action */}
          <Button
            variant="secondary"
            onClick={fetchAccounts}
            disabled={isLoading}
            icon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
            title="Refresh bank accounts"
          >
            Refresh
          </Button>

          {/* Add Bank Button */}
          <Button
            variant={isAddBankOpen ? 'secondary' : 'primary'}
            onClick={handleToggleAddBank}
            icon={isAddBankOpen ? <X size={15} /> : <Plus size={16} />}
          >
            {isAddBankOpen ? 'Close Form' : 'Add Bank'}
          </Button>
        </div>
      </div>

      {/* Selected Account Info Bar */}
      {selectedAccount && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '12.5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: '#0369a1' }}>Selected Account:</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedAccount.bank_name}</span>
            <span style={{ color: '#64748b' }}>({selectedAccount.account_number})</span>
            <Badge
              label={selectedAccount.account_type === 'CA' ? 'Current' : 'Saving'}
              variant={selectedAccount.account_type === 'CA' ? 'info' : 'neutral'}
              className="badge-compact"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewMode('transactions')}
              icon={<Eye size={13} />}
            >
              See Transactions
            </Button>
            <button
              type="button"
              onClick={() => setSelectedAccount(null)}
              style={{
                border: 'none',
                background: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px 6px'
              }}
              title="Deselect account"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          <span>{successMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setSuccessMsg(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Add Bank Horizontal Form */}
      {isAddBankOpen && (
        <div className="separate-file-form-card" style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #cbd5e1'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0f172a',
                  backgroundColor: '#e2e8f0',
                  padding: '3px 10px',
                  borderRadius: '4px'
                }}
              >
                New Bank Account
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Fill in the 6 required account details horizontally and click Save Bank.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleAddBank}
              style={{
                border: 'none',
                background: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                padding: '4px 8px'
              }}
            >
              <X size={14} /> Close
            </button>
          </div>

          {formError && (
            <div className="inline-form-error-banner">
              <span>{formError}</span>
              <button
                type="button"
                onClick={() => setFormError(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 'bold' }}
              >
                ×
              </button>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
              gap: '8px',
              alignItems: 'flex-start'
            }}
          >
            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Bank Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="inline-field-input"
                title="Bank Name"
                autoFocus
              />
            </div>

            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Bank Branch <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Shivajinagar"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="inline-field-input"
                title="Bank Branch"
              />
            </div>

            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Account Type <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={accountType}
                onChange={e => setAccountType(e.target.value as BankingAccountType)}
                className="inline-field-select"
                title="Account Type"
              >
                <option value="CA">Current</option>
                <option value="Saving">Saving</option>
              </select>
            </div>

            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                IFSC Code <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC0000240"
                value={ifscCode}
                onChange={e => setIfscCode(e.target.value.toUpperCase())}
                className="inline-field-input"
                title="11-character IFSC Code"
                maxLength={11}
              />
            </div>

            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Account Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 50200012345678"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                className="inline-field-input"
                title="Bank Account Number"
              />
            </div>

            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Account Holder Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Vinayak Associates"
                value={accountHolderName}
                onChange={e => setAccountHolderName(e.target.value)}
                className="inline-field-input"
                title="Account Holder Name"
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              marginTop: '12px',
              paddingTop: '8px',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <Button variant="secondary" size="sm" onClick={resetForm} disabled={isSubmitting}>
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAccount}
              disabled={isSubmitting}
              icon={isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            >
              {isSubmitting ? 'Saving Bank...' : 'Save Bank'}
            </Button>
          </div>
        </div>
      )}

      {/* Banking Data Table with Sticky Columns and Monthly Scrollable Grid */}
      <div className="banking-table-container">
        <table className="banking-table" aria-label="Banking Dashboard Table">
          <thead>
            <tr>
              <th className="col-sticky-1" scope="col">
                Bank name
              </th>
              <th className="col-sticky-2" scope="col">
                Account Type
              </th>
              <th className="col-sticky-3" scope="col">
                Account no.
              </th>
              <th className="col-sticky-4" scope="col">
                Account Holder Name
              </th>

              {months.map(m => (
                <th key={m} className="col-month" scope="col">
                  {MONTH_NAMES[m - 1]}, {selectedYearNum}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading && accounts.length === 0 ? (
              <tr>
                <td colSpan={4 + months.length} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  Loading bank accounts...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={4 + months.length} className="table-empty">
                  <div className="table-empty-icon">
                    <Building2 size={36} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                    No Bank Accounts Added Yet
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                    Click "Add Bank" above to register your first bank account in the system.
                  </div>
                  <Button variant="primary" size="sm" onClick={() => setIsAddBankOpen(true)} icon={<Plus size={14} />}>
                    Add Bank
                  </Button>
                </td>
              </tr>
            ) : (
              accounts.map(acc => {
                const isSelected = selectedAccount?.id === acc.id;
                return (
                  <tr
                    key={acc.id}
                    onClick={() => handleRowClick(acc)}
                    className={isSelected ? 'banking-row-selected' : ''}
                    title="Click row to select account for Statement Upload or Transactions view"
                  >
                    {/* Fixed Column 1: Bank Name */}
                    <td className="col-sticky-1">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', lineHeight: 1.35 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '12.5px',
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={acc.bank_name}
                        >
                          {acc.bank_name}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={acc.branch}
                        >
                          {acc.branch}
                        </span>
                      </div>
                    </td>

                    {/* Fixed Column 2: Account Type */}
                    <td className="col-sticky-2">
                      <Badge
                        label={acc.account_type === 'CA' ? 'Current' : 'Saving'}
                        variant={acc.account_type === 'CA' ? 'info' : 'neutral'}
                        className="badge-compact"
                      />
                    </td>

                    {/* Fixed Column 3: Account Number & IFSC Code */}
                    <td className="col-sticky-3">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', lineHeight: 1.35 }}>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#0f172a',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                          }}
                        >
                          {acc.account_number}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: '#64748b',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            letterSpacing: '0.02em'
                          }}
                        >
                          IFSC: {acc.ifsc_code}
                        </span>
                      </div>
                    </td>

                    {/* Fixed Column 4: Account Holder Name */}
                    <td className="col-sticky-4">
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 500,
                          color: '#0f172a',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.35
                        }}
                        title={acc.account_holder_name}
                      >
                        {acc.account_holder_name}
                      </span>
                    </td>

                    {/* Monthly Columns */}
                    {months.map(m => {
                      const isFuture = isFutureMonth(selectedYearNum, m);
                      const ymKey = `${selectedYearNum}-${m}`;
                      const rawStatus: MonthlyStatus = (acc.monthly_statuses?.[ymKey] as MonthlyStatus) || 'unuploaded';

                      let cellClassName = 'col-month';
                      if (!isFuture) {
                        if (rawStatus === 'complete') {
                          cellClassName += ' month-status-cell-complete';
                        } else if (rawStatus === 'partially_complete') {
                          cellClassName += ' month-status-cell-partial';
                        } else if (rawStatus === 'fully_incomplete') {
                          cellClassName += ' month-status-cell-incomplete';
                        } else {
                          cellClassName += ' month-status-cell-unuploaded';
                        }
                      }

                      return (
                        <td key={m} className={cellClassName}>
                          {!isFuture && renderStatusCell(rawStatus)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* STATEMENT UPLOAD MODAL & DIALOG WORKFLOWS */}
      {isUploadModalOpen && selectedAccount && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              maxWidth: '520px',
              width: '100%',
              padding: '24px'
            }}
          >
            {/* Modal Stage 1: File Input & Confirmation */}
            {modalStage === 'input' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Upload Bank Statement
                  </h2>
                  <button
                    type="button"
                    onClick={handleCloseUploadModal}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Account Details Confirmation Card */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '16px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Target Bank Account:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Bank: </span>
                      <strong style={{ color: '#0f172a' }}>{selectedAccount.bank_name}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Account No: </span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{selectedAccount.account_number}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>IFSC: </span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{selectedAccount.ifsc_code}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Type: </span>
                      <strong style={{ color: '#0f172a' }}>{selectedAccount.account_type === 'CA' ? 'Current' : 'Saving'}</strong>
                    </div>
                  </div>
                </div>

                {uploadError && (
                  <div className="alert alert-danger" style={{ marginBottom: '14px', fontSize: '12px' }}>
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Dropzone / File Picker */}
                <div
                  className="statement-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ marginBottom: '16px' }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        const f = e.target.files[0];
                        if (!f.name.toLowerCase().endsWith('.pdf')) {
                          setUploadError('Only PDF statements are supported.');
                          return;
                        }
                        setUploadFile(f);
                        setUploadError(null);
                      }
                    }}
                  />
                  <Upload size={32} style={{ color: '#0284c7', margin: '0 auto 8px auto', display: 'block' }} />
                  {uploadFile ? (
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{uploadFile.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {(uploadFile.size / 1024).toFixed(1)} KB — Click to change file
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>Click to select Bank Statement PDF</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Supports Axis, BOB, HDFC, and ICICI Bank statements</div>
                    </div>
                  )}
                </div>

                {/* Processing State */}
                {isUploading && (
                  <div style={{ textAlign: 'center', padding: '12px', color: '#0284c7', fontSize: '12.5px', marginBottom: '12px' }}>
                    <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                    Extracting, validating and reconciling statement transactions...
                  </div>
                )}

                {/* Modal Footer Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                  <Button variant="secondary" size="sm" onClick={handleCloseUploadModal} disabled={isUploading}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleUploadSubmit(false)}
                    disabled={!uploadFile || isUploading}
                    icon={isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  >
                    {isUploading ? 'Processing...' : 'Upload & Process'}
                  </Button>
                </div>
              </>
            )}

            {/* Modal Stage 2: Duplicates Prompt Dialog */}
            {modalStage === 'duplicates_prompt' && duplicateInfo && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      Duplicate Transactions Detected
                    </h2>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, marginBottom: '20px' }}>
                  <strong style={{ color: '#0f172a' }}>{duplicateInfo.duplicate_count} duplicate transactions</strong> were detected in the uploaded statement that already exist in this account.
                  <div style={{ marginTop: '8px', color: '#64748b', fontSize: '12px' }}>
                    Would you like to skip the duplicate records and import only the {duplicateInfo.new_count} genuinely new transaction(s)?
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                  <Button variant="secondary" size="sm" onClick={handleCloseUploadModal}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleUploadSubmit(true)}
                    disabled={isUploading}
                    icon={<Check size={14} />}
                  >
                    Skip Duplicates and Upload
                  </Button>
                </div>
              </>
            )}

            {/* Modal Stage 3: All-Duplicates Notification */}
            {modalStage === 'all_duplicates' && duplicateInfo && (
              <>
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <CheckCircle2 size={40} style={{ color: '#0284c7', margin: '0 auto 12px auto' }} />
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Statement Already Imported
                  </h2>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, maxWidth: '400px', margin: '0 auto 20px auto' }}>
                    All {duplicateInfo.duplicate_count} transactions in this statement already exist in your account. No new or duplicate records were added.
                  </div>
                  <Button variant="primary" size="sm" onClick={handleCloseUploadModal}>
                    Okay
                  </Button>
                </div>
              </>
            )}

            {/* Modal Stage 4: Missing Gap Alert Blocking Dialog */}
            {modalStage === 'gap_alert' && gapInfo && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                      Missing Transactions Detected
                    </h2>
                  </div>
                </div>

                <div className="statement-gap-banner">
                  <div style={{ fontSize: '12.5px', color: '#7f1d1d', fontWeight: 600, marginBottom: '6px' }}>
                    Financial Continuity Blocked:
                  </div>
                  <div style={{ fontSize: '12px', color: '#991b1b', lineHeight: 1.4 }}>
                    {gapInfo.reason}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', fontSize: '11.5px', borderTop: '1px solid #fecaca', paddingTop: '8px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Missing Date Range: </span>
                      <strong style={{ color: '#0f172a' }}>{gapInfo.missing_from_date} to {gapInfo.missing_to_date}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Discrepancy: </span>
                      <strong style={{ color: '#b91c1c' }}>₹{gapInfo.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#475569', marginBottom: '20px', lineHeight: 1.45 }}>
                  The uploaded statement has been placed into secure pending holding. Please upload the missing/intermediate statement spanning this date range to restore running balance continuity.
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                  <Button variant="primary" size="sm" onClick={handleCloseUploadModal}>
                    Okay
                  </Button>
                </div>
              </>
            )}

            {/* Modal Stage 5: Success Prompt Dialog (Phase 5) */}
            {modalStage === 'success_prompt' && successSummary && (
              <>
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <CheckCircle2 size={44} style={{ color: '#16a34a', margin: '0 auto 12px auto' }} />
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Bank Statement Uploaded Successfully
                  </h2>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, maxWidth: '420px', margin: '0 auto 20px auto' }}>
                    Successfully imported <strong style={{ color: '#0f172a' }}>{successSummary.imported_count}</strong> transactions into <strong style={{ color: '#0f172a' }}>{selectedAccount.bank_name}</strong>.
                    {successSummary.months_updated && successSummary.months_updated.length > 0 && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#15803d' }}>
                        Monthly status updated to Complete for {successSummary.months_updated.join(', ')}.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <Button variant="secondary" onClick={handleCloseUploadModal}>
                      Okay
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        handleCloseUploadModal();
                        setViewMode('transactions');
                      }}
                      icon={<ArrowRight size={14} />}
                    >
                      See Transactions
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

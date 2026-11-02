import React, { useState, useEffect } from 'react';
import { Plus, X, Check, Building2, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Select } from '../components/Select.js';
import { Badge } from '../components/Badge.js';
import { BankingAccount, BankingAccountType } from '../types/index.js';

export const Banking: React.FC = () => {
  // Accounts list state
  const [accounts, setAccounts] = useState<BankingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  // Fetch Accounts
  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ accounts: BankingAccount[] }>('/api/banking/accounts');
      setAccounts(data.accounts || []);
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

    // 1. Validation
    if (!bankName.trim()) {
      setFormError('Please enter Bank Name.');
      return;
    }
    if (!branch.trim()) {
      setFormError('Please enter Bank Branch.');
      return;
    }
    if (!accountType || !['CA', 'Saving'].includes(accountType)) {
      setFormError('Please select a valid Account Type (CA or Saving).');
      return;
    }
    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!cleanIfsc) {
      setFormError('Please enter IFSC Code.');
      return;
    }
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

      // Update state without manual page refresh
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

  return (
    <div className="page-content">
      {/* Page Header with Year Navigation and Add Bank Action */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Banking</h1>
          <div className="page-subtitle">
            Manage registered bank accounts and view monthly statement submission status.
          </div>
        </div>

        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

      {/* Success Banner */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          <span>{successMsg}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMsg(null)}
            style={{ marginLeft: 'auto' }}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto' }}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Add Bank Horizontal Form (Reusing File Logged In Pattern) */}
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

          {/* 6-Field Horizontal Form Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            {/* Field 1: Bank Name */}
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

            {/* Field 2: Bank Branch */}
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

            {/* Field 3: Account Type */}
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
                <option value="CA">CA (Current Account)</option>
                <option value="Saving">Saving (Savings Account)</option>
              </select>
            </div>

            {/* Field 4: IFSC Code */}
            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                IFSC Code <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC0000240"
                maxLength={11}
                value={ifscCode}
                onChange={e => setIfscCode(e.target.value.toUpperCase())}
                className="inline-field-input"
                style={{ textTransform: 'uppercase' }}
                title="IFSC Code"
              />
            </div>

            {/* Field 5: Account Number */}
            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Account Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 50200012345678"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.trim())}
                className="inline-field-input"
                title="Account Number"
              />
            </div>

            {/* Field 6: Account Holder Name */}
            <div className="form-card-box">
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Account Holder Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={accountHolderName}
                onChange={e => setAccountHolderName(e.target.value)}
                className="inline-field-input"
                title="Account Holder Name"
              />
            </div>
          </div>

          {/* Form Action Buttons at bottom right */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '8px',
              marginTop: '14px',
              paddingTop: '10px',
              borderTop: '1px solid #cbd5e1'
            }}
          >
            <button
              type="button"
              onClick={handleToggleAddBank}
              className="inline-btn-cancel"
              style={{ width: '90px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAccount}
              disabled={isSubmitting}
              className="inline-btn-save"
              style={{ width: '120px' }}
            >
              <Check size={14} /> {isSubmitting ? 'Saving...' : 'Save Bank'}
            </button>
          </div>
        </div>
      )}

      {/* Banking Data Table with Fixed Columns & Horizontally Scrollable Months */}
      <div className="banking-table-container">
        <table className="banking-table" aria-label="Banking Dashboard Table">
          <thead>
            <tr>
              {/* Fixed Account Information Columns */}
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

              {/* Horizontally Scrollable Calendar Months ('Jan, 2026' ... 'Dec, 2026') */}
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
              accounts.map(acc => (
                <tr key={acc.id}>
                  {/* Fixed Column 1: Bank Name + Bank Branch */}
                  <td className="col-sticky-1">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                        {acc.bank_name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {acc.branch}
                      </span>
                    </div>
                  </td>

                  {/* Fixed Column 2: Account Type */}
                  <td className="col-sticky-2">
                    <Badge
                      label={acc.account_type === 'CA' ? 'CA' : 'Saving'}
                      variant={acc.account_type === 'CA' ? 'info' : 'neutral'}
                    />
                  </td>

                  {/* Fixed Column 3: Account Number & IFSC Code */}
                  <td className="col-sticky-3">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0f172a',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                        }}
                      >
                        {acc.account_number}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
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
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>
                      {acc.account_holder_name}
                    </span>
                  </td>

                  {/* Horizontally Scrollable 12 Calendar Months */}
                  {months.map(m => {
                    const isFuture = isFutureMonth(selectedYearNum, m);
                    const monthKey = `${selectedYearNum}-${m}`;
                    const explicitStatus = acc.monthly_statuses?.[monthKey];

                    // Class determination
                    let cellClass = 'col-month';
                    let indicator = null;

                    if (explicitStatus === 'complete') {
                      // State 1: Complete (Green background, ticked checkbox)
                      cellClass += ' month-status-cell-complete';
                      indicator = (
                        <span
                          className="banking-checkbox-indicator"
                          style={{
                            backgroundColor: '#238B57',
                            border: '1.5px solid #238B57',
                            color: '#ffffff'
                          }}
                          title={`Status: Complete (${monthKey})`}
                          aria-label={`Status Complete for ${monthKey}`}
                        >
                          <Check size={11} strokeWidth={3} />
                        </span>
                      );
                    } else if (explicitStatus === 'partially_complete') {
                      // State 2: Partially Complete (Red background, ticked checkbox)
                      cellClass += ' month-status-cell-partial';
                      indicator = (
                        <span
                          className="banking-checkbox-indicator"
                          style={{
                            backgroundColor: '#C83C42',
                            border: '1.5px solid #C83C42',
                            color: '#ffffff'
                          }}
                          title={`Status: Partially Complete (${monthKey})`}
                          aria-label={`Status Partially Complete for ${monthKey}`}
                        >
                          <Check size={11} strokeWidth={3} />
                        </span>
                      );
                    } else if (explicitStatus === 'fully_incomplete') {
                      // State 3: Fully Incomplete (Red background, unticked checkbox)
                      cellClass += ' month-status-cell-incomplete';
                      indicator = (
                        <span
                          className="banking-checkbox-indicator"
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #C83C42'
                          }}
                          title={`Status: Fully Incomplete (${monthKey})`}
                          aria-label={`Status Fully Incomplete for ${monthKey}`}
                        />
                      );
                    } else if (isFuture) {
                      // Future Month: Normal neutral background, no checkbox, no indicator
                      cellClass += '';
                      indicator = null;
                    } else {
                      // State 4: Unuploaded Data (Elapsed months, including current month)
                      // Grey cell background, no checkbox
                      cellClass += ' month-status-cell-unuploaded';
                      indicator = null;
                    }

                    return (
                      <td
                        key={m}
                        className={cellClass}
                        title={
                          isFuture
                            ? `Future month (${monthKey})`
                            : explicitStatus
                            ? `${explicitStatus} (${monthKey})`
                            : `Unuploaded Data (${monthKey})`
                        }
                      >
                        {indicator}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, FileText, RefreshCw, Search } from 'lucide-react';
import { Firm, FileRecord, InvoiceRecord } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { FileAutocompleteInput } from '../components/FileAutocompleteInput.js';
import { Pagination } from '../components/Pagination.js';
import { numberToWordsIndian } from '../utils/numberToWords.js';

interface TaxPreview {
  taxableAmount: number;
  sacCode: string;
  gstRate: number;
  isInterState: boolean;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
}

export const CreateInvoices: React.FC = () => {
  // Master Data
  const [firms, setFirms] = useState<Firm[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);

  // Lookup & Active File State
  const [lookupFileId, setLookupFileId] = useState('');
  const [fileData, setFileData] = useState<FileRecord | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Invoice Format Fields (matching exact Excel positions)
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumberPreview, setInvoiceNumberPreview] = useState('(Auto-generated on Save)');

  // Buyer Fields
  const [buyerCompany, setBuyerCompany] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');

  // Table Line Item Fields
  const [sacCode, setSacCode] = useState('997159');
  const [sacDescription, setSacDescription] = useState(
    'Financial Intermediary Service, Loan Processing Commission and Agent Fees.'
  );
  const [taxableAmount, setTaxableAmount] = useState('');

  // Loan Particulars Sub-Table Fields (Rows 31-35 in Excel)
  const [caseSourced, setCaseSourced] = useState('Urban Money');
  const [loanAccountNo, setLoanAccountNo] = useState('');
  const [mcfNo, setMcfNo] = useState('');
  const [productName, setProductName] = useState('');
  const [disbursementAmount, setDisbursementAmount] = useState('');

  // Tax calculation state
  const [taxPreview, setTaxPreview] = useState<TaxPreview | null>(null);
  const [taxError, setTaxError] = useState<string | null>(null);

  // Submission & Saved State
  const [isSaving, setIsSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<InvoiceRecord | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);

  // Stored Invoices Records State (Displayed below the invoice format section)
  const [invoicesList, setInvoicesList] = useState<InvoiceRecord[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const [invoicesSearch, setInvoicesSearch] = useState('');
  const [invoicesPage, setInvoicesPage] = useState(1);
  const INVOICES_PAGE_SIZE = 10;

  const fetchSavedInvoices = async () => {
    setIsInvoicesLoading(true);
    try {
      const res = await apiRequest<{ invoices: InvoiceRecord[] }>('/api/invoices');
      setInvoicesList(res.invoices || []);
    } catch (err) {
      console.error('Failed to load saved invoices:', err);
    } finally {
      setIsInvoicesLoading(false);
    }
  };

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [firmRes, taxRes] = await Promise.all([
          apiRequest<{ firms: Firm[] }>('/api/firms'),
          apiRequest<{ taxRates: any[] }>('/api/tax-rates')
        ]);
        setFirms(firmRes.firms || []);
        if (firmRes.firms?.length > 0) {
          setSelectedFirmId(String(firmRes.firms[0].id));
        }
        setTaxRates(taxRes.taxRates || []);
      } catch (err) {
        console.error('Failed to load firms or tax rates:', err);
      }
    };
    fetchMasterData();
    fetchSavedInvoices();
  }, []);

  // Update description when SAC code changes
  useEffect(() => {
    if (sacCode === '998311') {
      setSacDescription('General Advisory Services and Agent Fees.');
    } else {
      const found = taxRates.find(t => t.sac_code === sacCode);
      if (found && found.description) {
        setSacDescription(found.description);
      } else {
        setSacDescription('Financial Intermediary Service, Loan Processing Commission and Agent Fees.');
      }
    }
  }, [sacCode, taxRates]);

  // Handle file selection from autocomplete or lookup
  const handleSelectApprovedFile = async (file: FileRecord) => {
    setLookupFileId(file.id);
    setLookupError(null);
    setSavedInvoice(null);
    setActiveInvoiceId(null);
    setSaveError(null);

    try {
      const res = await apiRequest<{
        file: FileRecord;
        existingInvoices?: InvoiceRecord[];
        suggestedDisbursementAmount: number;
      }>(`/api/invoices/lookup/${encodeURIComponent(file.id)}`);

      const loadedFile = res.file;
      setFileData(loadedFile);
      setBuyerCompany(loadedFile.company_name || '');
      setBuyerContact(loadedFile.client_name || '');
      setBuyerEmail(loadedFile.client_email || '');
      setBuyerGstin(loadedFile.gst_no || '');
      setProductName(loadedFile.product_name || '');
      setCaseSourced(loadedFile.source || 'Urban Money');

      if (res.suggestedDisbursementAmount > 0) {
        setDisbursementAmount(String(res.suggestedDisbursementAmount));
      } else if (loadedFile.sanction_loan_amount) {
        setDisbursementAmount(String(loadedFile.sanction_loan_amount));
      }

      const numSuffix = loadedFile.id.replace(/[^0-9]/g, '') || '101';
      setLoanAccountNo(prev => (prev.trim() ? prev : `LN-${loadedFile.code || numSuffix}`));
      setMcfNo(prev => (prev.trim() ? prev : `MCF-${numSuffix}`));
    } catch (err: any) {
      setLookupError(err.message || 'Failed to populate file data');
    }
  };

  // Re-calculate GST whenever taxableAmount, sacCode, selectedFirmId, or buyerGstin changes
  // Statutory rule: If GST starts with 27 -> CGST (9%) + SGST (9%), otherwise IGST (18%)
  useEffect(() => {
    // When in view-only mode (viewing a saved invoice), preserve the exact loaded tax calculations
    if (activeInvoiceId) return;

    const calcTax = async () => {
      const amt = Number(taxableAmount);
      if (!amt || isNaN(amt) || amt <= 0 || !sacCode.trim() || !selectedFirmId) {
        setTaxPreview(null);
        setTaxError(null);
        return;
      }

      try {
        const res = await apiRequest<{ calculation: TaxPreview }>('/api/tax-rates/calculate', {
          method: 'POST',
          body: JSON.stringify({
            amount: amt,
            sac: sacCode.trim(),
            firm_id: Number(selectedFirmId),
            client_gstin: buyerGstin.trim()
          })
        });
        setTaxPreview(res.calculation);
        setTaxError(null);
      } catch (err: any) {
        // Fallback rule: if GST starts with 27 -> CGST 9% + SGST 9%, otherwise IGST 18%
        const isInter = !buyerGstin.trim().startsWith('27');
        const rate = 18;
        const totalTax = Math.round(amt * 0.18 * 100) / 100;
        const halfTax = Math.round(amt * 0.09 * 100) / 100;

        setTaxPreview({
          taxableAmount: amt,
          sacCode,
          gstRate: rate,
          isInterState: isInter,
          cgstRate: isInter ? 0 : 9,
          cgstAmount: isInter ? 0 : halfTax,
          sgstRate: isInter ? 0 : 9,
          sgstAmount: isInter ? 0 : halfTax,
          igstRate: isInter ? 18 : 0,
          igstAmount: isInter ? totalTax : 0,
          totalTax,
          totalAmount: amt + totalTax
        });
        setTaxError(null);
      }
    };

    calcTax();
  }, [taxableAmount, sacCode, selectedFirmId, buyerGstin]);

  // Selected Firm details
  const selectedFirm = firms.find(f => String(f.id) === selectedFirmId);

  // View-Only mode when viewing saved record
  const isViewOnly = Boolean(activeInvoiceId);

  // Form validation (disabled if in view-only mode)
  const isFormValid =
    !isViewOnly &&
    lookupFileId.trim() !== '' &&
    selectedFirmId !== '' &&
    loanAccountNo.trim() !== '' &&
    mcfNo.trim() !== '' &&
    disbursementAmount !== '' &&
    Number(disbursementAmount) > 0 &&
    sacCode.trim() !== '' &&
    taxableAmount !== '' &&
    Number(taxableAmount) > 0 &&
    taxPreview !== null;

  // Save invoice handler
  const handleSaveInvoice = async () => {
    if (!isFormValid || isViewOnly) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const payload = {
        firm_id: Number(selectedFirmId),
        file_id: lookupFileId.trim(),
        loan_account_no: loanAccountNo.trim(),
        mcf_no: mcfNo.trim(),
        disbursement_amount: Number(disbursementAmount),
        sac: sacCode.trim(),
        amount: Number(taxableAmount),
        invoice_date: invoiceDate
      };

      const res = await apiRequest<{
        message: string;
        invoice: InvoiceRecord;
      }>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSavedInvoice(res.invoice);
      setActiveInvoiceId(res.invoice.id);
      setInvoiceNumberPreview(res.invoice.invoice_number);
      // Immediately refresh stored invoices list so the newly created record is displayed below
      fetchSavedInvoices();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = (invoiceId?: string | null) => {
    if (!invoiceId) return;
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
  };

  // Load a saved invoice record into the official format sheet
  const handleLoadInvoice = (inv: InvoiceRecord) => {
    setActiveInvoiceId(inv.id);
    setSavedInvoice(inv);
    setSelectedFirmId(String(inv.firm_id));
    setLookupFileId(inv.file_id);
    setInvoiceNumberPreview(inv.invoice_number);
    setInvoiceDate(inv.invoice_date);
    setBuyerCompany(inv.client_company_snapshot || '');
    setBuyerContact(inv.client_name_snapshot || '');
    setBuyerEmail(inv.client_email_snapshot || '');
    setBuyerGstin(inv.client_gstin_snapshot || '');
    setLoanAccountNo(inv.loan_account_no || '');
    setMcfNo(inv.mcf_no || '');
    setProductName(inv.product_name_snapshot || '');
    setDisbursementAmount(String(inv.disbursement_amount || ''));
    setSacCode(inv.sac || '997159');
    setTaxableAmount(String(inv.amount || ''));
    setSaveError(null);
    setLookupError(null);

    const isInterState = (inv.igst_amount || 0) > 0;
    setTaxPreview({
      taxableAmount: inv.amount,
      sacCode: inv.sac,
      gstRate: isInterState ? inv.igst_rate : (inv.cgst_rate + inv.sgst_rate),
      isInterState,
      cgstRate: inv.cgst_rate,
      cgstAmount: inv.cgst_amount,
      sgstRate: inv.sgst_rate,
      sgstAmount: inv.sgst_amount,
      igstRate: inv.igst_rate,
      igstAmount: inv.igst_amount,
      totalTax: inv.total_amount - inv.amount,
      totalAmount: inv.total_amount
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to create a new invoice (Editable mode)
  const handleResetForm = () => {
    setLookupFileId('');
    setFileData(null);
    setBuyerCompany('');
    setBuyerContact('');
    setBuyerEmail('');
    setBuyerGstin('');
    setLoanAccountNo('');
    setMcfNo('');
    setProductName('');
    setDisbursementAmount('');
    setTaxableAmount('');
    setInvoiceNumberPreview('(Auto-generated on Save)');
    setSavedInvoice(null);
    setActiveInvoiceId(null);
    setSaveError(null);
    setTaxPreview(null);
  };

  // Filtered and paginated saved invoices list
  const filteredInvoices = invoicesList.filter(inv => {
    if (!invoicesSearch.trim()) return true;
    const q = invoicesSearch.toLowerCase().trim();
    return (
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(q)) ||
      (inv.file_id && inv.file_id.toLowerCase().includes(q)) ||
      (inv.firm_name_snapshot && inv.firm_name_snapshot.toLowerCase().includes(q)) ||
      (inv.client_company_snapshot && inv.client_company_snapshot.toLowerCase().includes(q)) ||
      (inv.client_name_snapshot && inv.client_name_snapshot.toLowerCase().includes(q)) ||
      (inv.client_gstin_snapshot && inv.client_gstin_snapshot.toLowerCase().includes(q)) ||
      (inv.loan_account_no && inv.loan_account_no.toLowerCase().includes(q)) ||
      (inv.mcf_no && inv.mcf_no.toLowerCase().includes(q))
    );
  });

  const totalInvoicesPages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICES_PAGE_SIZE));
  const paginatedInvoices = filteredInvoices.slice(
    (invoicesPage - 1) * INVOICES_PAGE_SIZE,
    invoicesPage * INVOICES_PAGE_SIZE
  );

  // Amounts for display
  const subTotalAmount = taxPreview ? taxPreview.taxableAmount : Number(taxableAmount) || 0;
  const isInterState = taxPreview ? taxPreview.isInterState : !buyerGstin.trim().startsWith('27');
  const cgstRate = taxPreview ? taxPreview.cgstRate : 9;
  const cgstAmount = taxPreview ? taxPreview.cgstAmount : Math.round(subTotalAmount * 0.09 * 100) / 100;
  const sgstRate = taxPreview ? taxPreview.sgstRate : 9;
  const sgstAmount = taxPreview ? taxPreview.sgstAmount : Math.round(subTotalAmount * 0.09 * 100) / 100;
  const igstRate = taxPreview ? taxPreview.igstRate : 18;
  const igstAmount = taxPreview ? taxPreview.igstAmount : Math.round(subTotalAmount * 0.18 * 100) / 100;
  const grandTotalAmount = taxPreview
    ? taxPreview.totalAmount
    : subTotalAmount + (isInterState ? igstAmount : cgstAmount + sgstAmount);
  const amountInWords = numberToWordsIndian(grandTotalAmount);

  return (
    <div className="page-content">
      {/* Top Action Buttons Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <Button
          variant="secondary"
          size="md"
          onClick={handleResetForm}
          icon={<RefreshCw size={15} />}
          title="Start a fresh blank invoice"
        >
          New Invoice
        </Button>

        {isViewOnly ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => handleDownloadPdf(activeInvoiceId)}
            icon={<Download size={16} />}
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          >
            Download Invoice PDF
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={handleSaveInvoice}
            disabled={!isFormValid || isSaving}
            isLoading={isSaving}
            icon={<FileText size={16} />}
          >
            Save Invoice
          </Button>
        )}
      </div>

      {/* Success Notification Bar */}
      {savedInvoice && (
        <div
          className="alert alert-success"
          style={{
            marginBottom: '24px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={24} color="#16a34a" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#166534' }}>
                Invoice {savedInvoice.invoice_number} saved into database!
              </div>
              <div style={{ fontSize: '13px', color: '#15803d', marginTop: '2px' }}>
                Grand Total: ₹{savedInvoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} • Ready for download in standard format.
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => handleDownloadPdf(savedInvoice.id)}
            icon={<Download size={16} />}
            style={{ backgroundColor: '#15803d', borderColor: '#15803d' }}
          >
            Download Invoice PDF
          </Button>
        </div>
      )}

      {/* Error Alerts */}
      {saveError && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', borderRadius: 'var(--radius-md)' }}>
          <AlertCircle size={16} />
          <span>{saveError}</span>
        </div>
      )}

      {lookupError && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', borderRadius: 'var(--radius-md)' }}>
          <AlertCircle size={16} />
          <span>{lookupError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THE OFFICIAL INVOICE DOCUMENT FORMAT (EXACT EXCEL SPREADSHEET REPLICA)     */}
      {/* ========================================================================= */}
      <div
        className="panel invoice-document-sheet"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid var(--color-border, #e5e7eb)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          padding: '48px 56px',
          maxWidth: '1200px',
          margin: '0 auto 36px auto',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#111827',
          position: 'relative'
        }}
      >
        {/* Top Header Row with Mavin Credit Logo */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px'
          }}
        >
          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                backgroundColor: '#f3f4f6',
                padding: '5px 12px',
                borderRadius: '6px'
              }}
            >
              Official Built-in Format
            </span>
            {isViewOnly && (
              <span
                style={{
                  marginLeft: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#92400e',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '5px 12px',
                  borderRadius: '6px'
                }}
              >
                View Only Mode (Saved Invoice #{savedInvoice?.invoice_number})
              </span>
            )}
          </div>

          {/* Picture 1: Firm Logo / Branding */}
          <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {selectedFirm?.firm_name?.includes('Vinayak') ? (
              <img
                src="/assets/vinayak_associates_logo.png"
                alt="Vinayak Associates"
                style={{ height: '145px', maxHeight: '160px', width: 'auto', objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <img
                src="/assets/mavin_credit_logo.png"
                alt="Mavin Credit - Debt Advisory & Financing Services"
                style={{ height: '82px', width: 'auto', objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}
          </div>
        </div>

        {/* Row 8: Centered TAX INVOICE Header */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            borderBottom: '2px solid #111827',
            paddingBottom: '12px',
            marginBottom: '28px'
          }}
        >
          TAX INVOICE
        </div>

        {/* Rows 10-16: Supplier (Left) & Metadata (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '48px', marginBottom: '28px' }}>
          {/* Left: Supplier Details */}
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                borderBottom: '1px solid #111827',
                display: 'inline-block',
                width: '280px',
                paddingBottom: '4px',
                marginBottom: '10px'
              }}
            >
              Supplier -
            </div>

            {/* Firm Selector directly on Supplier Name */}
            <div style={{ marginBottom: '8px' }}>
              <select
                value={selectedFirmId}
                onChange={e => setSelectedFirmId(e.target.value)}
                disabled={isViewOnly}
                style={{
                  fontWeight: 700,
                  fontSize: '14px',
                  fontFamily: 'Arial, sans-serif',
                  color: '#111827',
                  border: '1px solid #cbd5e1',
                  backgroundColor: isViewOnly ? '#f1f5f9' : '#f8fafc',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  width: '100%',
                  cursor: isViewOnly ? 'not-allowed' : 'pointer',
                  height: '40px'
                }}
                title="Select Issuing Firm"
              >
                {firms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.firm_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Firm Address */}
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', marginBottom: '6px', whiteSpace: 'pre-line' }}>
              {'Office No. 502, Varun Capital,\nOff J. M. Road, Shivajinagar, Pune – 411005'}
            </div>

            {/* Email & Web */}
            <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
              {selectedFirm?.firm_name?.includes('Vinayak')
                ? 'contact@vinayakassociates.in | www.vinayakassociates.in'
                : 'smeloans@mavincredit.com | www.mavincredit.com'}
            </div>

            {/* GSTN & CIN */}
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
              GSTN {selectedFirm ? selectedFirm.gstin : '27AAUCM0275A1ZH'}
            </div>
            {!selectedFirm?.firm_name?.includes('Vinayak') && (
              <div style={{ fontSize: '13px', color: '#4b5563' }}>
                CIN U66190PN2025PTC247784
              </div>
            )}
          </div>

          {/* Right: Invoice Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '16px' }}>
            {/* Invoice No. */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', fontSize: '14px' }}>
              <span style={{ color: '#4b5563', fontWeight: 600 }}>Invoice No.</span>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px' }}>{invoiceNumberPreview}</span>
            </div>

            {/* Invoice Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', fontSize: '14px' }}>
              <span style={{ color: '#4b5563', fontWeight: 600 }}>Invoice Date</span>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                disabled={isViewOnly}
                readOnly={isViewOnly}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontFamily: 'Arial, sans-serif',
                  height: '40px',
                  width: '210px',
                  backgroundColor: isViewOnly ? '#f1f5f9' : '#ffffff',
                  cursor: isViewOnly ? 'default' : 'text'
                }}
              />
            </div>

            {/* Login ID (Embedded Autocomplete directly on the line) */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'flex-start', fontSize: '14px' }}>
              <span style={{ color: '#4b5563', fontWeight: 600, paddingTop: '10px' }}>
                Login ID <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <div style={{ width: '100%', maxWidth: '340px' }}>
                {isViewOnly ? (
                  <input
                    type="text"
                    value={lookupFileId}
                    readOnly
                    style={{
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f1f5f9',
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      height: '40px',
                      width: '100%',
                      cursor: 'default',
                      color: '#1e293b'
                    }}
                  />
                ) : (
                  <FileAutocompleteInput
                    hideLabel
                    value={lookupFileId}
                    onChange={setLookupFileId}
                    onSelectFile={handleSelectApprovedFile}
                    placeholder="Select approved account"
                    inputStyle={{
                      border: '1px solid #2563eb',
                      backgroundColor: '#eff6ff',
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      height: '40px'
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rows 18-23: Buyer Details */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              borderBottom: '1px solid #111827',
              display: 'inline-block',
              width: '280px',
              paddingBottom: '4px',
              marginBottom: '10px'
            }}
          >
            Buyer -
          </div>

          <div style={{ maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Buyer Company Name */}
            <input
              type="text"
              placeholder="Buyer Company Name (autofilled from Login ID)"
              value={buyerCompany}
              onChange={e => setBuyerCompany(e.target.value)}
              readOnly={isViewOnly}
              style={{
                fontWeight: 700,
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                border: '1px solid #cbd5e1',
                padding: '8px 12px',
                borderRadius: '6px',
                width: '100%',
                height: '40px',
                backgroundColor: isViewOnly ? '#f8fafc' : '#ffffff',
                cursor: isViewOnly ? 'default' : 'text'
              }}
            />

            {/* Buyer Contact */}
            <input
              type="text"
              placeholder="Contact Person (optional)"
              value={buyerContact}
              onChange={e => setBuyerContact(e.target.value)}
              readOnly={isViewOnly}
              style={{
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                border: '1px solid #e2e8f0',
                padding: '8px 12px',
                borderRadius: '6px',
                width: '100%',
                height: '38px',
                backgroundColor: isViewOnly ? '#f8fafc' : '#ffffff',
                cursor: isViewOnly ? 'default' : 'text'
              }}
            />

            {/* Buyer eMail */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ color: '#4b5563', fontWeight: 600 }}>eMail</span>
              <input
                type="email"
                placeholder="client@email.com"
                value={buyerEmail}
                onChange={e => setBuyerEmail(e.target.value)}
                readOnly={isViewOnly}
                style={{
                  fontSize: '13px',
                  fontFamily: 'Arial, sans-serif',
                  border: '1px solid #e2e8f0',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  width: '100%',
                  height: '38px',
                  backgroundColor: isViewOnly ? '#f8fafc' : '#ffffff',
                  cursor: isViewOnly ? 'default' : 'text'
                }}
              />
            </div>

            {/* Buyer GSTN */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ fontWeight: 700, color: '#111827' }}>GSTN</span>
              <input
                type="text"
                placeholder="e.g. 27AAUCS9133P1Z9"
                value={buyerGstin}
                onChange={e => setBuyerGstin(e.target.value)}
                readOnly={isViewOnly}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'Arial, sans-serif',
                  border: '1px solid #e2e8f0',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  width: '100%',
                  height: '38px',
                  backgroundColor: isViewOnly ? '#f8fafc' : '#ffffff',
                  cursor: isViewOnly ? 'default' : 'text'
                }}
              />
            </div>
          </div>
        </div>

        {/* Row 24: Horizontal Divider Line */}
        <div style={{ borderBottom: '1px solid #111827', marginBottom: '22px' }} />

        {/* ========================================================================= */}
        {/* MAIN TABLE (PARTICULARS | SAC | AMOUNT)                                    */}
        {/* ========================================================================= */}
        <div style={{ border: '1px solid #111827', marginBottom: '0px' }}>
          {/* Table Header (Row 25 in Excel - Gray Shaded #F2F2F2) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 220px',
              backgroundColor: '#F2F2F2',
              borderBottom: '1px solid #111827',
              fontWeight: 700,
              fontSize: '14px'
            }}
          >
            <div style={{ padding: '12px 18px', borderRight: '1px solid #111827' }}>
              PARTICULARS
            </div>
            <div style={{ padding: '12px 10px', textAlign: 'center', borderRight: '1px solid #111827' }}>
              SAC
            </div>
            <div style={{ padding: '12px 18px', textAlign: 'right' }}>
              AMOUNT
            </div>
          </div>

          {/* Table Body */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 220px',
              minHeight: '260px'
            }}
          >
            {/* Column 1: PARTICULARS */}
            <div style={{ padding: '16px 20px', borderRight: '1px solid #111827', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {/* Service Description Input */}
              <div>
                <textarea
                  value={sacDescription}
                  onChange={e => setSacDescription(e.target.value)}
                  readOnly={isViewOnly}
                  rows={2}
                  style={{
                    width: '100%',
                    fontSize: '13.5px',
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: '1.5',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    resize: 'none',
                    backgroundColor: isViewOnly ? '#f8fafc' : '#f8fafc',
                    cursor: isViewOnly ? 'default' : 'text',
                    marginBottom: '20px'
                  }}
                  title="Service particulars description"
                />
              </div>

              {/* Rows 31-35 in Excel: Loan Particulars Sub-Table inside PARTICULARS */}
              <div
                style={{
                  border: '1px solid #111827',
                  width: '100%',
                  maxWidth: '600px',
                  fontSize: '13px',
                  marginBottom: '14px',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}
              >
                {/* 1. Case Sourced */}
                <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', borderBottom: '1px solid #111827' }}>
                  <div style={{ backgroundColor: '#F2F2F2', padding: '8px 12px', borderRight: '1px solid #111827', fontWeight: 600 }}>
                    Case Sourced
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. Urban Money"
                      value={caseSourced}
                      onChange={e => setCaseSourced(e.target.value)}
                      readOnly={isViewOnly}
                      style={{
                        width: '100%',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '13px',
                        padding: '8px 12px',
                        backgroundColor: isViewOnly ? '#f8fafc' : 'transparent',
                        cursor: isViewOnly ? 'default' : 'text'
                      }}
                    />
                  </div>
                </div>

                {/* 2. Loan Account No. */}
                <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', borderBottom: '1px solid #111827' }}>
                  <div style={{ backgroundColor: '#F2F2F2', padding: '8px 12px', borderRight: '1px solid #111827', fontWeight: 600 }}>
                    Loan Account No. <span style={{ color: '#dc2626' }}>*</span>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. HDFC-LAP-882910"
                      value={loanAccountNo}
                      onChange={e => setLoanAccountNo(e.target.value)}
                      readOnly={isViewOnly}
                      style={{
                        width: '100%',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '13px',
                        padding: '8px 12px',
                        fontWeight: 600,
                        backgroundColor: '#f8fafc',
                        cursor: isViewOnly ? 'default' : 'text'
                      }}
                    />
                  </div>
                </div>

                {/* 3. MCF No. */}
                <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', borderBottom: '1px solid #111827' }}>
                  <div style={{ backgroundColor: '#F2F2F2', padding: '8px 12px', borderRight: '1px solid #111827', fontWeight: 600 }}>
                    MCF No. <span style={{ color: '#dc2626' }}>*</span>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. MCF-2026-789"
                      value={mcfNo}
                      onChange={e => setMcfNo(e.target.value)}
                      readOnly={isViewOnly}
                      style={{
                        width: '100%',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '13px',
                        padding: '8px 12px',
                        fontWeight: 600,
                        backgroundColor: '#f8fafc',
                        cursor: isViewOnly ? 'default' : 'text'
                      }}
                    />
                  </div>
                </div>

                {/* 4. Product */}
                <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', borderBottom: '1px solid #111827' }}>
                  <div style={{ backgroundColor: '#F2F2F2', padding: '8px 12px', borderRight: '1px solid #111827', fontWeight: 600 }}>
                    Product
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. Loan Against Property"
                      value={productName}
                      onChange={e => setProductName(e.target.value)}
                      readOnly={isViewOnly}
                      style={{
                        width: '100%',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '13px',
                        padding: '8px 12px',
                        backgroundColor: isViewOnly ? '#f8fafc' : 'transparent',
                        cursor: isViewOnly ? 'default' : 'text'
                      }}
                    />
                  </div>
                </div>

                {/* 5. Disbursed Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr' }}>
                  <div style={{ backgroundColor: '#F2F2F2', padding: '8px 12px', borderRight: '1px solid #111827', fontWeight: 600 }}>
                    Disbursed Amount <span style={{ color: '#dc2626' }}>*</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={disbursementAmount}
                      onChange={e => setDisbursementAmount(e.target.value)}
                      readOnly={isViewOnly}
                      style={{
                        width: '100%',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '13px',
                        padding: '8px 12px',
                        fontWeight: 600,
                        backgroundColor: '#f8fafc',
                        cursor: isViewOnly ? 'default' : 'text'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: SAC Dropdown */}
            <div style={{ padding: '16px 10px', borderRight: '1px solid #111827', textAlign: 'center' }}>
              <select
                value={sacCode}
                onChange={e => setSacCode(e.target.value)}
                disabled={isViewOnly}
                style={{
                  width: '100%',
                  fontSize: '14px',
                  fontWeight: 600,
                  textAlign: 'center',
                  padding: '8px 6px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: isViewOnly ? '#f1f5f9' : '#ffffff',
                  cursor: isViewOnly ? 'not-allowed' : 'pointer',
                  height: '40px'
                }}
              >
                <option value="997159">997159</option>
              </select>
            </div>

            {/* Column 3: Taxable AMOUNT Input */}
            <div style={{ padding: '16px 14px', textAlign: 'right' }}>
              <input
                id="taxable-amount-input"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={taxableAmount}
                onChange={e => setTaxableAmount(e.target.value)}
                readOnly={isViewOnly}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  fontSize: '15px',
                  fontWeight: 700,
                  fontFamily: 'Arial, sans-serif',
                  padding: '8px 12px',
                  border: isViewOnly ? '1px solid #cbd5e1' : '2px solid #2563eb',
                  backgroundColor: isViewOnly ? '#f1f5f9' : '#eff6ff',
                  borderRadius: '6px',
                  height: '42px',
                  cursor: isViewOnly ? 'default' : 'text'
                }}
                title="Enter Taxable Commission Value"
              />
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginTop: '8px', fontWeight: 500 }}>
                Taxable Value (₹)
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAX SUMMARY ROWS (Rows 39-43 in Excel)                                     */}
          {/* ========================================================================= */}
          <div style={{ borderTop: '1px solid #111827' }}>
            {/* Sub- Total */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 220px',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '14px',
                padding: '8px 0'
              }}
            >
              <div style={{ textAlign: 'right', paddingRight: '28px', borderRight: '1px solid #111827', fontWeight: 500 }}>
                Sub- Total
              </div>
              <div style={{ textAlign: 'right', paddingRight: '16px', fontWeight: 600 }}>
                {subTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {!isInterState ? (
              <>
                {/* CGST */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 220px',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px',
                    padding: '8px 0'
                  }}
                >
                  <div style={{ textAlign: 'right', paddingRight: '28px', borderRight: '1px solid #111827' }}>
                    CGST {cgstRate}%
                  </div>
                  <div style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* SGST */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 220px',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '14px',
                    padding: '8px 0'
                  }}
                >
                  <div style={{ textAlign: 'right', paddingRight: '28px', borderRight: '1px solid #111827' }}>
                    SGST {sgstRate}%
                  </div>
                  <div style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </>
            ) : (
              /* IGST */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 220px',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: '14px',
                  padding: '8px 0'
                }}
              >
                <div style={{ textAlign: 'right', paddingRight: '28px', borderRight: '1px solid #111827' }}>
                  IGST {igstRate || 18}%
                </div>
                <div style={{ textAlign: 'right', paddingRight: '16px' }}>
                  {igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {/* Row 44 in Excel: Grand Total Bar (Gray Shaded #F2F2F2) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 220px',
                backgroundColor: '#F2F2F2',
                fontSize: '15px',
                fontWeight: 700,
                padding: '10px 0',
                borderTop: '1px solid #111827'
              }}
            >
              <div style={{ textAlign: 'right', paddingRight: '28px', borderRight: '1px solid #111827' }}>
                Grand total
              </div>
              <div style={{ textAlign: 'right', paddingRight: '16px', fontSize: '16px', fontWeight: 800 }}>
                {grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Row 45 in Excel: Amount in Words (=SpellNumber(J44)) */}
        <div style={{ marginTop: '22px', fontSize: '14px', fontStyle: 'normal', color: '#111827' }}>
          <strong>Amount in Words: </strong>
          <span>{amountInWords}</span>
        </div>

        {/* Bottom Section: Bank Details at Bottom Left & Signatory at Right */}
        <div
          style={{
            marginTop: '28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '32px',
            flexWrap: 'wrap'
          }}
        >
          {/* Bottom Left: Bank Details Display Fields */}
          <div
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              width: '100%',
              maxWidth: '430px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '10px',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '5px'
              }}
            >
              Bank Details — {selectedFirm?.firm_name || 'Selected Firm'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '115px 1fr', rowGap: '6px', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Bank Name:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                {selectedFirm?.bank_name || (selectedFirm?.firm_name?.includes('Vinayak') ? 'ICICI Bank' : 'HDFC Bank')}
              </span>

              <span style={{ color: '#64748b', fontWeight: 600 }}>Account Name:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                {selectedFirm?.account_name || (selectedFirm?.firm_name?.includes('Vinayak') ? 'Vinayak Associates' : 'Mavin Credit Consultant Private Limited')}
              </span>

              <span style={{ color: '#64748b', fontWeight: 600 }}>Account No.:</span>
              <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                {selectedFirm?.account_no || (selectedFirm?.firm_name?.includes('Vinayak') ? '000405001234' : '50200012345678')}
              </span>

              <span style={{ color: '#64748b', fontWeight: 600 }}>IFSC Code:</span>
              <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                {selectedFirm?.ifsc_code || (selectedFirm?.firm_name?.includes('Vinayak') ? 'ICIC0000004' : 'HDFC0000240')}
              </span>

              <span style={{ color: '#64748b', fontWeight: 600 }}>Branch:</span>
              <span style={{ color: '#0f172a' }}>
                {selectedFirm?.branch || 'Shivajinagar, Pune'}
              </span>
            </div>
          </div>

          {/* Bottom Right: Authorized Signatory */}
          <div style={{ textAlign: 'right', minWidth: '220px', paddingTop: '36px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '40px' }}>
              For {selectedFirm?.firm_name || 'Mavin Credits'}
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#4b5563',
                borderTop: '1px solid #111827',
                paddingTop: '6px',
                display: 'inline-block',
                minWidth: '170px',
                textAlign: 'center'
              }}
            >
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div
          style={{
            marginTop: '36px',
            paddingTop: '14px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#6b7280'
          }}
        >
          <div>This is a computer-generated tax invoice verified by {selectedFirm?.firm_name || 'Mavin Credits'}.</div>
        </div>
      </div>

      {/* Floating Action Button Bar under sheet */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        {isViewOnly ? (
          <>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleResetForm}
              icon={<RefreshCw size={18} />}
            >
              New Invoice
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleDownloadPdf(activeInvoiceId)}
              icon={<Download size={18} />}
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
            >
              Download Invoice PDF
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={handleSaveInvoice}
            disabled={!isFormValid || isSaving}
            isLoading={isSaving}
            icon={<FileText size={18} />}
          >
            Save Invoice
          </Button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SAVED INVOICES RECORDS SECTION (DISPLAYED UNDER INVOICE FORMAT SECTION)   */}
      {/* ========================================================================= */}
      <div
        className="panel"
        style={{
          maxWidth: '1200px',
          margin: '40px auto 36px auto',
          padding: '24px 28px',
          borderRadius: '8px',
          border: '1px solid var(--color-border, #e5e7eb)',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        {/* Section Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                Saved Invoices
              </h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid #e2e8f0'
                }}
              >
                {invoicesList.length} {invoicesList.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              All stored invoices across firms. Click any row to preview in view-only mode in the format above, or download its PDF directly.
            </div>
          </div>

          {/* Search bar and Refresh button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="search-box" style={{ width: '280px' }}>
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search invoice, file, client, firm..."
                value={invoicesSearch}
                onChange={e => {
                  setInvoicesSearch(e.target.value);
                  setInvoicesPage(1);
                }}
                className="input-control"
                style={{ height: '34px', fontSize: '13px' }}
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={fetchSavedInvoices}
              isLoading={isInvoicesLoading}
              icon={<RefreshCw size={14} />}
              title="Refresh saved invoices list"
              aria-label="Refresh invoices"
            />
          </div>
        </div>

        {/* Saved Invoices Table */}
        <div className="table-container" style={{ border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Invoice Date</th>
                <th>Firm</th>
                <th>File ID</th>
                <th>Client / Company</th>
                <th>Loan A/c & MCF</th>
                <th style={{ textAlign: 'right' }}>Taxable Value (₹)</th>
                <th style={{ textAlign: 'right' }}>Billed GST (₹)</th>
                <th style={{ textAlign: 'right' }}>Grand Total (₹)</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isInvoicesLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                      Loading stored invoice records...
                    </div>
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-empty" style={{ padding: '32px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>No saved invoices found</div>
                    <div style={{ fontSize: '13px', marginTop: '4px', color: 'var(--color-text-secondary)' }}>
                      {invoicesSearch
                        ? 'No invoices match your search query. Try clearing the search.'
                        : 'Create and save an invoice using the format above to see it stored here.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map(inv => {
                  const isCurrentActive = activeInvoiceId === inv.id;
                  const totalGst = (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0);
                  const isInter = (inv.igst_amount || 0) > 0;

                  return (
                    <tr
                      key={inv.id}
                      className={`clickable-row ${isCurrentActive ? 'selected-row' : ''}`}
                      onClick={() => handleLoadInvoice(inv)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isCurrentActive ? '#f0f9ff' : undefined
                      }}
                      title="Click anywhere to load and preview this invoice above"
                    >
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            color: '#1e3a8a'
                          }}
                        >
                          {inv.invoice_number}
                        </span>
                      </td>
                      <td className="num-tabular" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {inv.invoice_date}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>
                          {inv.firm_name_snapshot || 'Mavin Credits'}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge badge-neutral"
                          style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 }}
                        >
                          {inv.file_id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>
                          {inv.client_company_snapshot || '—'}
                        </div>
                        {inv.client_name_snapshot && (
                          <div style={{ fontSize: '11px', color: '#4b5563' }}>
                            {inv.client_name_snapshot}
                          </div>
                        )}
                        {inv.client_gstin_snapshot && (
                          <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                            {inv.client_gstin_snapshot}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        <div>LA: <span className="num-tabular">{inv.loan_account_no}</span></div>
                        <div style={{ color: '#6b7280' }}>MCF: <span className="num-tabular">{inv.mcf_no}</span></div>
                      </td>
                      <td className="table-cell-num" style={{ fontSize: '13px' }}>
                        ₹{Number(inv.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="table-cell-num" style={{ fontSize: '13px' }}>
                        <div>₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '10px', color: '#6b7280' }}>
                          {isInter ? 'IGST 18%' : 'CGST 9% + SGST 9%'}
                        </div>
                      </td>
                      <td className="table-cell-num" style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                        ₹{Number(inv.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleLoadInvoice(inv)}
                            style={{ height: '28px', padding: '0 8px', fontSize: '11px' }}
                            title="Preview and edit in the invoice sheet above"
                          >
                            Preview
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => handleDownloadPdf(inv.id)}
                            icon={<Download size={13} />}
                            style={{
                              height: '28px',
                              padding: '0 8px',
                              fontSize: '11px',
                              backgroundColor: '#16a34a',
                              borderColor: '#16a34a'
                            }}
                            title="Download official PDF invoice"
                          >
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <Pagination
            currentPage={invoicesPage}
            totalPages={totalInvoicesPages}
            totalItems={filteredInvoices.length}
            pageSize={INVOICES_PAGE_SIZE}
            onPageChange={setInvoicesPage}
          />
        </div>
      </div>
    </div>
  );
};

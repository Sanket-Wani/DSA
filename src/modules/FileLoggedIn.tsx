import React, { useState, useEffect } from 'react';
import { Plus, Search, RefreshCw, ArrowLeft, Trash2, Building2, UserPlus, PackagePlus, Check, X } from 'lucide-react';
import { FileRecord, Product, Bank, SalesMember, FileStatus, ALL_FILE_STATUSES, FileBankEntry, Firm } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Badge, getFileStatusVariant } from '../components/Badge.js';
import { Pagination } from '../components/Pagination.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';

interface BankFormRow {
  bank_id: string;
  bank_name?: string;
  bank_manager_name: string;
  sanction_loan_amount: string;
}

export const FileLoggedIn: React.FC = () => {
  const { isSuperadmin } = useAuth();

  // Navigation mode: 'list' | 'create' | 'detail'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  // Table Data & Filters
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [salesMembers, setSalesMembers] = useState<SalesMember[]>([]);
  const [allBanks, setAllBanks] = useState<Bank[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmId, setFirmId] = useState<string>('1');

  // Form State (for Create & Detail/Edit)
  const [formFileId, setFormFileId] = useState('');
  const [formLoginDate, setFormLoginDate] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [productId, setProductId] = useState('');
  const [salesMemberId, setSalesMemberId] = useState('');
  const [fileCode, setFileCode] = useState('');
  const [caseSource, setCaseSource] = useState('');
  const [banksList, setBanksList] = useState<BankFormRow[]>([
    { bank_id: '', bank_manager_name: '', sanction_loan_amount: '' }
  ]);
  const [fileStatus, setFileStatus] = useState<FileStatus>('WIP (Work in Progress)');

  // Inline Horizontal Form State
  const [isInlineCreating, setIsInlineCreating] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string>('');

  // Modals for Quick Add & Delete Confirmation
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddSalesOpen, setIsAddSalesOpen] = useState(false);
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);

  const [newProductName, setNewProductName] = useState('');
  const [newSalesName, setNewSalesName] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newBankGst, setNewBankGst] = useState('');

  // 1. Fetch Files list
  const fetchFiles = async (searchQuery = search, targetPage = page, statusVal = statusFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(targetPage),
        limit: '10',
        search: searchQuery.trim(),
        status: statusVal
      });
      const data = await apiRequest<{ files: FileRecord[]; pagination: any }>(`/api/files?${query.toString()}`);
      setFiles(data.files || []);
      setTotalPages(data.pagination.totalPages || 1);
      setTotalItems(data.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch files');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Master Data
  const fetchMasterData = async () => {
    try {
      const [prodRes, salesRes, banksRes, firmsRes] = await Promise.all([
        apiRequest<{ products: Product[] }>('/api/products'),
        apiRequest<{ salesMembers: SalesMember[] }>('/api/sales-members'),
        apiRequest<{ banks: Bank[] }>('/api/banks'),
        apiRequest<{ firms: Firm[] }>('/api/firms')
      ]);
      setProducts(prodRes.products || []);
      setSalesMembers(salesRes.salesMembers || []);
      setAllBanks(banksRes.banks || []);
      setFirms(firmsRes.firms || []);
      if (firmsRes.firms && firmsRes.firms.length > 0) {
        setFirmId(String(firmsRes.firms[0].id));
      }
    } catch (err) {
      console.error('Failed to load master data:', err);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (viewMode === 'list') {
      const timer = setTimeout(() => {
        fetchFiles(search, page, statusFilter);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [page, statusFilter, search, viewMode]);

  // Dynamically calculate and preview next File ID when Product is selected
  useEffect(() => {
    if (!productId) {
      setPreviewFileId('');
      return;
    }
    apiRequest<{ fileId: string }>(`/api/files/preview-id?productId=${productId}`)
      .then(res => {
        if (res && res.fileId) {
          setPreviewFileId(res.fileId);
        }
      })
      .catch(() => {
        const yr = String(new Date().getFullYear()).slice(-2);
        const prod = products.find(p => String(p.id) === String(productId));
        const acr = (prod?.acronym || 'GEN').toUpperCase().trim();
        const code = acr.length === 2 ? acr + 'X' : acr.slice(0, 3);
        setPreviewFileId(`${yr}${code}...`);
      });
  }, [productId, products]);

  // Toggle inline New File Entry horizontal form row
  const handleToggleInlineCreate = () => {
    if (isInlineCreating) {
      setIsInlineCreating(false);
      setInlineError(null);
      return;
    }

    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    
    setFormFileId('');
    setPreviewFileId('');
    setFormLoginDate(formattedDate);
    setCompanyName('');
    setGstNo('');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setProductId(products.length > 0 ? String(products[0].id) : '');
    setFirmId(firms.length > 0 ? String(firms[0].id) : '1');
    setSalesMemberId(salesMembers.length > 0 ? String(salesMembers[0].id) : '');
    setFileCode('');
    setCaseSource('');
    setBanksList([
      { bank_id: allBanks.length > 0 ? String(allBanks[0].id) : '', bank_manager_name: '', sanction_loan_amount: '0' }
    ]);
    setFileStatus('WIP (Work in Progress)');
    setSelectedFileId(null);
    setSelectedFile(null);
    setInlineError(null);
    setIsInlineCreating(true);
  };

  const handleOpenNewFile = handleToggleInlineCreate;

  // Save Inline New File Entry
  const handleSaveInlineEntry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setInlineError(null);

    const missing: string[] = [];
    if (!companyName.trim()) missing.push("Company Name");
    if (!clientName.trim()) missing.push("Client Name");
    if (!productId) missing.push("Product");
    if (!firmId) missing.push("Firm");
    if (!salesMemberId) missing.push("Sales Member");
    if (!fileCode.trim()) missing.push("Code");

    banksList.forEach((b, idx) => {
      const bLabel = banksList.length > 1 ? `Bank ${idx + 1}` : 'Bank';
      if (!b.bank_id) missing.push(`${bLabel} selection`);
      if (!b.bank_manager_name.trim()) missing.push(`${bLabel} Manager Name`);
    });

    if (missing.length > 0) {
      setInlineError(`Please fill in required fields: ${missing.join(', ')}`);
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        company_name: companyName.trim(),
        gst_no: gstNo.trim().toUpperCase(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        product_id: Number(productId),
        firm_id: Number(firmId) || 1,
        sales_member_id: Number(salesMemberId),
        code: fileCode.trim(),
        source: caseSource.trim(),
        status: fileStatus,
        banks: banksList.map(b => ({
          bank_id: Number(b.bank_id),
          bank_manager_name: b.bank_manager_name.trim(),
          sanction_loan_amount: 0
        }))
      };

      const res = await apiRequest<{ file: FileRecord }>('/api/files', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessMsg(`File "${res.file.id}" created successfully.`);
      setIsInlineCreating(false);
      setInlineError(null);
      await fetchFiles();
    } catch (err: any) {
      setInlineError(err.message || 'Failed to save new file');
    } finally {
      setIsLoading(false);
    }
  };

  // Open file in Detailed View / Edit mode
  const handleOpenFileDetails = async (fileId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ file: FileRecord }>(`/api/files/${fileId}`);
      const f = data.file;
      setSelectedFile(f);
      setSelectedFileId(f.id);

      setFormFileId(f.id);
      let formattedDate = '';
      if (f.login_date) {
        const d = new Date(f.login_date);
        formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
      setFormLoginDate(formattedDate || f.login_date || '');
      setCompanyName(f.company_name || '');
      setGstNo(f.gst_no || '');
      setClientName(f.client_name || '');
      setClientPhone(f.client_phone || '');
      setClientEmail(f.client_email || '');
      setProductId(String(f.product_id || ''));
      setSalesMemberId(String(f.sales_member_id || ''));
      setFileCode(f.code || '');
      setCaseSource(f.source || '');
      setFileStatus(f.status || 'WIP (Work in Progress)');

      const resolveBankId = (bId: any, bName?: string) => {
        if (!bId && !bName) return allBanks.length > 0 ? String(allBanks[0].id) : '';
        const match = allBanks.find(ab => String(ab.id) === String(bId) || (bName && ab.bank_name.toLowerCase() === bName.toLowerCase()));
        return match ? String(match.id) : String(bId || '');
      };

      if (f.banks && f.banks.length > 0) {
        setBanksList(
          f.banks.map((b: FileBankEntry) => ({
            bank_id: resolveBankId(b.bank_id, b.bank_name),
            bank_name: b.bank_name || '',
            bank_manager_name: b.bank_manager_name || '',
            sanction_loan_amount: String(b.sanction_loan_amount || '')
          }))
        );
      } else {
        setBanksList([
          {
            bank_id: resolveBankId(f.bank_id, f.bank_name),
            bank_name: f.bank_name || '',
            bank_manager_name: f.bank_manager_name || '',
            sanction_loan_amount: String(f.sanction_loan_amount || '')
          }
        ]);
      }

      setViewMode('detail');
    } catch (err: any) {
      setError(err.message || `Failed to open details for file ${fileId}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Bank Rows Management
  const handleAddBankRow = () => {
    setBanksList(prev => [
      ...prev,
      {
        bank_id: allBanks.length > 0 ? String(allBanks[0].id) : '',
        bank_manager_name: '',
        sanction_loan_amount: ''
      }
    ]);
  };

  const handleRemoveBankRow = (index: number) => {
    if (banksList.length <= 1) return;
    setBanksList(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateBankRow = (index: number, field: keyof BankFormRow, value: string) => {
    setBanksList(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Missing Fields calculation (matches reference screenshot alert)
  const getMissingFields = () => {
    const missing: string[] = [];
    if (!companyName.trim()) missing.push('Company name');
    if (!gstNo.trim()) missing.push('Client GSTIN');
    if (!clientName.trim()) missing.push('Contact Name');
    if (!clientEmail.trim() || !clientEmail.includes('@')) missing.push('Email');
    if (!productId) missing.push('Product');
    if (!salesMemberId) missing.push('Sales Member');
    if (!fileCode.trim()) missing.push('Code');

    banksList.forEach((b, idx) => {
      const bLabel = banksList.length > 1 ? `Bank ${idx + 1}` : 'Bank';
      if (!b.bank_id) missing.push(`${bLabel} selection`);
      if (!b.bank_manager_name.trim()) missing.push(`${bLabel} Manager`);
      if (!b.sanction_loan_amount || Number(b.sanction_loan_amount) <= 0) missing.push(`${bLabel} Sanction Amount`);
    });

    return missing;
  };

  const missingFields = getMissingFields();
  const missingSummary = missingFields.length > 0
    ? `${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? ` +${missingFields.length - 3} more` : ''}`
    : '';

  // Form Submission (Create or Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingFields.length > 0) {
      setError(`Please complete all required fields before saving: ${missingFields.join(', ')}`);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        company_name: companyName.trim(),
        gst_no: gstNo.trim().toUpperCase(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        product_id: Number(productId),
        sales_member_id: Number(salesMemberId),
        code: fileCode.trim(),
        source: caseSource.trim(),
        status: fileStatus,
        banks: banksList.map(b => ({
          bank_id: Number(b.bank_id),
          bank_manager_name: b.bank_manager_name.trim(),
          sanction_loan_amount: Number(b.sanction_loan_amount)
        }))
      };

      if (viewMode === 'create') {
        const res = await apiRequest<{ file: FileRecord }>('/api/files', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccessMsg(`File "${res.file.id}" created successfully.`);
        setViewMode('list');
      } else if (viewMode === 'detail' && selectedFileId) {
        const res = await apiRequest<{ file: FileRecord }>(`/api/files/${selectedFileId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setSelectedFile(res.file);
        setSuccessMsg(`File "${res.file.id}" updated successfully.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save file details');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete File Handler
  const handleDeleteFile = async () => {
    const targetId = fileToDelete?.id || selectedFileId;
    if (!targetId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success?: boolean; message?: string }>(`/api/files/${targetId}`, {
        method: 'DELETE'
      });
      setIsDeleteModalOpen(false);
      setSuccessMsg(res.message || `File "${targetId}" deleted successfully.`);
      setSelectedFileId(null);
      setSelectedFile(null);
      setFileToDelete(null);
      setViewMode('list');
      await fetchFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
      setIsDeleteModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Inline Adders
  const handleCreateProduct = async () => {
    if (!newProductName.trim()) return;
    try {
      const res = await apiRequest<{ product: Product }>('/api/products', {
        method: 'POST',
        body: JSON.stringify({ name: newProductName.trim() })
      });
      setProducts(prev => [...prev, res.product]);
      setProductId(String(res.product.id));
      setNewProductName('');
      setIsAddProductOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add product');
    }
  };

  const handleCreateSalesMember = async () => {
    if (!newSalesName.trim()) return;
    try {
      const res = await apiRequest<{ salesMember: SalesMember }>('/api/sales-members', {
        method: 'POST',
        body: JSON.stringify({ name: newSalesName.trim() })
      });
      setSalesMembers(prev => [...prev, res.salesMember]);
      setSalesMemberId(String(res.salesMember.id));
      setNewSalesName('');
      setIsAddSalesOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add sales member');
    }
  };

  const handleCreateBank = async () => {
    if (!newBankName.trim()) return;
    try {
      const res = await apiRequest<{ bank: Bank }>('/api/banks', {
        method: 'POST',
        body: JSON.stringify({ bank_name: newBankName.trim(), bank_gst_no: newBankGst.trim() })
      });
      setAllBanks(prev => [...prev, res.bank]);
      setNewBankName('');
      setNewBankGst('');
      setIsAddBankOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add bank');
    }
  };

  // Card Styles strictly adhering to reference screenshot & design system
  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '20px 24px',
    marginBottom: '20px'
  };

  const cardHeaderStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#374151',
    textTransform: 'uppercase',
    marginBottom: '16px'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '6px',
    display: 'block'
  };

  const subtextStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '4px'
  };

  const readOnlyInputStyle: React.CSSProperties = {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
    borderColor: '#e5e7eb',
    cursor: 'not-allowed'
  };

  // -------------------------------------------------------------
  // VIEW: CREATE OR DETAIL (EXACT REFERENCE SCREENSHOT FORMAT)
  // -------------------------------------------------------------
  if (viewMode === 'create' || viewMode === 'detail') {
    return (
      <div className="page-content" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '48px' }}>
        {/* Top Header with Back Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setSelectedFile(null);
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Back to files
          </button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0 }}>
              {viewMode === 'create' ? 'New Loan File' : `Loan File: ${formFileId}`}
            </h1>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
              {viewMode === 'create'
                ? 'Enter customer and bank sanction details to initiate the case'
                : 'View and update customer and bank sanction details or manage case status'}
            </div>
          </div>
          {viewMode === 'detail' && selectedFile && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge label={selectedFile.status} variant={getFileStatusVariant(selectedFile.status)} />
            </div>
          )}
        </div>

        {/* Feedback Alerts */}
        {successMsg && (
          <div className="alert alert-success" style={{ marginBottom: '16px' }}>
            <span>{successMsg}</span>
            <Button variant="ghost" size="sm" onClick={() => setSuccessMsg(null)} style={{ marginLeft: 'auto' }}>
              Dismiss
            </Button>
          </div>
        )}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
              Dismiss
            </Button>
          </div>
        )}

        <form onSubmit={handleSaveForm}>
          {/* Card 1: CASE IDENTIFICATION */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>CASE IDENTIFICATION</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={labelStyle}>File ID (autofetched)</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={viewMode === 'detail' ? formFileId : ''}
                  placeholder="(Auto-generated on save)"
                  className="input-control"
                  style={readOnlyInputStyle}
                />
                <div style={subtextStyle}>Unique sequential ID, e.g., F-00001</div>
              </div>
              <div>
                <label style={labelStyle}>Login Date (autofetched)</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={formLoginDate || new Date().toLocaleDateString('en-GB')}
                  className="input-control"
                  style={readOnlyInputStyle}
                />
                <div style={subtextStyle}>Auto-assigned system date</div>
              </div>
            </div>
          </div>

          {/* Card 2: CLIENT INFORMATION */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>CLIENT INFORMATION</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Client's Company Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Registered legal company name"
                  className="input-control"
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Client's GST No. <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={gstNo}
                  onChange={e => setGstNo(e.target.value.toUpperCase())}
                  placeholder="15-character GSTIN (e.g. 27ABCDE1234F1Z5)"
                  className="input-control"
                  required
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={labelStyle}>
                  Client Contact Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Primary authorized contact person"
                  className="input-control"
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Client Email ID <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="input-control"
                  required
                />
              </div>
            </div>
          </div>

          {/* Card 3: PRODUCT & SOURCING */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>PRODUCT & SOURCING</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    Product <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddProductOpen(true)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0 4px', height: '20px', fontSize: '11px', color: '#4b5563' }}
                  >
                    + Add New
                  </button>
                </div>
                <select
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  className="select-control"
                  required
                >
                  <option value="">Select...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.acronym})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    Office Sales Member Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddSalesOpen(true)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0 4px', height: '20px', fontSize: '11px', color: '#4b5563' }}
                  >
                    + Add New
                  </button>
                </div>
                <select
                  value={salesMemberId}
                  onChange={e => setSalesMemberId(e.target.value)}
                  className="select-control"
                  required
                >
                  <option value="">Select...</option>
                  {salesMembers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={labelStyle}>
                  Code <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={fileCode}
                  onChange={e => setFileCode(e.target.value)}
                  placeholder="Internal branch or alphanumeric code"
                  className="input-control"
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Case Source</label>
                <input
                  type="text"
                  value={caseSource}
                  onChange={e => setCaseSource(e.target.value)}
                  placeholder="Channel partner, direct, consultant, etc."
                  className="input-control"
                />
              </div>
            </div>
          </div>

          {/* Card 4: BANK SANCTIONS */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={cardHeaderStyle}>BANK SANCTIONS</div>
              <button
                type="button"
                onClick={handleAddBankRow}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '28px' }}
              >
                <Plus size={14} /> Add Bank
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
              Multiple banks allowed per file. Each requires bank name, manager, and sanction amount.
            </div>

            {banksList.map((row, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: banksList.length > 1 ? '1fr 1fr 1fr auto' : '1fr 1fr 1fr',
                  gap: '16px',
                  alignItems: 'flex-start',
                  marginBottom: index < banksList.length - 1 ? '16px' : '0',
                  paddingBottom: index < banksList.length - 1 ? '16px' : '0',
                  borderBottom: index < banksList.length - 1 ? '1px dashed #e5e7eb' : 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      Bank {banksList.length > 1 ? index + 1 : ''} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddBankOpen(true)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0 4px', height: '20px', fontSize: '11px', color: '#4b5563' }}
                    >
                      + Add New Bank
                    </button>
                  </div>
                  <select
                    value={row.bank_id}
                    onChange={e => handleUpdateBankRow(index, 'bank_id', e.target.value)}
                    className="select-control"
                    required
                  >
                    <option value="">Select...</option>
                    {allBanks.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>
                    Bank Manager / Consultant Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={row.bank_manager_name}
                    onChange={e => handleUpdateBankRow(index, 'bank_manager_name', e.target.value)}
                    placeholder="Manager or consultant contact"
                    className="input-control"
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Sanction Loan Amount (₹) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={row.sanction_loan_amount}
                    onChange={e => handleUpdateBankRow(index, 'sanction_loan_amount', e.target.value)}
                    placeholder="e.g. 5000000"
                    className="input-control"
                    required
                  />
                </div>
                {banksList.length > 1 && (
                  <div style={{ paddingTop: '24px' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveBankRow(index)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#dc2626', height: '36px', padding: '0 8px' }}
                      title="Remove this bank allocation"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Card 5: WORKFLOW STATUS */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>WORKFLOW STATUS</div>
            <div style={{ maxWidth: '420px' }}>
              <label style={labelStyle}>File Status</label>
              <select
                value={fileStatus}
                onChange={e => setFileStatus(e.target.value as FileStatus)}
                className="select-control"
              >
                {ALL_FILE_STATUSES.map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <div style={subtextStyle}>Current lifecycle status of the loan file</div>
            </div>
          </div>

          {/* Card 6: Approval Details (in detail view if reviewed) */}
          {viewMode === 'detail' && selectedFile?.reviewed_at && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>APPROVAL AUDIT LOG</div>
              <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                <div>Reviewed by: <strong>{selectedFile.reviewer_name || 'System Superadmin'}</strong></div>
                <div>Decision timestamp: <strong>{selectedFile.reviewed_at}</strong></div>
                {selectedFile.review_remarks && <div>Remarks: <em>{selectedFile.review_remarks}</em></div>}
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {missingFields.length > 0 && (
              <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>
                Missing required: {missingSummary}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  setSelectedFile(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {viewMode === 'create' ? 'Save File' : 'Save Changes'}
              </button>

              {viewMode === 'detail' && (
                <button
                  type="button"
                  onClick={() => {
                    const current = selectedFile || files.find(f => f.id === selectedFileId) || null;
                    setFileToDelete(current);
                    setIsDeleteModalOpen(true);
                  }}
                  className="btn btn-danger"
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={16} /> Delete File
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setFileToDelete(null);
          }}
          title="Confirm Delete File"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setFileToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteFile} isLoading={isLoading}>
                Delete File
              </Button>
            </>
          }
        >
          <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
            Are you sure you want to permanently delete file <strong>{fileToDelete?.id || formFileId}</strong> ({fileToDelete?.company_name || companyName})?
            <div style={{ color: 'var(--color-danger)', marginTop: '8px', fontSize: '13px' }}>
              This action cannot be undone. It will remove the file record, associated bank allocations, disbursements, and any linked invoices.
            </div>
          </div>
        </Modal>

        {/* Inline Add Modals */}
        <Modal
          isOpen={isAddProductOpen}
          onClose={() => setIsAddProductOpen(false)}
          title="Add New Loan Product"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsAddProductOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateProduct}>Create Product</Button>
            </>
          }
        >
          <div>
            <label className="form-label">Product Name</label>
            <input
              type="text"
              value={newProductName}
              onChange={e => setNewProductName(e.target.value)}
              placeholder="e.g. Equipment Financing"
              className="input-control"
            />
          </div>
        </Modal>

        <Modal
          isOpen={isAddSalesOpen}
          onClose={() => setIsAddSalesOpen(false)}
          title="Add Office Sales Member"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsAddSalesOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateSalesMember}>Create Member</Button>
            </>
          }
        >
          <div>
            <label className="form-label">Full Name</label>
            <input
              type="text"
              value={newSalesName}
              onChange={e => setNewSalesName(e.target.value)}
              placeholder="e.g. Rohit Sharma"
              className="input-control"
            />
          </div>
        </Modal>

        <Modal
          isOpen={isAddBankOpen}
          onClose={() => setIsAddBankOpen(false)}
          title="Create New Bank"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsAddBankOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateBank}>Create Bank</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="form-label">Bank Name</label>
              <input
                type="text"
                value={newBankName}
                onChange={e => setNewBankName(e.target.value)}
                placeholder="e.g. Yes Bank Ltd"
                className="input-control"
              />
            </div>
            <div>
              <label className="form-label">Bank GSTIN</label>
              <input
                type="text"
                value={newBankGst}
                onChange={e => setNewBankGst(e.target.value.toUpperCase())}
                placeholder="e.g. 27AABCY1234Z1Z5"
                className="input-control"
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: FILES TABLE LIST
  // -------------------------------------------------------------
  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">File Logged-in</h1>
          <div className="page-subtitle">Register and manage client loan files through the operational approval pipeline.</div>
        </div>
        <div className="page-actions">
          <Button
            variant={isInlineCreating ? "secondary" : "primary"}
            onClick={handleToggleInlineCreate}
            icon={isInlineCreating ? <X size={15} /> : <Plus size={16} />}
          >
            {isInlineCreating ? "Close Entry Form" : "New File Entry"}
          </Button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          <span>{successMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setSuccessMsg(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Toolbar: Search & Status Filter */}
      <div className="section-toolbar">
        <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="search-input-wrapper" style={{ width: '320px' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search file ID, client, product, bank..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-control"
            />
          </div>
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>

        <div className="toolbar-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="select-control"
              style={{ width: '220px' }}
            >
              <option value="All">All Statuses</option>
              {ALL_FILE_STATUSES.map(st => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => fetchFiles()}
            isLoading={isLoading}
            icon={<RefreshCw size={14} />}
            aria-label="Refresh list"
          />
        </div>
      </div>

      {/* Separate New File Entry Form Container Above Table */}
      {isInlineCreating && (
        <div className="separate-file-form-card">
          {inlineError && (
            <div className="inline-form-error-banner">
              <span>{inlineError}</span>
              <button
                type="button"
                onClick={() => setInlineError(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 'bold' }}
              >
                ×
              </button>
            </div>
          )}

          <div className="new-file-form-6col-grid">
            {/* Column 1 Box: File ID, Date, Product */}
            <div className="form-card-box">
              <input
                type="text"
                readOnly
                placeholder="File ID (dynamic)"
                value={previewFileId}
                className="inline-field-input inline-field-input-readonly"
                title={previewFileId || "File ID (dynamic)"}
              />

              <input
                type="text"
                readOnly
                placeholder="Date (autofetched)"
                value={formLoginDate}
                className="inline-field-input inline-field-input-readonly"
                title={formLoginDate || "Date (autofetched)"}
              />

              <select
                value={productId}
                onChange={e => setProductId(e.target.value)}
                className="inline-field-select"
                title="Product (dropdown)"
              >
                <option value="">Product (dropdown) *</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.acronym} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Column 2 Box: Clients Company name, Clients name, Clients GSTIN */}
            <div className="form-card-box">
              <input
                type="text"
                placeholder="Clients Company name *"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="inline-field-input"
                title="Clients Company name"
              />

              <input
                type="text"
                placeholder="Clients name *"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="inline-field-input"
                title="Clients name"
              />

              <input
                type="text"
                placeholder="Clients GSTIN"
                maxLength={15}
                value={gstNo}
                onChange={e => setGstNo(e.target.value.toUpperCase())}
                className="inline-field-input"
                style={{ textTransform: 'uppercase' }}
                title="Clients GSTIN"
              />
            </div>

            {/* Columns 3 to 5 Middle Area: Spans 3 columns with Upper & Lower boxes */}
            <div className="form-6col-middle-area">
              {/* Upper Box: Firm name, Office Sales Member Name, Code, Case source */}
              <div className="form-card-box form-middle-upper-box">
                <div className="form-3col-row">
                  <select
                    value={firmId}
                    onChange={e => setFirmId(e.target.value)}
                    className="inline-field-select"
                    title="Firm name (mavin/vinayak associates)"
                  >
                    <option value="">Firm name (mavin/vinayak associates) *</option>
                    {firms.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.firm_name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={salesMemberId}
                    onChange={e => setSalesMemberId(e.target.value)}
                    className="inline-field-select"
                    title="Office Sales Member Name"
                  >
                    <option value="">Office Sales Member Name *</option>
                    {salesMembers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Code *"
                    value={fileCode}
                    onChange={e => setFileCode(e.target.value)}
                    className="inline-field-input"
                    title="Code"
                  />
                </div>

                <div className="form-3col-row">
                  <input
                    type="text"
                    placeholder="Case source"
                    value={caseSource}
                    onChange={e => setCaseSource(e.target.value)}
                    className="inline-field-input"
                    title="Case source"
                  />
                  <div className="form-empty-cell" />
                  <div className="form-empty-cell" />
                </div>
              </div>

              {/* Lower Box: Bank, Bank Manager / Consultant Name, Add Bank Action */}
              <div className="form-card-box form-middle-lower-box">
                {banksList.map((b, idx) => (
                  <div key={idx} className="form-3col-row" style={{ alignItems: 'center' }}>
                    <select
                      value={b.bank_id}
                      onChange={e => handleUpdateBankRow(idx, 'bank_id', e.target.value)}
                      className="inline-field-select"
                      title="Bank (multiple banks selection allowed)"
                    >
                      <option value="">Bank (multiple banks selection allowed) *</option>
                      {allBanks.map(ab => (
                        <option key={ab.id} value={ab.id}>
                          {ab.bank_name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Bank Manager / Consultant Name *"
                      value={b.bank_manager_name}
                      onChange={e => handleUpdateBankRow(idx, 'bank_manager_name', e.target.value)}
                      className="inline-field-input"
                      title="Bank Manager / Consultant Name"
                    />

                    <div>
                      {banksList.length === 1 ? (
                        <button
                          type="button"
                          onClick={handleAddBankRow}
                          className="inline-add-bank-btn"
                          style={{ width: '100%' }}
                          title="Add another bank"
                        >
                          <Plus size={12} /> Add Bank
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveBankRow(idx)}
                            className="inline-btn-cancel"
                            style={{ height: '34px', padding: '0 8px', color: '#b91c1c' }}
                            title="Remove this bank"
                          >
                            <X size={12} />
                          </button>
                          {idx === banksList.length - 1 ? (
                            <button
                              type="button"
                              onClick={handleAddBankRow}
                              className="inline-add-bank-btn"
                              style={{ flex: 1 }}
                              title="Add another bank"
                            >
                              <Plus size={12} /> Add Bank
                            </button>
                          ) : (
                            <div style={{ flex: 1 }} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 6: File status at top, Cancel / Save at bottom */}
            <div className="col-6-status-actions">
              <div>
                <select
                  value={fileStatus}
                  onChange={e => setFileStatus(e.target.value as FileStatus)}
                  className="inline-field-select"
                  title="File status"
                >
                  <option value="">File status</option>
                  {ALL_FILE_STATUSES.map(st => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6-actions-bottom">
                <button
                  type="button"
                  onClick={() => {
                    setIsInlineCreating(false);
                    setInlineError(null);
                  }}
                  className="inline-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveInlineEntry}
                  disabled={isLoading}
                  className="inline-btn-save"
                >
                  <Check size={14} /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '11%' }}>File ID</th>
              <th style={{ width: '10%' }}>Login Date</th>
              <th style={{ width: '23%' }}>Client / Company</th>
              <th style={{ width: '9%' }}>Product</th>
              <th style={{ width: '14%' }}>Bank Name</th>
              <th style={{ width: '11%' }}>Sales Member</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Sanction Amount</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>No file records found</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                    {search || statusFilter !== 'All'
                      ? 'Try adjusting your search query or status filter.'
                      : 'Click "New File Entry" above to register the first client loan file.'}
                  </div>
                </td>
              </tr>
            ) : (
              files.map(f => (
                <tr
                  key={f.id}
                  onClick={() => handleOpenFileDetails(f.id)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view file details"
                >
                  {/* 1. File ID */}
                  <td style={{ fontWeight: 600, color: 'var(--color-action-primary)' }}>
                    <span className="num-tabular">{f.id}</span>
                  </td>

                  {/* 2. Login Date */}
                  <td>
                    <div className="num-tabular" style={{ fontSize: 'var(--font-size-sm)' }}>
                      {f.login_date ? f.login_date.split('T')[0] : '—'}
                    </div>
                  </td>

                  {/* 3. Client / Company (company name, next line client name, next line GSTIN) */}
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{f.company_name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {f.client_name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '1px' }}>
                      GSTIN: {f.gst_no || 'Unregistered'}
                    </div>
                  </td>

                  {/* 4. Product (mention only the acronym) */}
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 'var(--font-size-xs)',
                        backgroundColor: 'var(--color-surface-muted)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      {f.product_acronym || f.product_name}
                    </span>
                  </td>

                  {/* 5. Bank Name */}
                  <td>
                    <div style={{ fontWeight: 500 }}>{f.bank_name}</div>
                    {f.bank_manager_name && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        Mgr: {f.bank_manager_name}
                      </div>
                    )}
                  </td>

                  {/* 6. Sales Member */}
                  <td>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {f.sales_member_name}
                    </span>
                  </td>

                  {/* 7. Status (make the colored part a little big) */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`badge badge-${getFileStatusVariant(f.status)}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-pill)',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      {f.status}
                    </span>
                  </td>

                  {/* 8. Sanction Amount */}
                  <td className="table-cell-num" style={{ textAlign: 'right', fontWeight: 600 }}>
                    ₹{f.sanction_loan_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={10}
          onPageChange={setPage}
        />

        {/* Delete Confirmation Modal for List View */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setFileToDelete(null);
          }}
          title="Confirm Delete File"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setFileToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteFile} isLoading={isLoading}>
                Delete File
              </Button>
            </>
          }
        >
          <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
            Are you sure you want to permanently delete file <strong>{fileToDelete?.id}</strong> ({fileToDelete?.company_name})?
            <div style={{ color: 'var(--color-danger)', marginTop: '8px', fontSize: '13px' }}>
              This action cannot be undone. It will remove the file record, associated bank allocations, disbursements, and linked invoices.
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

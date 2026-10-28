import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, Eye, AlertCircle } from 'lucide-react';
import { FileRecord } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Badge, getFileStatusVariant } from '../components/Badge.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';

export const FileApprove: React.FC = () => {
  const { isSuperadmin } = useAuth();
  const [eligibleFiles, setEligibleFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Inspection modal
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);

  // Decision confirmation modal
  const [decisionFile, setDecisionFile] = useState<FileRecord | null>(null);
  const [decisionType, setDecisionType] = useState<'Approve' | 'Reject' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [isDecisionSubmitting, setIsDecisionSubmitting] = useState(false);

  const fetchEligibleFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ files: FileRecord[] }>('/api/files/eligible');
      setEligibleFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch eligible files');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperadmin) {
      fetchEligibleFiles();
    }
  }, [isSuperadmin]);

  if (!isSuperadmin) {
    return (
      <div className="page-content">
        <div className="alert alert-danger" style={{ maxWidth: '600px', margin: '40px auto' }}>
          <AlertCircle size={20} />
          <div>
            <strong>Access Denied:</strong> This module is restricted to Superadmin users only. Team members cannot view or perform file approvals.
          </div>
        </div>
      </div>
    );
  }

  const handleOpenDecision = (file: FileRecord, type: 'Approve' | 'Reject') => {
    setDecisionFile(file);
    setDecisionType(type);
    setRemarks(type === 'Approve' ? 'Approved for loan disbursement' : 'Rejected after compliance verification');
  };

  const handleCommitDecision = async () => {
    if (!decisionFile || !decisionType) return;
    setIsDecisionSubmitting(true);
    setError(null);
    try {
      const endpoint = decisionType === 'Approve' ? `/api/files/${decisionFile.id}/approve` : `/api/files/${decisionFile.id}/reject`;
      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });

      setSuccessMsg(`File "${decisionFile.id}" has been ${decisionType}d successfully.`);
      setDecisionFile(null);
      setDecisionType(null);
      setIsInspectOpen(false);
      fetchEligibleFiles();
    } catch (err: any) {
      setError(err.message || `Failed to ${decisionType} file`);
    } finally {
      setIsDecisionSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">File Approve</h1>
          <div className="page-subtitle">
            Superadmin verification panel: Review eligible loan files and authorize disbursement eligibility.
          </div>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            onClick={fetchEligibleFiles}
            isLoading={isLoading}
            icon={<RefreshCw size={14} />}
          >
            Refresh Queue
          </Button>
        </div>
      </div>

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

      {/* Eligible Queue Summary */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Pending Approvals:
        </span>
        <Badge label={`${eligibleFiles.length} file(s) awaiting review`} variant="warning" />
      </div>

      {/* Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>File ID</th>
              <th>Login Date</th>
              <th>Client / Company</th>
              <th>Product (Acronym)</th>
              <th>Bank Name</th>
              <th>Case Sourced</th>
              <th style={{ textAlign: 'right' }}>Sanction Amount</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'right' }}>Review Actions</th>
            </tr>
          </thead>
          <tbody>
            {eligibleFiles.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-empty">
                  <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>No files awaiting approval</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                    Files marked as "Sanction" in the File Logged-in module will appear here for Superadmin authorization.
                  </div>
                </td>
              </tr>
            ) : (
              eligibleFiles.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    <span className="num-tabular">{f.id}</span>
                  </td>
                  <td>
                    <span className="num-tabular" style={{ fontSize: 'var(--font-size-sm)' }}>
                      {f.login_date ? f.login_date.split('T')[0] : '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{f.company_name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {f.client_name} • GSTIN: {f.gst_no}
                    </div>
                  </td>
                  <td>
                    <div>{f.product_name}</div>
                    {f.product_acronym && (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          backgroundColor: 'var(--color-surface-muted)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-xs)',
                          fontWeight: 600
                        }}
                      >
                        {f.product_acronym}
                      </span>
                    )}
                  </td>
                  <td>{f.bank_name}</td>
                  <td>{f.source || '—'}</td>
                  <td className="table-cell-num">
                    ₹{f.sanction_loan_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Badge label={f.status} variant={getFileStatusVariant(f.status)} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(f);
                          setIsInspectOpen(true);
                        }}
                        icon={<Eye size={12} />}
                      >
                        Inspect
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenDecision(f, 'Approve')}
                        icon={<CheckCircle size={12} />}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleOpenDecision(f, 'Reject')}
                        icon={<XCircle size={12} />}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inspect Modal */}
      <Modal
        isOpen={isInspectOpen && selectedFile !== null}
        onClose={() => setIsInspectOpen(false)}
        title={`File Details: ${selectedFile?.id}`}
        isWide={true}
        footer={
          selectedFile && (
            <>
              <Button variant="secondary" onClick={() => setIsInspectOpen(false)}>
                Close
              </Button>
              <Button
                variant="danger"
                onClick={() => handleOpenDecision(selectedFile, 'Reject')}
                icon={<XCircle size={14} />}
              >
                Reject File
              </Button>
              <Button
                variant="primary"
                onClick={() => handleOpenDecision(selectedFile, 'Approve')}
                icon={<CheckCircle size={14} />}
              >
                Approve File
              </Button>
            </>
          )
        }
      >
        {selectedFile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="grid-2">
              <div>
                <label className="form-label">Client Company Name</label>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>{selectedFile.company_name}</div>
              </div>
              <div>
                <label className="form-label">Client GSTIN</label>
                <div className="num-tabular" style={{ fontSize: 'var(--font-size-md)' }}>{selectedFile.gst_no}</div>
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label className="form-label">Authorized Contact Person</label>
                <div>{selectedFile.client_name}</div>
              </div>
              <div>
                <label className="form-label">Client Email ID</label>
                <div>{selectedFile.client_email}</div>
              </div>
            </div>

            <div className="grid-3">
              <div>
                <label className="form-label">Product</label>
                <div>{selectedFile.product_name} ({selectedFile.product_acronym})</div>
              </div>
              <div>
                <label className="form-label">Sanction Loan Amount</label>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-success)' }}>
                  ₹{selectedFile.sanction_loan_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label className="form-label">Case Sourced</label>
                <div>{selectedFile.source || 'Direct Client'}</div>
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label className="form-label">Bank & Branch Details</label>
                <div>{selectedFile.bank_name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Manager: {selectedFile.bank_manager_name}
                </div>
              </div>
              <div>
                <label className="form-label">Office Sales Member</label>
                <div>{selectedFile.sales_member_name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Code: {selectedFile.code}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Decision Confirmation Modal */}
      <Modal
        isOpen={decisionFile !== null && decisionType !== null}
        onClose={() => setDecisionFile(null)}
        title={decisionType === 'Approve' ? 'Confirm Approval Decision' : 'Confirm Rejection Decision'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecisionFile(null)} disabled={isDecisionSubmitting}>
              Cancel
            </Button>
            <Button
              variant={decisionType === 'Approve' ? 'primary' : 'danger'}
              onClick={handleCommitDecision}
              isLoading={isDecisionSubmitting}
            >
              Confirm {decisionType}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            Are you sure you want to <strong>{decisionType?.toLowerCase()}</strong> file{' '}
            <span className="num-tabular" style={{ fontWeight: 600 }}>{decisionFile?.id}</span> for{' '}
            <strong>{decisionFile?.company_name}</strong>?
          </div>
          {decisionType === 'Approve' ? (
            <div className="alert alert-info" style={{ fontSize: 'var(--font-size-xs)' }}>
              Approving will authorize this file for loan disbursement entries in the Disbursements module and subsequent invoice generation.
            </div>
          ) : (
            <div className="alert alert-warning" style={{ fontSize: 'var(--font-size-xs)' }}>
              Rejecting will permanently disqualify this file from disbursement entries and invoicing.
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Decision Notes / Remarks</label>
            <textarea
              className="textarea-control"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Enter compliance or audit notes..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

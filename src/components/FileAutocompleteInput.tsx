import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Building2 } from 'lucide-react';
import { FileRecord } from '../types/index.js';
import { apiRequest } from '../api/client.js';

export interface FileAutocompleteInputProps {
  label?: string;
  hideLabel?: boolean;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSelectFile: (file: FileRecord) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  id?: string;
  inputStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}

export const FileAutocompleteInput: React.FC<FileAutocompleteInputProps> = ({
  label = 'File Logged-in ID',
  hideLabel = false,
  required,
  value,
  onChange,
  onSelectFile,
  error,
  helperText,
  placeholder = 'e.g. 26-BLX-001 (click or type to search)',
  id,
  inputStyle,
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [approvedFiles, setApprovedFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch approved files on mount
  useEffect(() => {
    let isMounted = true;
    const fetchApproved = async () => {
      setIsLoading(true);
      try {
        const data = await apiRequest<{ files: FileRecord[] }>('/api/files?status=Disburse,Sanction,Approved&limit=100');
        if (isMounted) {
          setApprovedFiles(data.files || []);
        }
      } catch (err) {
        console.error('Failed to load approved files:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchApproved();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter files based on user text input
  const query = value.trim().toLowerCase();
  const filteredFiles = approvedFiles.filter(f => {
    if (!query) return true;
    return (
      f.id.toLowerCase().includes(query) ||
      (f.company_name && f.company_name.toLowerCase().includes(query)) ||
      (f.client_name && f.client_name.toLowerCase().includes(query)) ||
      (f.product_name && f.product_name.toLowerCase().includes(query)) ||
      (f.bank_name && f.bank_name.toLowerCase().includes(query))
    );
  });

  const handleSelect = (f: FileRecord) => {
    onChange(f.id);
    onSelectFile(f);
    setIsOpen(false);
  };

  const inputId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, '-') : undefined);

  return (
    <div className={hideLabel ? '' : 'form-group'} ref={containerRef} style={{ position: 'relative', ...style }}>
      {!hideLabel && (
        <label htmlFor={inputId} className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            {label}
            {required && <span className="required-star" aria-hidden="true">*</span>}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
            {approvedFiles.length} approved account{approvedFiles.length === 1 ? '' : 's'}
          </span>
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={inputId}
          type="text"
          className={`input-control ${error ? 'has-error' : ''}`}
          placeholder={placeholder}
          value={value}
          onClick={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          autoComplete="off"
          style={{ paddingRight: '60px', ...inputStyle }}
        />

        <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(true);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-tertiary)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Clear input"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Toggle approved accounts dropdown"
          >
            <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
          </button>
        </div>
      </div>

      {error && (
        <div id={`${inputId}-error`} className="form-error" role="alert">
          {error}
        </div>
      )}
      {!error && helperText && (
        <div id={`${inputId}-helper`} className="form-helper">
          {helperText}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            minWidth: '340px',
            maxWidth: '460px',
            zIndex: 1050,
            marginTop: '4px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            maxHeight: '280px',
            overflowY: 'auto'
          }}
        >
          {isLoading ? (
            <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Loading approved accounts...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {query ? `No approved accounts matching "${query}"` : 'No approved files found in system.'}
            </div>
          ) : (
            filteredFiles.map(f => (
              <div
                key={f.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(f);
                }}
                onClick={() => handleSelect(f)}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  backgroundColor: value === f.id ? 'var(--color-surface-hover)' : 'transparent',
                  transition: 'background-color 100ms'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = value === f.id ? 'var(--color-surface-hover)' : 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-action-primary)', fontSize: '13px' }}>
                      {f.id}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        backgroundColor: 'var(--color-success-bg, #ecfdf5)',
                        color: 'var(--color-success, #059669)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}
                    >
                      Approved
                    </span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                    ₹{f.sanction_loan_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  <div>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{f.company_name}</span>
                    <span style={{ margin: '0 4px', color: 'var(--color-text-tertiary)' }}>•</span>
                    <span>{f.client_name}</span>
                  </div>
                  <div>
                    <span>{f.bank_name}</span>
                    <span style={{ margin: '0 4px', color: 'var(--color-text-tertiary)' }}>•</span>
                    <span style={{ fontWeight: 500 }}>{f.product_acronym || f.product_name}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

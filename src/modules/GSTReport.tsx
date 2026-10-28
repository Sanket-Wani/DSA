import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Firm } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Select } from '../components/Select.js';

export const GSTReport: React.FC = () => {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [selectedFirmId, setSelectedFirmId] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));

  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportExcel = () => {
    if (!records || records.length === 0) return;

    const firmName = firms.find(f => String(f.id) === selectedFirmId)?.firm_name || 'Firm';
    const monthLabel = months.find(m => m.value === selectedMonth)?.label || selectedMonth;

    const exportRows = records.map(r => ({
      'Invoice No': r.invoice_number,
      'Invoice Date': r.invoice_date,
      'Client / Trade Name': r.trade_legal_name,
      'Client GSTIN': r.gst_no || 'Unregistered',
      'Taxable Value (INR)': Number(r.taxable_amount || 0),
      'Billed GST (INR)': Number(r.invoice_gst_amount || 0),
      'CGST (INR)': Number(r.cgst_amount || 0),
      'SGST (INR)': Number(r.sgst_amount || 0),
      'IGST (INR)': Number(r.igst_amount || 0),
      'GST Received Date': r.gst_received_date || '—',
      'GST Collected (INR)': Number(r.accounts_gst_amount || 0),
      'Receiving GST Account': r.gst_account_name || '—',
      'GST Status': r.gst_status || 'Pending'
    }));

    if (summary) {
      exportRows.push({
        'Invoice No': 'TOTAL',
        'Invoice Date': '',
        'Client / Trade Name': '',
        'Client GSTIN': '',
        'Taxable Value (INR)': summary.totalTaxable,
        'Billed GST (INR)': summary.totalInvoiceGst,
        'CGST (INR)': summary.totalCgst,
        'SGST (INR)': summary.totalSgst,
        'IGST (INR)': summary.totalIgst,
        'GST Received Date': '',
        'GST Collected (INR)': summary.totalCollectedGst,
        'Receiving GST Account': '',
        'GST Status': ''
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'GST Report');

    const cleanFirm = firmName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `GST_Report_${cleanFirm}_${selectedYear}_M${selectedMonth}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  useEffect(() => {
    const fetchFirms = async () => {
      try {
        const res = await apiRequest<{ firms: Firm[] }>('/api/firms');
        setFirms(res.firms || []);
        if (res.firms?.length > 0) {
          setSelectedFirmId(String(res.firms[0].id));
        }
      } catch (err) {
        console.error('Failed to load firms:', err);
      }
    };
    fetchFirms();
  }, []);

  const handleGenerateReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFirmId || !selectedYear || !selectedMonth) {
      setError('Please select Firm, Year, and Month to view the report.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const query = new URLSearchParams({
        firm_id: selectedFirmId,
        year: selectedYear,
        month: selectedMonth
      });

      const res = await apiRequest<{
        firm: Firm;
        records: any[];
        summary: any;
      }>(`/api/reports/gst?${query.toString()}`);

      setRecords(res.records || []);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err.message || 'Failed to generate GST report');
      setRecords([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const months = [
    { value: '1', label: '01 - January' },
    { value: '2', label: '02 - February' },
    { value: '3', label: '03 - March' },
    { value: '4', label: '04 - April' },
    { value: '5', label: '05 - May' },
    { value: '6', label: '06 - June' },
    { value: '7', label: '07 - July' },
    { value: '8', label: '08 - August' },
    { value: '9', label: '09 - September' },
    { value: '10', label: '10 - October' },
    { value: '11', label: '11 - November' },
    { value: '12', label: '12 - December' }
  ];

  const years = ['2024', '2025', '2026', '2027'];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">GST report</h1>
          <div className="page-subtitle">
            Statutory GST outward supply and collection report derived directly from Accounts ledger data.
          </div>
        </div>
        <div className="page-actions">
          {hasSearched && records.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleExportExcel}
              icon={<Download size={16} />}
            >
              Export to Excel
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleGenerateReport} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto', gap: '16px', alignItems: 'flex-end' }}>
          <Select
            label="Firm"
            required
            value={selectedFirmId}
            onChange={e => setSelectedFirmId(e.target.value)}
          >
            <option value="">-- Select Firm --</option>
            {firms.map(f => (
              <option key={f.id} value={f.id}>
                {f.firm_name}
              </option>
            ))}
          </Select>

          <Select
            label="Month"
            required
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>

          <Select
            label="Year"
            required
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
          >
            {years.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              icon={<FileSpreadsheet size={16} />}
            >
              View Report
            </Button>

            {hasSearched && records.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleExportExcel}
                icon={<Download size={16} />}
              >
                Export in Excel Format
              </Button>
            )}
          </div>
        </form>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          <div className="panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Total Taxable Value
            </div>
            <div className="num-tabular" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: '4px' }}>
              ₹{summary.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Total GST Billed
            </div>
            <div className="num-tabular" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: '4px' }}>
              ₹{summary.totalInvoiceGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              CGST: ₹{summary.totalCgst.toLocaleString('en-IN')} | SGST: ₹{summary.totalSgst.toLocaleString('en-IN')} | IGST: ₹{summary.totalIgst.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Total GST Collected
            </div>
            <div className="num-tabular" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginTop: '4px', color: 'var(--color-success)' }}>
              ₹{summary.totalCollectedGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {hasSearched && records.length === 0 && !error && (
        <div className="panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)' }}>
            No matching GST records found
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            No invoices or accounts entries exist for the selected firm and period.
          </div>
        </div>
      )}
    </div>
  );
};

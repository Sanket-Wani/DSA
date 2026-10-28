import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// 1. GST Report endpoint
router.get('/gst', (req, res) => {
  const { firm_id, year, month } = req.query;

  if (!firm_id || !year || !month) {
    return res.status(400).json({ error: 'Firm, Year, and Month are required filters to generate GST Report.' });
  }

  const firmIdNum = parseInt(String(firm_id), 10);
  const yearNum = parseInt(String(year), 10);
  const monthNum = parseInt(String(month), 10);

  if (isNaN(firmIdNum) || isNaN(yearNum) || isNaN(monthNum)) {
    return res.status(400).json({ error: 'Invalid filter parameters' });
  }

  try {
    const firm = db.prepare('SELECT id, firm_name, gstin FROM firms WHERE id = ?').get(firmIdNum) as any;
    if (!firm) {
      return res.status(404).json({ error: 'Selected firm not found' });
    }

    const records = db.prepare(`
      SELECT 
        i.id as invoice_id,
        i.invoice_number,
        i.invoice_date,
        i.year,
        i.month,
        i.amount as taxable_amount,
        (i.cgst_amount + i.sgst_amount + i.igst_amount) as invoice_gst_amount,
        i.cgst_amount,
        i.sgst_amount,
        i.igst_amount,
        i.firm_name_snapshot as firm_name,
        i.client_company_snapshot as trade_legal_name,
        i.client_gstin_snapshot as gst_no,
        a.gst_received_date,
        a.gst_amount as accounts_gst_amount,
        a.gst_account_id,
        rb.account_name as gst_account_name,
        CASE 
          WHEN a.gst_received_date IS NOT NULL AND a.gst_amount > 0 THEN 'Collected'
          WHEN a.gst_received_date IS NOT NULL THEN 'Partially Collected'
          ELSE 'Pending'
        END as gst_status
      FROM invoices i
      LEFT JOIN accounts_ledger a ON i.id = a.invoice_id
      LEFT JOIN receiving_bank_accounts rb ON a.gst_account_id = rb.id
      WHERE i.firm_id = ? AND i.year = ? AND i.month = ?
      ORDER BY i.invoice_date ASC
    `).all(firmIdNum, yearNum, monthNum);

    const summary = records.reduce((acc: any, r: any) => {
      acc.totalTaxable += Number(r.taxable_amount || 0);
      acc.totalInvoiceGst += Number(r.invoice_gst_amount || 0);
      acc.totalCgst += Number(r.cgst_amount || 0);
      acc.totalSgst += Number(r.sgst_amount || 0);
      acc.totalIgst += Number(r.igst_amount || 0);
      acc.totalCollectedGst += Number(r.accounts_gst_amount || 0);
      return acc;
    }, {
      totalTaxable: 0,
      totalInvoiceGst: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalCollectedGst: 0
    });

    res.json({
      firm,
      filter: { year: yearNum, month: monthNum },
      records,
      summary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. TDS Report endpoint
router.get('/tds', (req, res) => {
  const { firm_id, year, month } = req.query;

  if (!firm_id || !year || !month) {
    return res.status(400).json({ error: 'Firm, Year, and Month are required filters to generate TDS Report.' });
  }

  const firmIdNum = parseInt(String(firm_id), 10);
  const yearNum = parseInt(String(year), 10);
  const monthNum = parseInt(String(month), 10);

  if (isNaN(firmIdNum) || isNaN(yearNum) || isNaN(monthNum)) {
    return res.status(400).json({ error: 'Invalid filter parameters' });
  }

  try {
    const firm = db.prepare('SELECT id, firm_name, gstin FROM firms WHERE id = ?').get(firmIdNum) as any;
    if (!firm) {
      return res.status(404).json({ error: 'Selected firm not found' });
    }

    const records = db.prepare(`
      SELECT 
        i.id as invoice_id,
        i.invoice_number,
        i.invoice_date,
        i.year,
        i.month,
        i.amount as invoice_amount,
        i.total_amount as invoice_total,
        i.firm_name_snapshot as firm_name,
        i.client_company_snapshot as trade_legal_name,
        i.client_gstin_snapshot as gst_no,
        a.tds_amount,
        COALESCE(a.tds_recovery_status, 'Pending') as tds_recovery_status,
        a.updated_at
      FROM invoices i
      LEFT JOIN accounts_ledger a ON i.id = a.invoice_id
      WHERE i.firm_id = ? AND i.year = ? AND i.month = ?
      ORDER BY i.invoice_date ASC
    `).all(firmIdNum, yearNum, monthNum);

    const summary = records.reduce((acc: any, r: any) => {
      const tds = Number(r.tds_amount || 0);
      acc.totalTds += tds;
      if (r.tds_recovery_status === 'Recovered') {
        acc.totalRecovered += tds;
      } else if (r.tds_recovery_status === 'Pending') {
        acc.totalPending += tds;
      }
      return acc;
    }, {
      totalTds: 0,
      totalRecovered: 0,
      totalPending: 0
    });

    res.json({
      firm,
      filter: { year: yearNum, month: monthNum },
      records,
      summary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

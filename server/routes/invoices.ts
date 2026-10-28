import { Router } from 'express';
import { db } from '../db.js';
import { calculateGst } from '../services/taxService.js';
import { generateInvoicePdf } from '../services/pdfService.js';
import crypto from 'crypto';

const router = Router();

// Helper to generate sequential Invoice Number e.g. INV/2026-27/0001
function generateNextInvoiceNumber(firmId: number, invoiceDateStr: string): string {
  const date = new Date(invoiceDateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  // Indian Financial Year calculation (Apr - Mar)
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  const fyPrefix = `INV/${fyStart}-${String(fyEnd).padStart(2, '0')}/`;

  const lastInv = db.prepare(`
    SELECT invoice_number 
    FROM invoices 
    WHERE invoice_number LIKE ? 
    ORDER BY invoice_number DESC 
    LIMIT 1
  `).get(`${fyPrefix}%`) as { invoice_number: string } | undefined;

  let nextSeq = 1;
  if (lastInv && lastInv.invoice_number) {
    const parts = lastInv.invoice_number.split('/');
    const lastNum = parseInt(parts[2], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${fyPrefix}${String(nextSeq).padStart(4, '0')}`;
}

// 1. Lookup approved file for Create Invoices
router.get('/lookup/:fileId', (req, res) => {
  const fileId = req.params.fileId.trim();

  try {
    const file = db.prepare(`
      SELECT 
        f.id,
        f.login_date,
        f.status,
        f.source,
        f.sanction_loan_amount,
        c.company_name,
        c.client_name,
        c.client_email,
        c.gst_no,
        p.name as product_name,
        p.acronym as product_acronym,
        b.bank_name,
        b.bank_gst_no
      FROM files f
      JOIN clients c ON f.client_id = c.id
      JOIN products p ON f.product_id = p.id
      JOIN banks b ON f.bank_id = b.id
      WHERE f.id = ?
    `).get(fileId) as any;

    if (!file) {
      return res.status(404).json({ error: `File ID "${fileId}" not found in system records.` });
    }

    const invoiceableStatuses = ['Disburse', 'Sanction', 'Approved'];
    if (!invoiceableStatuses.includes(file.status)) {
      return res.status(400).json({ 
        error: `Invoices can only be created for Sanctioned or Disbursed files. Current status of "${fileId}" is "${file.status}".`,
        fileStatus: file.status 
      });
    }

    // Get total disbursement amount
    const totalDisbursed = (db.prepare(`
      SELECT COALESCE(SUM(disbursement_amount), 0) as total
      FROM disbursements
      WHERE file_id = ?
    `).get(fileId) as { total: number }).total;

    // Get existing invoices for this file
    const existingInvoices = db.prepare(`
      SELECT * FROM invoices
      WHERE file_id = ?
      ORDER BY created_at DESC
    `).all(fileId);

    res.json({
      file,
      existingInvoices,
      suggestedDisbursementAmount: totalDisbursed > 0 ? totalDisbursed : file.sanction_loan_amount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create and persist invoice
router.post('/', (req, res) => {
  const {
    firm_id,
    file_id,
    loan_account_no,
    mcf_no,
    disbursement_amount,
    sac,
    amount,
    invoice_date = new Date().toISOString().split('T')[0],
    gst_type,
    gstType
  } = req.body;

  // Validation
  const errors: string[] = [];
  if (!firm_id) errors.push('Firm selection is required');
  if (!file_id?.trim()) errors.push('File ID is required');
  if (!loan_account_no?.trim()) errors.push('Loan Account number is required');
  if (!mcf_no?.trim()) errors.push('MCF number is required');
  if (disbursement_amount === undefined || isNaN(Number(disbursement_amount)) || Number(disbursement_amount) <= 0) {
    errors.push('Valid positive disbursement amount is required');
  }
  if (!sac?.trim()) errors.push('SAC code is required');
  if (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
    errors.push('Valid positive invoice taxable amount is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors, error: errors.join(', ') });
  }

  try {
    // 1. Verify file exists and is Approved
    const file = db.prepare(`
      SELECT 
        f.*,
        c.company_name,
        c.client_name,
        c.client_email,
        c.gst_no,
        p.name as product_name,
        b.bank_name
      FROM files f
      JOIN clients c ON f.client_id = c.id
      JOIN products p ON f.product_id = p.id
      JOIN banks b ON f.bank_id = b.id
      WHERE f.id = ?
    `).get(file_id.trim()) as any;

    if (!file) {
      return res.status(404).json({ error: `File ID "${file_id}" not found.` });
    }

    const invoiceableStatuses = ['Disburse', 'Sanction', 'Approved'];
    if (!invoiceableStatuses.includes(file.status)) {
      return res.status(400).json({ error: `Invoice creation blocked: File "${file_id}" is in status "${file.status}". Sanction or Disburse status required.` });
    }

    // 2. Verify firm exists
    const firm = db.prepare('SELECT * FROM firms WHERE id = ?').get(Number(firm_id)) as any;
    if (!firm) {
      return res.status(404).json({ error: `Configured Firm with ID "${firm_id}" not found.` });
    }

    // 3. Calculate GST through centralized service (honoring radio selection if provided)
    const resolvedGstType = (gst_type || gstType) as 'intra' | 'inter' | undefined;
    const taxCalc = calculateGst(Number(amount), sac.trim(), Number(firm_id), file.gst_no, resolvedGstType);

    const invoiceId = crypto.randomUUID();
    const invoiceNumber = generateNextInvoiceNumber(Number(firm_id), invoice_date);
    const dateObj = new Date(invoice_date);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1; // 1 to 12
    const now = new Date().toISOString();

    const insertInvoiceTx = db.transaction(() => {
      // Insert into invoices
      db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, file_id, firm_id, invoice_date, year, month,
          loan_account_no, mcf_no, disbursement_amount, sac, amount,
          cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_amount,
          firm_name_snapshot, firm_gstin_snapshot, firm_address_snapshot,
          client_company_snapshot, client_name_snapshot, client_email_snapshot, client_gstin_snapshot,
          bank_name_snapshot, product_name_snapshot,
          created_by, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?
        )
      `).run(
        invoiceId,
        invoiceNumber,
        file.id,
        firm.id,
        invoice_date,
        year,
        month,
        loan_account_no.trim(),
        mcf_no.trim(),
        Number(disbursement_amount),
        sac.trim(),
        taxCalc.taxableAmount,
        taxCalc.cgstRate,
        taxCalc.cgstAmount,
        taxCalc.sgstRate,
        taxCalc.sgstAmount,
        taxCalc.igstRate,
        taxCalc.igstAmount,
        taxCalc.totalAmount,
        firm.firm_name,
        firm.gstin,
        firm.address,
        file.company_name,
        file.client_name,
        file.client_email,
        file.gst_no,
        file.bank_name,
        file.product_name,
        req.user?.id || null,
        now
      );

      // Automatically initialize accounts_ledger row
      db.prepare(`
        INSERT INTO accounts_ledger (
          invoice_id, voucher_id, tds_recovery_status, updated_at
        ) VALUES (?, (SELECT id FROM voucher_types LIMIT 1), 'Pending', ?)
      `).run(invoiceId, now);

      return invoiceId;
    });

    const createdId = insertInvoiceTx();
    const savedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(createdId);

    res.status(201).json({
      message: `Invoice ${invoiceNumber} created successfully`,
      invoice: savedInvoice
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create invoice' });
  }
});

// 3. List saved invoices
router.get('/', (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT * FROM invoices
      ORDER BY created_at DESC
    `).all();
    res.json({ invoices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Retrieve single saved invoice
router.get('/:id', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: `Invoice ID "${req.params.id}" not found.` });
    }
    res.json({ invoice });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Download Invoice as real PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT 
        i.*,
        f.source as file_source,
        t.description as sac_description,
        fm.bank_name as firm_bank_name,
        fm.account_name as firm_account_name,
        fm.account_no as firm_account_no,
        fm.ifsc_code as firm_ifsc_code,
        fm.branch as firm_branch
      FROM invoices i
      LEFT JOIN files f ON i.file_id = f.id
      LEFT JOIN tax_rates t ON i.sac = t.sac_code
      LEFT JOIN firms fm ON i.firm_id = fm.id
      WHERE i.id = ?
    `).get(req.params.id) as any;
    if (!invoice) {
      return res.status(404).json({ error: `Invoice ID "${req.params.id}" not found.` });
    }

    const pdfBuffer = await generateInvoicePdf(invoice);

    const safeFilename = `${invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate PDF' });
  }
});

export default router;

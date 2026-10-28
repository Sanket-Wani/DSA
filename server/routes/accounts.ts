import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// 1. List accounts ledger rows joined with saved invoices
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        i.id as invoice_id,
        i.invoice_number,
        i.invoice_date,
        i.year,
        i.month,
        i.amount as invoice_taxable_amount,
        i.total_amount as invoice_total_amount,
        (i.total_amount - i.amount) as invoice_gst_amount,
        i.firm_name_snapshot as firm_name,
        i.client_company_snapshot as trade_legal_name,
        i.client_company_snapshot as company_name,
        i.client_name_snapshot as client_name,
        i.client_gstin_snapshot as gst_no,
        i.firm_id,
        fm.bank_name as firm_bank_name,
        fm.account_name as firm_account_name,
        fm.account_no as firm_account_no,
        fm.ifsc_code as firm_ifsc_code,
        fm.branch as firm_branch,
        a.id as ledger_id,
        a.voucher_id,
        v.voucher_name,
        a.taxable_received_date,
        a.taxable_amount,
        a.taxable_bank_account_id,
        COALESCE(a.taxable_status, 'Pending') as taxable_status,
        rb_tax.account_name as taxable_bank_account_name,
        a.gst_received_date,
        a.gst_amount,
        a.gst_account_id,
        COALESCE(a.gst_status, 'Pending') as gst_status,
        rb_gst.account_name as gst_account_name,
        a.tds_amount,
        a.tds_received_date,
        a.tds_bank_account_id,
        rb_tds.account_name as tds_bank_account_name,
        COALESCE(a.tds_section, '194J') as tds_section,
        COALESCE(a.tds_status, COALESCE(a.tds_recovery_status, 'Pending')) as tds_status,
        COALESCE(a.tds_recovery_status, 'Pending') as tds_recovery_status,
        a.updated_at
      FROM invoices i
      LEFT JOIN firms fm ON i.firm_id = fm.id
      LEFT JOIN accounts_ledger a ON i.id = a.invoice_id
      LEFT JOIN voucher_types v ON a.voucher_id = v.id
      LEFT JOIN receiving_bank_accounts rb_tax ON a.taxable_bank_account_id = rb_tax.id
      LEFT JOIN receiving_bank_accounts rb_gst ON a.gst_account_id = rb_gst.id
      LEFT JOIN receiving_bank_accounts rb_tds ON a.tds_bank_account_id = rb_tds.id
      ORDER BY i.created_at DESC
    `).all();

    res.json({ accounts: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Update editable ledger sections for an invoice
router.put('/:invoiceId', (req, res) => {
  const invoiceId = req.params.invoiceId.trim();
  const {
    voucher_id,
    taxable_received_date,
    taxable_amount,
    taxable_bank_account_id,
    taxable_status,
    gst_received_date,
    gst_amount,
    gst_account_id,
    gst_status,
    tds_received_date,
    tds_amount,
    tds_bank_account_id,
    tds_section,
    tds_status,
    tds_recovery_status
  } = req.body;

  try {
    // 1. Verify invoice exists
    const invoice = db.prepare('SELECT id, firm_id FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) {
      return res.status(404).json({ error: `Invoice with ID "${invoiceId}" not found.` });
    }

    // Default receiving bank account: Firm 2 (Vinayak) -> ID 2; Firm 1 (Mavin) -> ID 1
    const defaultBankId = invoice.firm_id === 2 ? 2 : 1;
    const finalTaxBankId = taxable_bank_account_id ? Number(taxable_bank_account_id) : defaultBankId;
    const finalGstBankId = gst_account_id ? Number(gst_account_id) : defaultBankId;
    const finalTdsBankId = tds_bank_account_id ? Number(tds_bank_account_id) : defaultBankId;

    // 2. Validate voucher if provided
    if (voucher_id) {
      const v = db.prepare('SELECT id FROM voucher_types WHERE id = ?').get(Number(voucher_id));
      if (!v) {
        return res.status(400).json({ error: 'Selected Voucher type does not exist' });
      }
    }

    // 3. Validate bank accounts if provided
    if (finalTaxBankId) {
      const b = db.prepare('SELECT id FROM receiving_bank_accounts WHERE id = ?').get(finalTaxBankId);
      if (!b) return res.status(400).json({ error: 'Selected Taxable Bank Account does not exist' });
    }
    if (finalGstBankId) {
      const b = db.prepare('SELECT id FROM receiving_bank_accounts WHERE id = ?').get(finalGstBankId);
      if (!b) return res.status(400).json({ error: 'Selected GST Account does not exist' });
    }
    if (finalTdsBankId) {
      const b = db.prepare('SELECT id FROM receiving_bank_accounts WHERE id = ?').get(finalTdsBankId);
      if (!b) return res.status(400).json({ error: 'Selected TDS Bank Account does not exist' });
    }

    const now = new Date().toISOString();

    // Check if ledger row exists, if not insert, else update
    const existing = db.prepare('SELECT id FROM accounts_ledger WHERE invoice_id = ?').get(invoiceId);

    const effectiveTdsStatus = tds_status || tds_recovery_status || 'Pending';

    if (existing) {
      db.prepare(`
        UPDATE accounts_ledger SET
          voucher_id = ?,
          taxable_received_date = ?,
          taxable_amount = ?,
          taxable_bank_account_id = ?,
          taxable_status = ?,
          gst_received_date = ?,
          gst_amount = ?,
          gst_account_id = ?,
          gst_status = ?,
          tds_amount = ?,
          tds_received_date = ?,
          tds_bank_account_id = ?,
          tds_section = ?,
          tds_status = ?,
          tds_recovery_status = ?,
          updated_at = ?,
          updated_by = ?
        WHERE invoice_id = ?
      `).run(
        voucher_id ? Number(voucher_id) : null,
        taxable_received_date || null,
        taxable_amount !== undefined && taxable_amount !== null && taxable_amount !== '' ? Number(taxable_amount) : null,
        finalTaxBankId,
        taxable_status || 'Pending',
        gst_received_date || null,
        gst_amount !== undefined && gst_amount !== null && gst_amount !== '' ? Number(gst_amount) : null,
        finalGstBankId,
        gst_status || 'Pending',
        tds_amount !== undefined && tds_amount !== null && tds_amount !== '' ? Number(tds_amount) : null,
        tds_received_date || null,
        finalTdsBankId,
        tds_section || '194J',
        effectiveTdsStatus,
        effectiveTdsStatus,
        now,
        req.user?.id || null,
        invoiceId
      );
    } else {
      db.prepare(`
        INSERT INTO accounts_ledger (
          invoice_id, voucher_id,
          taxable_received_date, taxable_amount, taxable_bank_account_id, taxable_status,
          gst_received_date, gst_amount, gst_account_id, gst_status,
          tds_amount, tds_received_date, tds_bank_account_id, tds_section, tds_status, tds_recovery_status,
          updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        voucher_id ? Number(voucher_id) : null,
        taxable_received_date || null,
        taxable_amount !== undefined && taxable_amount !== null && taxable_amount !== '' ? Number(taxable_amount) : null,
        finalTaxBankId,
        taxable_status || 'Pending',
        gst_received_date || null,
        gst_amount !== undefined && gst_amount !== null && gst_amount !== '' ? Number(gst_amount) : null,
        finalGstBankId,
        gst_status || 'Pending',
        tds_amount !== undefined && tds_amount !== null && tds_amount !== '' ? Number(tds_amount) : null,
        tds_received_date || null,
        finalTdsBankId,
        tds_section || '194J',
        effectiveTdsStatus,
        effectiveTdsStatus,
        now,
        req.user?.id || null
      );
    }

    const updated = db.prepare(`
      SELECT 
        i.id as invoice_id,
        i.invoice_number,
        i.invoice_date,
        i.year,
        i.month,
        i.amount as invoice_taxable_amount,
        i.total_amount as invoice_total_amount,
        (i.total_amount - i.amount) as invoice_gst_amount,
        i.firm_name_snapshot as firm_name,
        i.client_company_snapshot as trade_legal_name,
        i.client_company_snapshot as company_name,
        i.client_name_snapshot as client_name,
        i.client_gstin_snapshot as gst_no,
        i.firm_id,
        fm.bank_name as firm_bank_name,
        fm.account_name as firm_account_name,
        fm.account_no as firm_account_no,
        fm.ifsc_code as firm_ifsc_code,
        fm.branch as firm_branch,
        a.id as ledger_id,
        a.voucher_id,
        v.voucher_name,
        a.taxable_received_date,
        a.taxable_amount,
        a.taxable_bank_account_id,
        COALESCE(a.taxable_status, 'Pending') as taxable_status,
        rb_tax.account_name as taxable_bank_account_name,
        a.gst_received_date,
        a.gst_amount,
        a.gst_account_id,
        COALESCE(a.gst_status, 'Pending') as gst_status,
        rb_gst.account_name as gst_account_name,
        a.tds_amount,
        a.tds_received_date,
        a.tds_bank_account_id,
        rb_tds.account_name as tds_bank_account_name,
        COALESCE(a.tds_section, '194J') as tds_section,
        COALESCE(a.tds_status, COALESCE(a.tds_recovery_status, 'Pending')) as tds_status,
        COALESCE(a.tds_recovery_status, 'Pending') as tds_recovery_status,
        a.updated_at
      FROM invoices i
      JOIN accounts_ledger a ON i.id = a.invoice_id
      LEFT JOIN firms fm ON i.firm_id = fm.id
      LEFT JOIN voucher_types v ON a.voucher_id = v.id
      LEFT JOIN receiving_bank_accounts rb_tax ON a.taxable_bank_account_id = rb_tax.id
      LEFT JOIN receiving_bank_accounts rb_gst ON a.gst_account_id = rb_gst.id
      LEFT JOIN receiving_bank_accounts rb_tds ON a.tds_bank_account_id = rb_tds.id
      WHERE i.id = ?
    `).get(invoiceId);

    res.json({ message: 'Accounts ledger entry updated successfully', account: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update ledger' });
  }
});

export default router;

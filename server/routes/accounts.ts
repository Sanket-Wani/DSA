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
        i.firm_name_snapshot as firm_name,
        i.client_company_snapshot as trade_legal_name,
        i.client_company_snapshot as company_name,
        i.client_name_snapshot as client_name,
        i.client_gstin_snapshot as gst_no,
        i.firm_id,
        a.id as ledger_id,
        a.voucher_id,
        v.voucher_name,
        a.taxable_received_date,
        a.taxable_amount,
        a.taxable_bank_account_id,
        rb_tax.account_name as taxable_bank_account_name,
        a.gst_received_date,
        a.gst_amount,
        a.gst_account_id,
        rb_gst.account_name as gst_account_name,
        a.tds_amount,
        COALESCE(a.tds_recovery_status, 'Pending') as tds_recovery_status,
        a.updated_at
      FROM invoices i
      LEFT JOIN accounts_ledger a ON i.id = a.invoice_id
      LEFT JOIN voucher_types v ON a.voucher_id = v.id
      LEFT JOIN receiving_bank_accounts rb_tax ON a.taxable_bank_account_id = rb_tax.id
      LEFT JOIN receiving_bank_accounts rb_gst ON a.gst_account_id = rb_gst.id
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
    gst_received_date,
    gst_amount,
    gst_account_id,
    tds_amount,
    tds_recovery_status
  } = req.body;

  try {
    // 1. Verify invoice exists
    const invoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: `Invoice with ID "${invoiceId}" not found.` });
    }

    // 2. Validate voucher if provided
    if (voucher_id) {
      const v = db.prepare('SELECT id FROM voucher_types WHERE id = ?').get(Number(voucher_id));
      if (!v) {
        return res.status(400).json({ error: 'Selected Voucher type does not exist' });
      }
    }

    // 3. Validate bank accounts if provided
    if (taxable_bank_account_id) {
      const b = db.prepare('SELECT id FROM receiving_bank_accounts WHERE id = ?').get(Number(taxable_bank_account_id));
      if (!b) return res.status(400).json({ error: 'Selected Taxable Bank Account does not exist' });
    }
    if (gst_account_id) {
      const b = db.prepare('SELECT id FROM receiving_bank_accounts WHERE id = ?').get(Number(gst_account_id));
      if (!b) return res.status(400).json({ error: 'Selected GST Account does not exist' });
    }

    const now = new Date().toISOString();

    // Check if ledger row exists, if not insert, else update
    const existing = db.prepare('SELECT id FROM accounts_ledger WHERE invoice_id = ?').get(invoiceId);

    if (existing) {
      db.prepare(`
        UPDATE accounts_ledger SET
          voucher_id = ?,
          taxable_received_date = ?,
          taxable_amount = ?,
          taxable_bank_account_id = ?,
          gst_received_date = ?,
          gst_amount = ?,
          gst_account_id = ?,
          tds_amount = ?,
          tds_recovery_status = ?,
          updated_at = ?,
          updated_by = ?
        WHERE invoice_id = ?
      `).run(
        voucher_id ? Number(voucher_id) : null,
        taxable_received_date || null,
        taxable_amount !== undefined && taxable_amount !== null && taxable_amount !== '' ? Number(taxable_amount) : null,
        taxable_bank_account_id ? Number(taxable_bank_account_id) : null,
        gst_received_date || null,
        gst_amount !== undefined && gst_amount !== null && gst_amount !== '' ? Number(gst_amount) : null,
        gst_account_id ? Number(gst_account_id) : null,
        tds_amount !== undefined && tds_amount !== null && tds_amount !== '' ? Number(tds_amount) : null,
        tds_recovery_status || 'Pending',
        now,
        req.user?.id || null,
        invoiceId
      );
    } else {
      db.prepare(`
        INSERT INTO accounts_ledger (
          invoice_id, voucher_id,
          taxable_received_date, taxable_amount, taxable_bank_account_id,
          gst_received_date, gst_amount, gst_account_id,
          tds_amount, tds_recovery_status,
          updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        voucher_id ? Number(voucher_id) : null,
        taxable_received_date || null,
        taxable_amount !== undefined && taxable_amount !== null && taxable_amount !== '' ? Number(taxable_amount) : null,
        taxable_bank_account_id ? Number(taxable_bank_account_id) : null,
        gst_received_date || null,
        gst_amount !== undefined && gst_amount !== null && gst_amount !== '' ? Number(gst_amount) : null,
        gst_account_id ? Number(gst_account_id) : null,
        tds_amount !== undefined && tds_amount !== null && tds_amount !== '' ? Number(tds_amount) : null,
        tds_recovery_status || 'Pending',
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
        i.firm_name_snapshot as firm_name,
        i.client_company_snapshot as trade_legal_name,
        i.client_company_snapshot as company_name,
        i.client_name_snapshot as client_name,
        i.client_gstin_snapshot as gst_no,
        i.firm_id,
        a.id as ledger_id,
        a.voucher_id,
        v.voucher_name,
        a.taxable_received_date,
        a.taxable_amount,
        a.taxable_bank_account_id,
        rb_tax.account_name as taxable_bank_account_name,
        a.gst_received_date,
        a.gst_amount,
        a.gst_account_id,
        rb_gst.account_name as gst_account_name,
        a.tds_amount,
        a.tds_recovery_status,
        a.updated_at
      FROM invoices i
      JOIN accounts_ledger a ON i.id = a.invoice_id
      LEFT JOIN voucher_types v ON a.voucher_id = v.id
      LEFT JOIN receiving_bank_accounts rb_tax ON a.taxable_bank_account_id = rb_tax.id
      LEFT JOIN receiving_bank_accounts rb_gst ON a.gst_account_id = rb_gst.id
      WHERE i.id = ?
    `).get(invoiceId);

    res.json({ message: 'Accounts ledger entry updated successfully', account: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update ledger' });
  }
});

export default router;

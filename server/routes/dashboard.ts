import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/metrics', (_req, res) => {
  try {
    // 1. File Logged In: active files (status != 'Disburse')
    const fileRow = db.prepare("SELECT COUNT(*) as cnt FROM files WHERE status != 'Disburse'").get() as any;
    const fileLoggedInCount = fileRow?.cnt || 0;

    // 2. Disbursements: distinct files in Disburse status or with disbursements
    const disbRow = db.prepare(`
      SELECT COUNT(DISTINCT f.id) as cnt
      FROM files f
      LEFT JOIN disbursements d ON f.id = d.file_id
      WHERE f.status = 'Disburse' OR d.id IS NOT NULL
    `).get() as any;
    const disbursementsCount = disbRow?.cnt || 0;

    // 3. Accounts: pending and completed invoices
    const invoices = db.prepare(`
      SELECT 
        i.id,
        COALESCE(i.amount, 0) as taxable_total,
        COALESCE(i.cgst_amount + i.sgst_amount + i.igst_amount, 0) as total_gst,
        COALESCE(al.taxable_amount, 0) as entered_taxable,
        COALESCE(al.gst_amount, 0) as entered_gst,
        COALESCE(al.tds_amount, 0) as entered_tds,
        COALESCE(al.tds_section, '194J') as tds_section
      FROM invoices i
      LEFT JOIN accounts_ledger al ON i.id = al.invoice_id
    `).all() as any[];

    let pendingInvoicesCount = 0;
    let completedInvoicesCount = 0;

    for (const inv of invoices) {
      const taxableTotal = Number(inv.taxable_total || 0);
      const totalGst = Number(inv.total_gst || 0);
      const totalTds = inv.tds_section === '194H' ? taxableTotal * 0.10 : taxableTotal * 0.02;

      const enteredTaxable = Number(inv.entered_taxable || 0);
      const enteredGst = Number(inv.entered_gst || 0);
      const enteredTds = Number(inv.entered_tds || 0);

      const isTaxableComplete = enteredTaxable >= taxableTotal && taxableTotal > 0;
      const isGstComplete = enteredGst >= totalGst && totalGst > 0;
      const isTdsComplete = enteredTds >= totalTds && totalTds > 0;

      if (isTaxableComplete && isGstComplete && isTdsComplete) {
        completedInvoicesCount++;
      } else {
        pendingInvoicesCount++;
      }
    }

    res.json({
      fileLoggedInCount,
      disbursementsCount,
      pendingInvoicesCount,
      completedInvoicesCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch dashboard metrics' });
  }
});

export default router;


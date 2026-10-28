import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// 1. Lookup file for Disbursement Entry
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

    // Status check for disbursement eligibility
    const disbursableStatuses = ['Disburse', 'Sanction', 'Approved'];
    if (!disbursableStatuses.includes(file.status)) {
      return res.status(400).json({ 
        error: `File "${fileId}" is in status "${file.status}". Files must be in "Sanction" or "Disburse" status to receive disbursement entries.`,
        fileStatus: file.status 
      });
    }

    // Fetch existing saved disbursements for this file
    const existingDisbursements = db.prepare(`
      SELECT id, file_id, disbursement_amount, disbursement_date, created_at
      FROM disbursements
      WHERE file_id = ?
      ORDER BY disbursement_date ASC, id ASC
    `).all(fileId);

    const totalDisbursed = existingDisbursements.reduce((sum: number, d: any) => sum + Number(d.disbursement_amount), 0);

    res.json({
      file,
      existingDisbursements,
      totalDisbursed
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Save multiple disbursement rows for an approved file
router.post('/', (req, res) => {
  const { file_id, rows } = req.body;

  if (!file_id || typeof file_id !== 'string') {
    return res.status(400).json({ error: 'File ID is required' });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'At least one disbursement row must be provided' });
  }

  try {
    // 1. Verify file exists and is Approved
    const file = db.prepare('SELECT id, status, sanction_loan_amount FROM files WHERE id = ?').get(file_id.trim()) as any;
    if (!file) {
      return res.status(404).json({ error: `File ID "${file_id}" not found.` });
    }

    const disbursableStatuses = ['Disburse', 'Sanction', 'Approved'];
    if (!disbursableStatuses.includes(file.status)) {
      return res.status(400).json({ error: `Cannot save disbursements: File "${file_id}" is in status "${file.status}". Files must be in "Sanction" or "Disburse" status.` });
    }

    // 2. Validate all rows before inserting
    let newRowsSum = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const amount = Number(row.disbursement_amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: `Row ${i + 1}: Valid positive disbursement amount is required` });
      }
      if (!row.disbursement_date || !row.disbursement_date.trim()) {
        return res.status(400).json({ error: `Row ${i + 1}: Disbursement date is required` });
      }
      newRowsSum += amount;
    }

    // 3. Verify total disbursement does not exceed sanctioned loan amount
    const existing = db.prepare(`SELECT COALESCE(SUM(disbursement_amount), 0) as total FROM disbursements WHERE file_id = ?`).get(file_id.trim()) as any;
    const existingTotal = Number(existing?.total || 0);
    const totalAfterDisbursement = existingTotal + newRowsSum;
    const sanctionAmount = Number(file.sanction_loan_amount || 0);

    if (totalAfterDisbursement > sanctionAmount) {
      const excess = totalAfterDisbursement - sanctionAmount;
      const remaining = Math.max(0, sanctionAmount - existingTotal);
      return res.status(400).json({
        error: `Total disbursement amount (₹${totalAfterDisbursement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) exceeds the sanctioned loan amount (₹${sanctionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) by ₹${excess.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Maximum remaining allowable disbursement is ₹${remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
      });
    }

    const insertTransaction = db.transaction(() => {
      const insertStmt = db.prepare(`
        INSERT INTO disbursements (file_id, disbursement_amount, disbursement_date, created_at)
        VALUES (?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const insertedIds: number[] = [];

      for (const row of rows) {
        const info = insertStmt.run(
          file_id.trim(),
          Number(row.disbursement_amount),
          row.disbursement_date.trim(),
          now
        );
        insertedIds.push(Number(info.lastInsertRowid));
      }

      return insertedIds;
    });

    const newIds = insertTransaction();

    const allDisbursements = db.prepare(`
      SELECT id, file_id, disbursement_amount, disbursement_date, created_at
      FROM disbursements
      WHERE file_id = ?
      ORDER BY disbursement_date ASC, id ASC
    `).all(file_id.trim());

    res.status(201).json({
      message: `Successfully saved ${newIds.length} disbursement record(s)`,
      disbursements: allDisbursements
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save disbursements' });
  }
});

// 3. List disbursements register (both file-level summary and raw records)
router.get('/', (req, res) => {
  try {
    // Individual file records with total disbursements done till now
    const fileSummaryList = db.prepare(`
      SELECT 
        f.id as file_id,
        COALESCE(f.sanction_loan_amount, 0) as sanction_loan_amount,
        COALESCE(c.company_name, '') as company_name,
        COALESCE(c.client_name, '') as client_name,
        COALESCE(p.name, '') as product_name,
        COALESCE(p.acronym, '') as product_acronym,
        COALESCE(b.bank_name, '') as bank_name,
        COUNT(d.id) as disbursement_count,
        COALESCE(SUM(d.disbursement_amount), 0) as total_disbursed_amount,
        MAX(d.disbursement_date) as latest_disbursement_date,
        MAX(d.created_at) as latest_created_at
      FROM files f
      LEFT JOIN clients c ON f.client_id = c.id
      LEFT JOIN products p ON f.product_id = p.id
      LEFT JOIN banks b ON f.bank_id = b.id
      LEFT JOIN disbursements d ON f.id = d.file_id
      WHERE f.status = 'Disburse' OR d.id IS NOT NULL
      GROUP BY f.id
      ORDER BY 
        CASE WHEN MAX(d.disbursement_date) IS NOT NULL THEN MAX(d.disbursement_date) ELSE f.created_at END DESC
    `).all().map((r: any) => ({
      ...r,
      disbursement_count: Number(r.disbursement_count),
      total_disbursed_amount: Number(r.total_disbursed_amount),
      sanction_loan_amount: Number(r.sanction_loan_amount),
      remaining_amount: Math.max(0, Number(r.sanction_loan_amount) - Number(r.total_disbursed_amount))
    }));

    // Raw disbursements list (for backwards compatibility)
    const rawList = db.prepare(`
      SELECT 
        d.id,
        d.file_id,
        d.disbursement_amount,
        d.disbursement_date,
        d.created_at,
        COALESCE(c.company_name, '') as company_name,
        COALESCE(c.client_name, '') as client_name,
        COALESCE(p.name, '') as product_name,
        COALESCE(p.acronym, '') as product_acronym,
        COALESCE(b.bank_name, '') as bank_name
      FROM disbursements d
      LEFT JOIN files f ON d.file_id = f.id
      LEFT JOIN clients c ON f.client_id = c.id
      LEFT JOIN products p ON f.product_id = p.id
      LEFT JOIN banks b ON f.bank_id = b.id
      ORDER BY d.disbursement_date DESC, d.id DESC
      LIMIT 100
    `).all();

    res.json({ 
      fileDisbursements: fileSummaryList,
      disbursements: rawList 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

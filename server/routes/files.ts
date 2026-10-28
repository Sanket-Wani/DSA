import { Router } from 'express';
import { db } from '../db.js';
import { requireSuperadmin } from '../middleware/authMiddleware.js';

const router = Router();

export const VALID_FILE_STATUSES = [
  'WIP (Work in Progress)',
  'Document Pending',
  'IP Pending',
  'Valuation',
  'Legal',
  'Query',
  'Sanction',
  'Disbursement',
  'Rejected from Bank',
  'Cancelled',
  'Hold',
  'Qualification Issue (Rejected by Firm)'
];

// Helper to generate sequential File ID e.g. FL-2026-0001
function generateNextFileId(): string {
  const currentYear = new Date().getFullYear();
  const prefix = `FL-${currentYear}-`;

  const lastFile = db.prepare(
    "SELECT id FROM files WHERE id LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`${prefix}%`) as { id: string } | undefined;

  let nextSeq = 1;
  if (lastFile && lastFile.id) {
    const parts = lastFile.id.split('-');
    const lastNum = parseInt(parts[2], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// 1. List files with search, filtering, and pagination
router.get('/', (req, res) => {
  try {
    const { status, search, page = '1', limit = '10' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'All') {
      const statusArr = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (statusArr.length === 1) {
        conditions.push('f.status = ?');
        params.push(statusArr[0]);
      } else if (statusArr.length > 1) {
        conditions.push(`f.status IN (${statusArr.map(() => '?').join(', ')})`);
        params.push(...statusArr);
      }
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      conditions.push('(f.id LIKE ? OR c.company_name LIKE ? OR c.client_name LIKE ? OR c.gst_no LIKE ? OR p.name LIKE ? OR p.acronym LIKE ? OR b.bank_name LIKE ? OR s.name LIKE ? OR f.code LIKE ?)');
      params.push(term, term, term, term, term, term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM files f
      JOIN clients c ON f.client_id = c.id
      JOIN products p ON f.product_id = p.id
      JOIN banks b ON f.bank_id = b.id
      JOIN sales_members s ON f.sales_member_id = s.id
      ${whereClause}
    `;

    const totalCount = (db.prepare(countQuery).get(...params) as { total: number }).total;

    const dataQuery = `
      SELECT 
        f.id,
        f.login_date,
        f.code,
        f.source,
        f.bank_manager_name,
        f.sanction_loan_amount,
        f.status,
        f.created_at,
        f.reviewed_at,
        f.review_remarks,
        c.id as client_id,
        c.company_name,
        c.gst_no,
        c.client_name,
        c.client_email,
        c.client_phone,
        p.id as product_id,
        p.name as product_name,
        p.acronym as product_acronym,
        b.id as bank_id,
        b.bank_name,
        b.bank_gst_no,
        s.id as sales_member_id,
        s.name as sales_member_name,
        u_rev.full_name as reviewer_name
      FROM files f
      JOIN clients c ON f.client_id = c.id
      JOIN products p ON f.product_id = p.id
      JOIN banks b ON f.bank_id = b.id
      JOIN sales_members s ON f.sales_member_id = s.id
      LEFT JOIN users u_rev ON f.reviewed_by = u_rev.id
      ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const files = db.prepare(dataQuery).all(...params, limitNum, offset);

    res.json({
      files,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list files' });
  }
});

// 2. Eligible files for Superadmin Approval view
router.get('/eligible', requireSuperadmin, (req, res) => {
  try {
    const dataQuery = `
      SELECT 
        f.id,
        f.login_date,
        f.code,
        f.source,
        f.bank_manager_name,
        f.sanction_loan_amount,
        f.status,
        f.created_at,
        c.id as client_id,
        c.company_name,
        c.gst_no,
        c.client_name,
        c.client_email,
        c.client_phone,
        p.id as product_id,
        p.name as product_name,
        p.acronym as product_acronym,
        b.id as bank_id,
        b.bank_name,
        b.bank_gst_no,
        s.id as sales_member_id,
        s.name as sales_member_name
      FROM files f
      JOIN clients c ON f.client_id = c.id
      JOIN products p ON f.product_id = p.id
      JOIN banks b ON f.bank_id = b.id
      JOIN sales_members s ON f.sales_member_id = s.id
      WHERE f.status IN ('Sanction', 'Eligible')
      ORDER BY f.created_at ASC
    `;

    const eligibleFiles = db.prepare(dataQuery).all();
    res.json({ files: eligibleFiles });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load eligible files' });
  }
});

// 3. Retrieve single file by ID
router.get('/:id', (req, res) => {
  try {
    const file = db.prepare(`
      SELECT 
        f.*,
        c.company_name,
        c.gst_no,
        c.client_name,
        c.client_email,
        c.client_phone,
        p.name as product_name,
        p.acronym as product_acronym,
        b.bank_name,
        b.bank_gst_no,
        s.name as sales_member_name,
        u_rev.full_name as reviewer_name
      FROM files f
      JOIN clients c ON f.client_id = c.id
      JOIN products p ON f.product_id = p.id
      JOIN banks b ON f.bank_id = b.id
      JOIN sales_members s ON f.sales_member_id = s.id
      LEFT JOIN users u_rev ON f.reviewed_by = u_rev.id
      WHERE f.id = ?
    `).get(req.params.id) as any;

    if (!file) {
      return res.status(404).json({ error: `File ID "${req.params.id}" not found.` });
    }

    const banks = db.prepare(`
      SELECT fb.id, fb.bank_id, fb.bank_manager_name, fb.sanction_loan_amount, b.bank_name, b.bank_gst_no
      FROM file_banks fb
      JOIN banks b ON fb.bank_id = b.id
      WHERE fb.file_id = ?
    `).all(req.params.id) as any[];

    file.banks = banks.length > 0 ? banks : [{
      bank_id: file.bank_id,
      bank_name: file.bank_name,
      bank_manager_name: file.bank_manager_name,
      sanction_loan_amount: file.sanction_loan_amount
    }];

    res.json({ file });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create new File Logged-in
router.post('/', (req, res) => {
  const {
    company_name,
    gst_no,
    client_name,
    client_email,
    client_phone,
    product_id,
    bank_id,
    bank_manager_name,
    banks,
    sales_member_id,
    code,
    source,
    sanction_loan_amount,
    status = 'In Progress'
  } = req.body;

  // Validation
  const errors: string[] = [];
  if (!company_name?.trim()) errors.push("Client's Company name is required");
  if (!gst_no?.trim()) errors.push("Client's GST no. is required");
  if (!client_name?.trim()) errors.push("Client name is required");
  if (!client_email?.trim() || !client_email.includes('@')) errors.push("Valid client email ID is required");
  if (!product_id) errors.push("Product selection is required");
  if (!sales_member_id) errors.push("Office sales member selection is required");
  if (!code?.trim()) errors.push("Code is required");

  // Multi-bank resolution
  let banksList: Array<{ bank_id: number; bank_manager_name: string; sanction_loan_amount: number }> = [];
  if (Array.isArray(banks) && banks.length > 0) {
    banksList = banks.map((b: any) => ({
      bank_id: Number(b.bank_id),
      bank_manager_name: String(b.bank_manager_name || '').trim(),
      sanction_loan_amount: Number(b.sanction_loan_amount) || 0
    }));
    for (const [idx, b] of banksList.entries()) {
      if (!b.bank_id) errors.push(`Bank ${idx + 1} selection is required`);
      if (!b.bank_manager_name) errors.push(`Bank ${idx + 1} manager name is required`);
      if (b.sanction_loan_amount <= 0) errors.push(`Bank ${idx + 1} sanction amount must be positive`);
    }
  } else {
    if (!bank_id) errors.push("Bank selection is required");
    if (!bank_manager_name?.trim()) errors.push("Bank manager/Consultant name is required");
    if (sanction_loan_amount === undefined || isNaN(Number(sanction_loan_amount)) || Number(sanction_loan_amount) <= 0) {
      errors.push("Valid positive Sanction Loan Amount is required");
    }
    banksList = [{
      bank_id: Number(bank_id),
      bank_manager_name: String(bank_manager_name || '').trim(),
      sanction_loan_amount: Number(sanction_loan_amount)
    }];
  }

  // Status validation
  const finalStatus = status || 'WIP (Work in Progress)';
  if (!VALID_FILE_STATUSES.includes(finalStatus) && finalStatus !== 'In Progress' && finalStatus !== 'Eligible') {
    errors.push(`Invalid file status "${finalStatus}"`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors, error: errors.join(', ') });
  }

  try {
    const fileId = generateNextFileId();
    const loginDate = new Date().toISOString();
    const primaryBankId = banksList[0].bank_id;
    const primaryManager = banksList[0].bank_manager_name;
    const totalSanction = banksList.reduce((sum, b) => sum + b.sanction_loan_amount, 0);

    const insertTransaction = db.transaction(() => {
      // 1. Find or create client
      let clientId: number;
      const existingClient = db.prepare('SELECT id FROM clients WHERE LOWER(company_name) = LOWER(?)').get(company_name.trim()) as { id: number } | undefined;
      
      if (existingClient) {
        clientId = existingClient.id;
        db.prepare('UPDATE clients SET gst_no = ?, client_name = ?, client_email = ?, client_phone = ? WHERE id = ?').run(
          gst_no.trim(),
          client_name.trim(),
          client_email.trim(),
          client_phone ? client_phone.trim() : null,
          clientId
        );
      } else {
        const cInfo = db.prepare('INSERT INTO clients (company_name, gst_no, client_name, client_email, client_phone, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
          company_name.trim(),
          gst_no.trim(),
          client_name.trim(),
          client_email.trim(),
          client_phone ? client_phone.trim() : null,
          loginDate
        );
        clientId = Number(cInfo.lastInsertRowid);
      }

      // 2. Verify selected bank exists
      const bank = db.prepare('SELECT id FROM banks WHERE id = ?').get(primaryBankId);
      if (!bank) {
        throw new Error('Selected Bank does not exist in master data');
      }

      // 3. Verify product
      const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
      if (!product) {
        throw new Error('Selected Product does not exist');
      }

      // 4. Verify sales member
      const salesMember = db.prepare('SELECT id FROM sales_members WHERE id = ?').get(sales_member_id);
      if (!salesMember) {
        throw new Error('Selected Sales Member does not exist');
      }

      // 5. Insert canonical File record
      db.prepare(`
        INSERT INTO files (
          id, login_date, client_id, bank_id, product_id, sales_member_id,
          bank_manager_name, code, source, sanction_loan_amount, status,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        loginDate,
        clientId,
        primaryBankId,
        product_id,
        sales_member_id,
        primaryManager,
        code.trim(),
        source ? source.trim() : null,
        totalSanction,
        status,
        req.user?.id || null,
        loginDate
      );

      // 6. Insert file_banks
      const insertFb = db.prepare(`
        INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const b of banksList) {
        insertFb.run(fileId, b.bank_id, b.bank_manager_name, b.sanction_loan_amount, loginDate);
      }

      return fileId;
    });

    const createdFileId = insertTransaction();

    const newRecord = db.prepare(`
      SELECT 
        f.*,
        c.company_name,
        c.gst_no,
        c.client_name,
        c.client_email,
        p.name as product_name,
        p.acronym as product_acronym,
        b.bank_name,
        b.bank_gst_no,
        s.name as sales_member_name
      FROM files f
      JOIN clients c ON f.client_id = c.id
      JOIN products p ON f.product_id = p.id
      JOIN banks b ON f.bank_id = b.id
      JOIN sales_members s ON f.sales_member_id = s.id
      WHERE f.id = ?
    `).get(createdFileId) as any;

    newRecord.banks = db.prepare(`
      SELECT fb.id, fb.bank_id, fb.bank_manager_name, fb.sanction_loan_amount, b.bank_name, b.bank_gst_no
      FROM file_banks fb
      JOIN banks b ON fb.bank_id = b.id
      WHERE fb.file_id = ?
    `).all(createdFileId);

    res.status(201).json({ file: newRecord });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create file' });
  }
});

// 5. Update / Edit existing File record
router.put('/:id', (req, res) => {
  const fileId = req.params.id;
  try {
    const existingFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any;
    if (!existingFile) {
      return res.status(404).json({ error: `File ID "${fileId}" not found.` });
    }

    const {
      company_name,
      gst_no,
      client_name,
      client_email,
      client_phone,
      product_id,
      sales_member_id,
      code,
      source,
      status,
      banks,
      bank_id,
      bank_manager_name,
      sanction_loan_amount
    } = req.body;

    const errors: string[] = [];
    if (!company_name?.trim()) errors.push("Client's Company name is required");
    if (!gst_no?.trim()) errors.push("Client's GST no. is required");
    if (!client_name?.trim()) errors.push("Client name is required");
    if (!client_email?.trim() || !client_email.includes('@')) errors.push("Valid client email ID is required");
    if (!product_id) errors.push("Product selection is required");
    if (!sales_member_id) errors.push("Office sales member selection is required");
    if (!code?.trim()) errors.push("Code is required");

    let banksList: Array<{ bank_id: number; bank_manager_name: string; sanction_loan_amount: number }> = [];
    if (Array.isArray(banks) && banks.length > 0) {
      banksList = banks.map((b: any) => ({
        bank_id: Number(b.bank_id),
        bank_manager_name: String(b.bank_manager_name || '').trim(),
        sanction_loan_amount: Number(b.sanction_loan_amount) || 0
      }));
      for (const [idx, b] of banksList.entries()) {
        if (!b.bank_id) errors.push(`Bank ${idx + 1} selection is required`);
        if (!b.bank_manager_name) errors.push(`Bank ${idx + 1} manager name is required`);
        if (b.sanction_loan_amount <= 0) errors.push(`Bank ${idx + 1} sanction amount must be positive`);
      }
    } else {
      if (!bank_id) errors.push("Bank selection is required");
      if (!bank_manager_name?.trim()) errors.push("Bank manager name is required");
      if (!sanction_loan_amount || Number(sanction_loan_amount) <= 0) {
        errors.push("Valid positive Sanction Loan Amount is required");
      }
      banksList = [{
        bank_id: Number(bank_id),
        bank_manager_name: String(bank_manager_name || '').trim(),
        sanction_loan_amount: Number(sanction_loan_amount)
      }];
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors, error: errors.join(', ') });
    }

    const totalSanction = banksList.reduce((sum, b) => sum + b.sanction_loan_amount, 0);
    const primaryBankId = banksList[0].bank_id;
    const primaryManager = banksList[0].bank_manager_name;
    const updatedStatus = status || existingFile.status;
    if (!VALID_FILE_STATUSES.includes(updatedStatus) && updatedStatus !== 'In Progress' && updatedStatus !== 'Eligible') {
      errors.push(`Invalid file status "${updatedStatus}"`);
    }
    const now = new Date().toISOString();

    const updateTx = db.transaction(() => {
      // 1. Update client details
      db.prepare(`
        UPDATE clients 
        SET company_name = ?, gst_no = ?, client_name = ?, client_email = ?, client_phone = ?
        WHERE id = ?
      `).run(
        company_name.trim(),
        gst_no.trim(),
        client_name.trim(),
        client_email.trim(),
        client_phone ? client_phone.trim() : null,
        existingFile.client_id
      );

      // 2. Update file record
      db.prepare(`
        UPDATE files
        SET product_id = ?, sales_member_id = ?, code = ?, source = ?,
            bank_id = ?, bank_manager_name = ?, sanction_loan_amount = ?, status = ?
        WHERE id = ?
      `).run(
        Number(product_id),
        Number(sales_member_id),
        code.trim(),
        source ? source.trim() : null,
        primaryBankId,
        primaryManager,
        totalSanction,
        updatedStatus,
        fileId
      );

      // 3. Replace file_banks
      db.prepare('DELETE FROM file_banks WHERE file_id = ?').run(fileId);
      const insertFb = db.prepare(`
        INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const b of banksList) {
        insertFb.run(fileId, b.bank_id, b.bank_manager_name, b.sanction_loan_amount, now);
      }
    });

    updateTx();

    const updated = db.prepare(`
      SELECT 
        f.*,
        c.company_name,
        c.gst_no,
        c.client_name,
        c.client_email,
        p.name as product_name,
        p.acronym as product_acronym,
        b.bank_name,
        b.bank_gst_no,
        s.name as sales_member_name,
        u_rev.full_name as reviewer_name
      FROM files f
      JOIN clients c ON f.client_id = c.id
      JOIN products p ON f.product_id = p.id
      JOIN banks b ON f.bank_id = b.id
      JOIN sales_members s ON f.sales_member_id = s.id
      LEFT JOIN users u_rev ON f.reviewed_by = u_rev.id
      WHERE f.id = ?
    `).get(fileId) as any;

    updated.banks = db.prepare(`
      SELECT fb.id, fb.bank_id, fb.bank_manager_name, fb.sanction_loan_amount, b.bank_name, b.bank_gst_no
      FROM file_banks fb
      JOIN banks b ON fb.bank_id = b.id
      WHERE fb.file_id = ?
    `).all(fileId);

    res.json({ message: `File "${fileId}" updated successfully`, file: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update file' });
  }
});

// 6. Delete File record
router.delete('/:id', (req, res) => {
  const fileId = req.params.id;
  try {
    const file = db.prepare('SELECT id FROM files WHERE id = ?').get(fileId);
    if (!file) {
      return res.status(404).json({ error: `File ID "${fileId}" not found.` });
    }

    const deleteTx = db.transaction(() => {
      // 1. Delete associated accounts ledger entries for this file's invoices
      const invoices = db.prepare('SELECT id FROM invoices WHERE file_id = ?').all(fileId) as Array<{ id: string }>;
      for (const inv of invoices) {
        db.prepare('DELETE FROM accounts_ledger WHERE invoice_id = ?').run(inv.id);
      }
      // 2. Delete invoices
      db.prepare('DELETE FROM invoices WHERE file_id = ?').run(fileId);
      // 3. Delete disbursements
      db.prepare('DELETE FROM disbursements WHERE file_id = ?').run(fileId);
      // 4. Delete bank allocations
      db.prepare('DELETE FROM file_banks WHERE file_id = ?').run(fileId);
      // 5. Delete file record
      db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
    });

    deleteTx();

    res.json({ success: true, message: `File "${fileId}" and all associated records have been deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete file' });
  }
});

// 5. Superadmin Approve File
router.post('/:id/approve', requireSuperadmin, (req, res) => {
  const fileId = req.params.id;
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any;
    if (!file) {
      return res.status(404).json({ error: `File ID "${fileId}" not found.` });
    }

    if (file.status === 'Disbursement' || file.status === 'Approved') {
      return res.status(400).json({ error: `File "${fileId}" is already approved for disbursement.` });
    }

    const reviewedAt = new Date().toISOString();
    db.prepare(`
      UPDATE files 
      SET status = 'Disbursement', reviewed_by = ?, reviewed_at = ?, review_remarks = ?
      WHERE id = ?
    `).run(
      req.user!.id,
      reviewedAt,
      req.body.remarks ? req.body.remarks.trim() : 'Approved for disbursement by Superadmin',
      fileId
    );

    const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    res.json({ message: `File "${fileId}" approved successfully`, file: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Superadmin Reject File
router.post('/:id/reject', requireSuperadmin, (req, res) => {
  const fileId = req.params.id;
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any;
    if (!file) {
      return res.status(404).json({ error: `File ID "${fileId}" not found.` });
    }

    const reviewedAt = new Date().toISOString();
    db.prepare(`
      UPDATE files 
      SET status = 'Qualification Issue (Rejected by Firm)', reviewed_by = ?, reviewed_at = ?, review_remarks = ?
      WHERE id = ?
    `).run(
      req.user!.id,
      reviewedAt,
      req.body.remarks ? req.body.remarks.trim() : 'Rejected by Superadmin',
      fileId
    );

    const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    res.json({ message: `File "${fileId}" rejected`, file: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

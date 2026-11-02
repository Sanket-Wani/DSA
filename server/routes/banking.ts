import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { db } from '../db.js';
import {
  processStatementUpload,
  getAccountTransactions,
  updateTransactionRemarks,
  cancelPendingStatement
} from '../services/bankStatementService.js';

const router = Router();

// Setup temporary upload storage
const tempUploadDir = path.resolve(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `stmt_${Date.now()}_${randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF bank statements are supported.'));
    }
  }
});

// GET /api/banking/account-holders
router.get('/account-holders', (_req, res) => {
  try {
    const holders = db.prepare(`
      SELECT id, name, created_at
      FROM banking_account_holders
      ORDER BY name COLLATE NOCASE ASC
    `).all() as any[];
    res.json({ accountHolders: holders });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch account holders' });
  }
});

// POST /api/banking/account-holders
router.post('/account-holders', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Account Holder Name is required.' });
    }
    const cleanName = name.trim();
    const now = new Date().toISOString();

    let existing = db.prepare('SELECT id, name, created_at FROM banking_account_holders WHERE LOWER(name) = LOWER(?)').get(cleanName) as any;
    if (!existing) {
      const ins = db.prepare('INSERT INTO banking_account_holders (name, created_at) VALUES (?, ?)').run(cleanName, now);
      existing = { id: Number(ins.lastInsertRowid), name: cleanName, created_at: now };
    }
    res.status(201).json({ accountHolder: existing, message: 'Account holder created successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create account holder' });
  }
});

// GET /api/banking/accounts
router.get('/accounts', (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, bank_name, branch, account_type, ifsc_code, account_number, account_holder_name, monthly_statuses, created_at
      FROM banking_accounts
      ORDER BY id ASC
    `).all() as any[];

    const formattedAccounts = accounts.map(a => {
      let statuses = undefined;
      if (a.monthly_statuses) {
        try {
          statuses = JSON.parse(a.monthly_statuses);
        } catch {
          statuses = undefined;
        }
      }
      return {
        ...a,
        monthly_statuses: statuses
      };
    });

    res.json({ accounts: formattedAccounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch banking accounts' });
  }
});

// POST /api/banking/accounts
router.post('/accounts', (req, res) => {
  try {
    const {
      bank_name,
      branch,
      account_type,
      ifsc_code,
      account_number,
      account_holder_name
    } = req.body;

    // Field validations
    if (!bank_name || typeof bank_name !== 'string' || !bank_name.trim()) {
      return res.status(400).json({ error: 'Bank Name is required.' });
    }

    if (!branch || typeof branch !== 'string' || !branch.trim()) {
      return res.status(400).json({ error: 'Bank Branch is required.' });
    }

    if (!account_type || !['CA', 'Saving'].includes(account_type)) {
      return res.status(400).json({ error: 'Account Type must be CA (Current Account) or Saving (Savings Account).' });
    }

    if (!ifsc_code || typeof ifsc_code !== 'string' || !ifsc_code.trim()) {
      return res.status(400).json({ error: 'IFSC Code is required.' });
    }

    const cleanIfsc = ifsc_code.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      return res.status(400).json({ error: 'Invalid IFSC Code format. Must be 11 characters (e.g. HDFC0000240).' });
    }

    if (!account_number || typeof account_number !== 'string' || !account_number.trim()) {
      return res.status(400).json({ error: 'Account Number is required.' });
    }

    const cleanAccNo = account_number.trim();
    if (!/^[0-9A-Za-z]{6,25}$/.test(cleanAccNo)) {
      return res.status(400).json({ error: 'Account Number must contain between 6 and 25 alphanumeric characters.' });
    }

    if (!account_holder_name || typeof account_holder_name !== 'string' || !account_holder_name.trim()) {
      return res.status(400).json({ error: 'Account Holder Name is required.' });
    }

    // Check duplicate account
    const existing = db.prepare(`
      SELECT id FROM banking_accounts
      WHERE account_number = ? AND ifsc_code = ?
    `).get(cleanAccNo, cleanIfsc);

    if (existing) {
      return res.status(400).json({ error: 'A bank account with this Account Number and IFSC Code already exists.' });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO banking_accounts (
        bank_name,
        branch,
        account_type,
        ifsc_code,
        account_number,
        account_holder_name,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      bank_name.trim(),
      branch.trim(),
      account_type,
      cleanIfsc,
      cleanAccNo,
      account_holder_name.trim(),
      now
    );

    // Ensure account holder is present in shared master list
    db.prepare(`
      INSERT OR IGNORE INTO banking_account_holders (name, created_at) VALUES (?, ?)
    `).run(account_holder_name.trim(), now);

    const createdAccount = db.prepare(`
      SELECT id, bank_name, branch, account_type, ifsc_code, account_number, account_holder_name, monthly_statuses, created_at
      FROM banking_accounts
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      account: createdAccount,
      message: 'Bank account added successfully.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save bank account' });
  }
});

// POST /api/banking/accounts/:id/upload-statement
router.post('/accounts/:id/upload-statement', upload.single('statement'), async (req, res) => {
  const accountId = parseInt(req.params.id, 10);
  if (isNaN(accountId)) {
    return res.status(400).json({ error: 'Invalid account ID.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No statement PDF file uploaded.' });
  }

  const skipDuplicates = req.query.skip_duplicates === 'true' || req.body.skip_duplicates === 'true' || req.body.skip_duplicates === true;

  try {
    const result = await processStatementUpload(
      accountId,
      req.file.path,
      req.file.originalname,
      skipDuplicates
    );

    if (result.status === 'gap_detected') {
      return res.status(422).json(result);
    }

    if (result.status === 'duplicates_detected') {
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (err: any) {
    // Clean up temp file on failure
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    res.status(400).json({ error: err.message || 'Failed to process bank statement.' });
  }
});

// GET /api/banking/accounts/:id/transactions
router.get('/accounts/:id/transactions', (req, res) => {
  const accountId = parseInt(req.params.id, 10);
  if (isNaN(accountId)) {
    return res.status(400).json({ error: 'Invalid account ID.' });
  }

  try {
    const transactions = getAccountTransactions(accountId);
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch transactions.' });
  }
});

// PUT /api/banking/transactions/:id/remarks
router.put('/transactions/:id/remarks', (req, res) => {
  const transactionId = parseInt(req.params.id, 10);
  if (isNaN(transactionId)) {
    return res.status(400).json({ error: 'Invalid transaction ID.' });
  }

  const { remarks } = req.body;
  if (typeof remarks !== 'string') {
    return res.status(400).json({ error: 'Remarks must be a string.' });
  }

  try {
    const success = updateTransactionRemarks(transactionId, remarks);
    if (!success) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    res.json({ success: true, message: 'Remarks saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save remarks.' });
  }
});

// GET /api/banking/accounts/:id/pending-statement
router.get('/accounts/:id/pending-statement', (req, res) => {
  const accountId = parseInt(req.params.id, 10);
  if (isNaN(accountId)) {
    return res.status(400).json({ error: 'Invalid account ID.' });
  }

  try {
    const pending = db.prepare(`
      SELECT id, account_id, original_filename, from_date, to_date,
             opening_balance_paise, closing_balance_paise, gap_details_json, created_at
      FROM banking_pending_statements
      WHERE account_id = ? AND status = 'pending_gap'
      ORDER BY id DESC LIMIT 1
    `).get(accountId) as any;

    if (!pending) {
      return res.json({ pending: null });
    }

    let gapDetails = null;
    try {
      gapDetails = JSON.parse(pending.gap_details_json);
    } catch {}

    res.json({
      pending: {
        ...pending,
        gap_details: gapDetails
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch pending statement.' });
  }
});

// DELETE /api/banking/accounts/:id/pending-statement
router.delete('/accounts/:id/pending-statement', (req, res) => {
  const accountId = parseInt(req.params.id, 10);
  if (isNaN(accountId)) {
    return res.status(400).json({ error: 'Invalid account ID.' });
  }

  try {
    const success = cancelPendingStatement(accountId);
    res.json({ success: true, message: 'Pending statement cancelled successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel pending statement.' });
  }
});

export default router;

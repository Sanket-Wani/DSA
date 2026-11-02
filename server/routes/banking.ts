import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

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

export default router;


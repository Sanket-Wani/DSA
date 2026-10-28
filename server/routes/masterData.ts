import { Router } from 'express';
import { db } from '../db.js';
import { calculateGst } from '../services/taxService.js';

const router = Router();

const CANONICAL_PRODUCT_ACRONYMS: Record<string, string> = {
  'business loan': 'BL',
  'construction finance': 'CF',
  'consumer loan': 'CL',
  'commercial purchase': 'CP',
  'car refinance': 'CRF',
  'housing loan': 'HL',
  'home loan': 'HL',
  'industrial purchase': 'IP',
  'loan against property': 'LAP',
  'land purchase': 'LP',
  'lease rental discounting': 'LRD',
  'machinery loan': 'ML',
  'overdraft': 'OD',
  'plot purchase': 'PP',
  'term loan': 'TL',
  'working capital term loan': 'WCTL',
  'unsold inventory finance': 'UDF',
  'used car loan': 'URL'
};

// Centralized Acronym Generator
export function generateProductAcronym(name: string): string {
  if (!name || !name.trim()) return '';
  const key = name.trim().toLowerCase();
  if (CANONICAL_PRODUCT_ACRONYMS[key]) {
    return CANONICAL_PRODUCT_ACRONYMS[key];
  }

  const stopWords = new Set(['and', '&', 'of', 'in', 'the', 'for', 'to', 'a', 'an']);
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 1) {
    return words[0].substring(0, Math.min(4, words[0].length)).toUpperCase();
  }

  const acronym = words
    .filter(w => !stopWords.has(w.toLowerCase()))
    .map(w => w[0].toUpperCase())
    .join('');

  return acronym || words.map(w => w[0].toUpperCase()).join('');
}

// --- Products ---
router.get('/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
  res.json({ products });
});

router.post('/products', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  const trimmedName = name.trim();
  const acronym = generateProductAcronym(trimmedName);

  try {
    const existing = db.prepare('SELECT * FROM products WHERE LOWER(name) = LOWER(?)').get(trimmedName);
    if (existing) {
      return res.status(400).json({ error: `Product "${trimmedName}" already exists with acronym ${existing.acronym}` });
    }

    const info = db.prepare('INSERT INTO products (name, acronym, created_at) VALUES (?, ?, ?)').run(
      trimmedName,
      acronym,
      new Date().toISOString()
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ product });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create product' });
  }
});

// --- Sales Members ---
router.get('/sales-members', (req, res) => {
  const salesMembers = db.prepare('SELECT * FROM sales_members ORDER BY name ASC').all();
  res.json({ salesMembers });
});

router.post('/sales-members', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Sales member name is required' });
  }

  const trimmedName = name.trim();
  try {
    const existing = db.prepare('SELECT * FROM sales_members WHERE LOWER(name) = LOWER(?)').get(trimmedName);
    if (existing) {
      return res.status(400).json({ error: `Sales member "${trimmedName}" already exists` });
    }

    const info = db.prepare('INSERT INTO sales_members (name, created_at) VALUES (?, ?)').run(
      trimmedName,
      new Date().toISOString()
    );

    const salesMember = db.prepare('SELECT * FROM sales_members WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ salesMember });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create sales member' });
  }
});

// --- All Banks ---
router.get('/banks', (req, res) => {
  try {
    const banks = db.prepare(`
      SELECT id, bank_name, bank_gst_no 
      FROM banks 
      GROUP BY bank_name 
      ORDER BY bank_name ASC
    `).all();
    res.json({ banks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/banks', (req, res) => {
  const { bank_name, bank_gst_no, client_id } = req.body;
  if (!bank_name || typeof bank_name !== 'string' || !bank_name.trim()) {
    return res.status(400).json({ error: 'Bank name is required' });
  }
  const resolvedClientId = client_id ? Number(client_id) : 1;
  const gstNo = bank_gst_no?.trim() || '27AAACA0000A1Z5';

  try {
    const info = db.prepare('INSERT INTO banks (client_id, bank_name, bank_gst_no, created_at) VALUES (?, ?, ?, ?)').run(
      resolvedClientId,
      bank_name.trim(),
      gstNo,
      new Date().toISOString()
    );
    const bank = db.prepare('SELECT * FROM banks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ bank });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Banks (Associated with Client) ---
router.get('/clients/:clientId/banks', (req, res) => {
  const clientId = parseInt(req.params.clientId, 10);
  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  const banks = db.prepare('SELECT * FROM banks WHERE client_id = ? ORDER BY bank_name ASC').all(clientId);
  res.json({ banks });
});

router.post('/clients/:clientId/banks', (req, res) => {
  const clientId = parseInt(req.params.clientId, 10);
  const { bank_name, bank_gst_no } = req.body;

  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  if (!bank_name || typeof bank_name !== 'string' || !bank_name.trim()) {
    return res.status(400).json({ error: 'Bank name is required' });
  }
  if (!bank_gst_no || typeof bank_gst_no !== 'string' || !bank_gst_no.trim()) {
    return res.status(400).json({ error: 'Bank GST number is required' });
  }

  try {
    const info = db.prepare('INSERT INTO banks (client_id, bank_name, bank_gst_no, created_at) VALUES (?, ?, ?, ?)').run(
      clientId,
      bank_name.trim(),
      bank_gst_no.trim(),
      new Date().toISOString()
    );

    const bank = db.prepare('SELECT * FROM banks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ bank });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to add bank' });
  }
});

// --- Firms ---
router.get('/firms', (req, res) => {
  const firms = db.prepare('SELECT * FROM firms WHERE is_active = 1 ORDER BY firm_name ASC').all();
  res.json({ firms });
});

// --- Voucher Types ---
router.get('/voucher-types', (req, res) => {
  const voucherTypes = db.prepare('SELECT * FROM voucher_types ORDER BY voucher_name ASC').all();
  res.json({ voucherTypes });
});

// --- Receiving Bank Accounts (For Firm collections) ---
router.get('/receiving-accounts', (req, res) => {
  const accounts = db.prepare('SELECT * FROM receiving_bank_accounts ORDER BY account_name ASC').all();
  res.json({ accounts });
});

// --- Tax Rates ---
router.get('/tax-rates', (req, res) => {
  const taxRates = db.prepare('SELECT * FROM tax_rates ORDER BY sac_code ASC').all();
  res.json({ taxRates });
});

router.post('/tax-rates/calculate', (req, res) => {
  try {
    const { amount, sac, firm_id, client_gstin } = req.body;
    if (amount === undefined || !sac || !firm_id) {
      return res.status(400).json({ error: 'Amount, SAC code, and Firm ID are required for calculation' });
    }
    const calculation = calculateGst(Number(amount), String(sac), Number(firm_id), String(client_gstin || ''));
    res.json({ calculation });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

-- Relational Database Schema for DSA Management Software

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Superadmin', 'Team')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS firms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_name TEXT NOT NULL,
  gstin TEXT NOT NULL,
  state TEXT NOT NULL,
  state_code TEXT NOT NULL,
  address TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  bank_name TEXT,
  account_name TEXT,
  account_no TEXT,
  ifsc_code TEXT,
  branch TEXT
);

CREATE TABLE IF NOT EXISTS receiving_bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS voucher_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS tax_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sac_code TEXT UNIQUE NOT NULL,
  gst_rate REAL NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  gst_no TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS banks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  bank_gst_no TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  acronym TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  login_date TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  bank_id INTEGER NOT NULL REFERENCES banks(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  sales_member_id INTEGER NOT NULL REFERENCES sales_members(id),
  bank_manager_name TEXT NOT NULL,
  code TEXT NOT NULL,
  source TEXT,
  sanction_loan_amount REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN (
    'WIP (Work in Progress)',
    'Document Pending',
    'IP Pending',
    'Valuation',
    'Legal',
    'Query',
    'Sanction',
    'Disburse',
    'Disbursement',
    'Rejected from Bank',
    'Cancelled',
    'Hold',
    'Qualification Issue (Rejected by Firm)'
  )) DEFAULT 'WIP (Work in Progress)',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  review_remarks TEXT,
  firm_id INTEGER REFERENCES firms(id) DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_client ON files(client_id);

CREATE TABLE IF NOT EXISTS file_banks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  bank_id INTEGER NOT NULL REFERENCES banks(id),
  bank_manager_name TEXT NOT NULL,
  sanction_loan_amount REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_file_banks_file ON file_banks(file_id);

CREATE TABLE IF NOT EXISTS disbursements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  disbursement_amount REAL NOT NULL,
  disbursement_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disbursements_file ON disbursements(file_id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  file_id TEXT NOT NULL REFERENCES files(id),
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  invoice_date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  loan_account_no TEXT NOT NULL,
  mcf_no TEXT NOT NULL,
  disbursement_amount REAL NOT NULL,
  sac TEXT NOT NULL,
  amount REAL NOT NULL,
  cgst_rate REAL NOT NULL DEFAULT 0,
  cgst_amount REAL NOT NULL DEFAULT 0,
  sgst_rate REAL NOT NULL DEFAULT 0,
  sgst_amount REAL NOT NULL DEFAULT 0,
  igst_rate REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  firm_name_snapshot TEXT NOT NULL,
  firm_gstin_snapshot TEXT NOT NULL,
  firm_address_snapshot TEXT NOT NULL,
  client_company_snapshot TEXT NOT NULL,
  client_name_snapshot TEXT NOT NULL,
  client_email_snapshot TEXT NOT NULL,
  client_gstin_snapshot TEXT NOT NULL,
  bank_name_snapshot TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_file ON invoices(file_id);
CREATE INDEX IF NOT EXISTS idx_invoices_firm_period ON invoices(firm_id, year, month);

CREATE TABLE IF NOT EXISTS accounts_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT UNIQUE NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  voucher_id INTEGER REFERENCES voucher_types(id),
  taxable_received_date TEXT,
  taxable_amount REAL,
  taxable_bank_account_id INTEGER REFERENCES receiving_bank_accounts(id),
  gst_received_date TEXT,
  gst_amount REAL,
  gst_account_id INTEGER REFERENCES receiving_bank_accounts(id),
  tds_amount REAL,
  tds_recovery_status TEXT CHECK(tds_recovery_status IN ('Pending', 'Recovered', 'Claimed in Return', 'Written Off')) DEFAULT 'Pending',
  updated_at TEXT,
  updated_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_invoice ON accounts_ledger(invoice_id);

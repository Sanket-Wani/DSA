import { db } from './db.js';

export function runSeed() {
  console.log('[Seed] Seeding initial master data...');

  const now = new Date().toISOString();

  // 1. Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      is_active = excluded.is_active
  `);

  insertUser.run(1, 'admin@vinayakassociates.in', 'sha256_mock_hash', 'System Superadmin', 'Superadmin', 1, '2026-10-27T00:00:00.000Z');
  insertUser.run(2, 'priya@vinayakassociates.in', 'sha256_mock_hash', 'Priya Nair', 'Team', 1, '2026-10-27T00:00:00.000Z');
  insertUser.run(3, 'rohan@vinayakassociates.in', 'sha256_mock_hash', 'Rohan Verma', 'Team', 1, '2026-10-27T00:00:00.000Z');
  insertUser.run(4, 'team.test@vinayakassociates.in', 'sha256_mock_hash', 'Rohan Verma', 'Team', 1, '2026-10-27T00:00:00.000Z');

  // Update any existing users with non-vinayakassociates.in email domains
  db.prepare(`
    UPDATE users 
    SET email = CASE 
      WHEN INSTR(email, '@') > 0 THEN SUBSTR(email, 1, INSTR(email, '@') - 1) || '@vinayakassociates.in'
      ELSE email || '@vinayakassociates.in'
    END
    WHERE email NOT LIKE '%@vinayakassociates.in'
  `).run();

  // 2. Firms
  const unifiedOfficeAddress = 'Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005';

  const insertFirm = db.prepare(`
    INSERT INTO firms (id, firm_name, gstin, state, state_code, address, is_active, bank_name, account_name, account_no, ifsc_code, branch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      firm_name = excluded.firm_name,
      gstin = excluded.gstin,
      state = excluded.state,
      state_code = excluded.state_code,
      address = excluded.address,
      is_active = excluded.is_active,
      bank_name = excluded.bank_name,
      account_name = excluded.account_name,
      account_no = excluded.account_no,
      ifsc_code = excluded.ifsc_code,
      branch = excluded.branch
  `);

  insertFirm.run(
    1,
    'Mavin Credits',
    '27AAUCM0275A1ZH',
    'Maharashtra',
    '27',
    unifiedOfficeAddress,
    1,
    'HDFC Bank',
    'Mavin Credit Consultant Private Limited',
    '50200012345678',
    'HDFC0000240',
    'Shivajinagar, Pune'
  );
  insertFirm.run(
    2,
    'Vinayak Associates',
    '27AABCV5544K1Z8',
    'Maharashtra',
    '27',
    unifiedOfficeAddress,
    1,
    'ICICI Bank',
    'Vinayak Associates',
    '000405001234',
    'ICIC0000004',
    'Shivajinagar, Pune'
  );

  // Remove any legacy firms
  db.prepare('DELETE FROM firms WHERE id NOT IN (1, 2)').run();

  // Update existing invoice snapshots for consistency
  db.prepare(`
    UPDATE invoices 
    SET firm_name_snapshot = 'Mavin Credits',
        firm_gstin_snapshot = '27AAUCM0275A1ZH',
        firm_address_snapshot = ?
    WHERE firm_id = 1 OR firm_name_snapshot LIKE '%Apex%'
  `).run(unifiedOfficeAddress);

  db.prepare(`
    UPDATE invoices 
    SET firm_name_snapshot = 'Vinayak Associates',
        firm_gstin_snapshot = '27AABCV5544K1Z8',
        firm_address_snapshot = ?
    WHERE firm_id = 2 OR firm_name_snapshot LIKE '%Summit%'
  `).run(unifiedOfficeAddress);

  // 3. Receiving Bank Accounts
  const insertRecBank = db.prepare(`
    INSERT OR IGNORE INTO receiving_bank_accounts (id, account_name, bank_name, account_number, ifsc)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertRecBank.run(1, 'HDFC Bank - Operating Current A/C', 'HDFC Bank', '50200012345678', 'HDFC0000240');
  insertRecBank.run(2, 'ICICI Bank - Collections Current A/C', 'ICICI Bank', '000405001234', 'ICIC0000004');

  // 4. Voucher Types
  const insertVoucher = db.prepare(`
    INSERT OR IGNORE INTO voucher_types (id, voucher_name)
    VALUES (?, ?)
  `);

  insertVoucher.run(1, 'Bank Receipt');
  insertVoucher.run(2, 'Cash Receipt');
  insertVoucher.run(3, 'Journal Voucher');
  insertVoucher.run(4, 'Adjustment / Credit Note');

  // 5. Tax Rates (SAC)
  const insertTax = db.prepare(`
    INSERT OR IGNORE INTO tax_rates (id, sac_code, gst_rate, description)
    VALUES (?, ?, ?, ?)
  `);

  insertTax.run(1, '997159', 18.00, 'Other Financial Services (Loan Syndication & DSA Intermediation)');
  insertTax.run(2, '9971', 18.00, 'Financial and Related Services');

  // 6. Products
  const newProducts = [
    { acronym: 'BL', name: 'Business Loan' },
    { acronym: 'CF', name: 'Construction Finance' },
    { acronym: 'CL', name: 'Consumer Loan' },
    { acronym: 'CP', name: 'Commercial Purchase' },
    { acronym: 'CRF', name: 'Car Refinance' },
    { acronym: 'HL', name: 'Housing Loan' },
    { acronym: 'IP', name: 'Industrial Purchase' },
    { acronym: 'LAP', name: 'Loan Against Property' },
    { acronym: 'LP', name: 'Land Purchase' },
    { acronym: 'LRD', name: 'Lease Rental Discounting' },
    { acronym: 'ML', name: 'Machinery Loan' },
    { acronym: 'OD', name: 'Overdraft' },
    { acronym: 'PP', name: 'Plot Purchase' },
    { acronym: 'TL', name: 'Term Loan' },
    { acronym: 'UDF', name: 'Unsold Inventory Finance' },
    { acronym: 'URL', name: 'Used Car Loan' }
  ];

  // Remove old products not in standard list
  const standardNames = newProducts.map(p => p.name);
  db.prepare(`DELETE FROM products WHERE name NOT IN (${standardNames.map(() => '?').join(', ')})`).run(...standardNames);

  const insertProd = db.prepare(`
    INSERT OR REPLACE INTO products (id, name, acronym, created_at)
    VALUES (?, ?, ?, ?)
  `);

  newProducts.forEach((p, idx) => {
    insertProd.run(idx + 1, p.name, p.acronym, now);
  });

  // 7. Sales Members
  const insertSales = db.prepare(`
    INSERT OR IGNORE INTO sales_members (id, name, created_at)
    VALUES (?, ?, ?)
  `);

  insertSales.run(1, 'Rajesh Sharma', now);
  insertSales.run(2, 'Priya Mehta', now);
  insertSales.run(3, 'Amit Patel', now);

  console.log('[Seed] Database seeded successfully.');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed();
}

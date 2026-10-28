import { db } from './db.js';

export function runMigration() {
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

  const now = new Date().toISOString();

  // Pragmas must run outside transactions
  db.pragma('foreign_keys = OFF');

  try {
    db.transaction(() => {
      // 1. Check existing products
      const existingProducts = db.prepare('SELECT * FROM products').all() as any[];
      const hasOldHomeLoan = existingProducts.some(p => p.name === 'Home Loan');
      const hasOldWctl = existingProducts.some(p => p.acronym === 'WCTL');

      // 2. Insert all 16 standard products
      const insertProd = db.prepare(`
        INSERT OR REPLACE INTO products (id, name, acronym, created_at)
        VALUES (?, ?, ?, ?)
      `);

      newProducts.forEach((p, idx) => {
        insertProd.run(idx + 1, p.name, p.acronym, now);
      });

      // 3. Map legacy product references in files
      if (hasOldHomeLoan || hasOldWctl) {
        db.prepare("UPDATE files SET product_id = 8 WHERE product_id = 1").run(); // LAP
        db.prepare("UPDATE files SET product_id = 6 WHERE product_id = 2").run(); // HL
        db.prepare("UPDATE files SET product_id = 1 WHERE product_id = 3").run(); // BL
        db.prepare("UPDATE files SET product_id = 14 WHERE product_id = 4").run(); // TL
      }

      // Delete any products beyond the standard 16
      const standardNames = newProducts.map(p => p.name);
      db.prepare(`DELETE FROM products WHERE name NOT IN (${standardNames.map(() => '?').join(', ')})`).run(...standardNames);

      // 4. Migrate file status check constraint
      const tableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='files'").get() as any)?.sql || '';

      if (!tableSql.includes('WIP (Work in Progress)')) {
        db.exec(`
          CREATE TABLE files_new (
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
            review_remarks TEXT
          );

          INSERT INTO files_new
          SELECT 
            id, login_date, client_id, bank_id, product_id, sales_member_id,
            bank_manager_name, code, source, sanction_loan_amount,
            CASE status
              WHEN 'Approved' THEN 'Disbursement'
              WHEN 'In Progress' THEN 'WIP (Work in Progress)'
              WHEN 'Eligible' THEN 'Sanction'
              WHEN 'Rejected' THEN 'Rejected from Bank'
              ELSE status
            END,
            created_by, created_at, reviewed_by, reviewed_at, review_remarks
          FROM files;

          DROP TABLE files;
          ALTER TABLE files_new RENAME TO files;

          CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
          CREATE INDEX IF NOT EXISTS idx_files_client ON files(client_id);
        `);
      }

      // 5. Migrate Firms to Mavin Credits & Vinayak Associates with Bank Details
      const firmCols = db.prepare("PRAGMA table_info(firms)").all() as any[];
      if (!firmCols.some(c => c.name === 'bank_name')) {
        db.exec("ALTER TABLE firms ADD COLUMN bank_name TEXT");
      }
      if (!firmCols.some(c => c.name === 'account_name')) {
        db.exec("ALTER TABLE firms ADD COLUMN account_name TEXT");
      }
      if (!firmCols.some(c => c.name === 'account_no')) {
        db.exec("ALTER TABLE firms ADD COLUMN account_no TEXT");
      }
      if (!firmCols.some(c => c.name === 'ifsc_code')) {
        db.exec("ALTER TABLE firms ADD COLUMN ifsc_code TEXT");
      }
      if (!firmCols.some(c => c.name === 'branch')) {
        db.exec("ALTER TABLE firms ADD COLUMN branch TEXT");
      }

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

      const unifiedOfficeAddress = 'Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005';

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

      db.prepare('DELETE FROM firms WHERE id NOT IN (1, 2)').run();

      // Update invoice snapshots for updated firms
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

      // 6. Migrate user emails to @vinayakassociates.in domain
      db.prepare(`
        UPDATE users 
        SET email = CASE 
          WHEN INSTR(email, '@') > 0 THEN SUBSTR(email, 1, INSTR(email, '@') - 1) || '@vinayakassociates.in'
          ELSE email || '@vinayakassociates.in'
        END
        WHERE email NOT LIKE '%@vinayakassociates.in'
      `).run();

      // 7. Add client_phone column to clients table if missing
      const clientCols = db.prepare("PRAGMA table_info(clients)").all() as any[];
      if (!clientCols.some(c => c.name === 'client_phone')) {
        db.exec("ALTER TABLE clients ADD COLUMN client_phone TEXT");
      }

      // 8. Add firm_id column to files table if missing
      const fileCols = db.prepare("PRAGMA table_info(files)").all() as any[];
      if (!fileCols.some(c => c.name === 'firm_id')) {
        db.exec("ALTER TABLE files ADD COLUMN firm_id INTEGER REFERENCES firms(id) DEFAULT 1");
      }

      // 9. Migrate status 'Disbursement' to 'Disburse'
      const filesTableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='files'").get() as any)?.sql || '';
      if (!filesTableSql.includes("'Disburse'")) {
        db.exec(`
          CREATE TABLE files_disburse_mig (
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

          INSERT INTO files_disburse_mig
          SELECT 
            id, login_date, client_id, bank_id, product_id, sales_member_id,
            bank_manager_name, code, source, sanction_loan_amount,
            CASE WHEN status = 'Disbursement' THEN 'Disburse' ELSE status END,
            created_by, created_at, reviewed_by, reviewed_at, review_remarks,
            COALESCE(firm_id, 1)
          FROM files;

          DROP TABLE files;
          ALTER TABLE files_disburse_mig RENAME TO files;

          CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
          CREATE INDEX IF NOT EXISTS idx_files_client ON files(client_id);
        `);
      } else {
        db.prepare("UPDATE files SET status = 'Disburse' WHERE status = 'Disbursement'").run();
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigration();
  console.log('[Migration] Database migration completed successfully.');
}

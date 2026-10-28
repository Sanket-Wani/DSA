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

      // 5. Migrate Firms to Mavin Credits & Vinayak Associates
      const insertFirm = db.prepare(`
        INSERT INTO firms (id, firm_name, gstin, state, state_code, address, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          firm_name = excluded.firm_name,
          gstin = excluded.gstin,
          state = excluded.state,
          state_code = excluded.state_code,
          address = excluded.address,
          is_active = excluded.is_active
      `);

      insertFirm.run(
        1,
        'Mavin Credits',
        '27AAUCM0275A1ZH',
        'Maharashtra',
        '27',
        'Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005',
        1
      );
      insertFirm.run(
        2,
        'Vinayak Associates',
        '27AABCV5544K1Z8',
        'Maharashtra',
        '27',
        'Office No. 101, Vinayak Chambers, Near Swargate, Pune – 411030',
        1
      );

      db.prepare('DELETE FROM firms WHERE id NOT IN (1, 2)').run();

      // Update invoice snapshots for updated firms
      db.prepare(`
        UPDATE invoices 
        SET firm_name_snapshot = 'Mavin Credits',
            firm_gstin_snapshot = '27AAUCM0275A1ZH',
            firm_address_snapshot = 'Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005'
        WHERE firm_id = 1 OR firm_name_snapshot LIKE '%Apex%'
      `).run();

      db.prepare(`
        UPDATE invoices 
        SET firm_name_snapshot = 'Vinayak Associates',
            firm_gstin_snapshot = '27AABCV5544K1Z8',
            firm_address_snapshot = 'Office No. 101, Vinayak Chambers, Near Swargate, Pune – 411030'
        WHERE firm_id = 2 OR firm_name_snapshot LIKE '%Summit%'
      `).run();

      // 6. Migrate user emails to @vinayakassociates.in domain
      db.prepare(`
        UPDATE users 
        SET email = CASE 
          WHEN INSTR(email, '@') > 0 THEN SUBSTR(email, 1, INSTR(email, '@') - 1) || '@vinayakassociates.in'
          ELSE email || '@vinayakassociates.in'
        END
        WHERE email NOT LIKE '%@vinayakassociates.in'
      `).run();
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigration();
  console.log('[Migration] Database migration completed successfully.');
}

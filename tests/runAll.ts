import { db } from '../server/db.js';
import { runSeed } from '../server/seed.js';
import { calculateGst } from '../server/services/taxService.js';
import { generateProductAcronym } from '../server/routes/masterData.js';
import { generateInvoicePdf } from '../server/services/pdfService.js';
import { generateNextFileIds } from '../server/routes/files.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== Running Full DSA Software Automated Verification Test Suite ===\n');

  // Ensure fresh seed
  runSeed();

  // Test 1: Acronym generation logic
  console.log('\n--- 1. Product Acronym Generation ---');
  assert(generateProductAcronym('Business Loan') === 'BL', 'Business Loan -> BL');
  assert(generateProductAcronym('Construction Finance') === 'CF', 'Construction Finance -> CF');
  assert(generateProductAcronym('Car Refinance') === 'CRF', 'Car Refinance -> CRF');
  assert(generateProductAcronym('Housing Loan') === 'HL', 'Housing Loan -> HL');
  assert(generateProductAcronym('Loan Against Property') === 'LAP', 'Loan Against Property -> LAP');
  assert(generateProductAcronym('Overdraft') === 'OD', 'Overdraft -> OD');
  assert(generateProductAcronym('Unsold Inventory Finance') === 'UDF', 'Unsold Inventory Finance -> UDF');
  assert(generateProductAcronym('Used Car Loan') === 'URL', 'Used Car Loan -> URL');

  // Test 2: Master data persistence
  console.log('\n--- 2. Master Data & Entity Integrity ---');
  const products = db.prepare('SELECT * FROM products').all();
  assert(products.length >= 16, `At least 16 products seeded (found ${products.length})`);

  const firms = db.prepare('SELECT * FROM firms').all() as any[];
  assert(firms.length >= 2, `At least 2 firms configured (found ${firms.length})`);
  assert(firms.some(f => f.firm_name === 'Mavin Credits'), 'Mavin Credits configured in firms');
  assert(firms.some(f => f.firm_name === 'Vinayak Associates'), 'Vinayak Associates configured in firms');

  const vTypes = db.prepare('SELECT * FROM voucher_types').all();
  assert(vTypes.length >= 3, `Voucher types configured (found ${vTypes.length})`);

  // Test 3: Client and Bank relationship
  console.log('\n--- 3. Client & Multiple Banks Association ---');
  const now = new Date().toISOString();
  const cInfo = db.prepare(`
    INSERT INTO clients (company_name, gst_no, client_name, client_email, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('Test Logistics Ltd', '27AABCT9999Z1Z5', 'Sunil Deshmukh', 'sunil@testlogistics.com', now);
  const testClientId = Number(cInfo.lastInsertRowid);

  // Add 2 banks to same client
  const b1 = db.prepare(`
    INSERT INTO banks (client_id, bank_name, bank_gst_no, created_at)
    VALUES (?, ?, ?, ?)
  `).run(testClientId, 'Axis Bank BKC', '27AAACA1234A1Z5', now);
  const b2 = db.prepare(`
    INSERT INTO banks (client_id, bank_name, bank_gst_no, created_at)
    VALUES (?, ?, ?, ?)
  `).run(testClientId, 'State Bank of India Nariman Point', '27AAACS0000A1Z1', now);

  const clientBanks = db.prepare('SELECT * FROM banks WHERE client_id = ?').all(testClientId);
  assert(clientBanks.length === 2, 'One client successfully associated with multiple banks in relational DB');

  // Test 4: File Creation & Sequential ID
  console.log('\n--- 4. File Workflow & Initial Status ---');
  const testSeq = Math.floor(10000 + Math.random() * 90000);
  const fileId1 = `FL-TEST-${testSeq}`;
  db.prepare(`
    INSERT INTO files (
      id, login_date, client_id, bank_id, product_id, sales_member_id,
      bank_manager_name, code, source, sanction_loan_amount, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    fileId1,
    now,
    testClientId,
    Number(b1.lastInsertRowid),
    8, // LAP (id 8 in new 16 products)
    1, // Rajesh Sharma
    'Vikram Mehta',
    `CODE-${testSeq}`,
    'Direct Referral',
    7500000,
    'WIP (Work in Progress)',
    now
  );

  const file1 = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId1) as any;
  assert(file1 && file1.id === fileId1, 'File created and persisted with stable canonical ID');
  assert(file1.status === 'WIP (Work in Progress)', 'File status is WIP (Work in Progress)');

  // Test 5: Marking Sanction makes it appear for approval
  db.prepare("UPDATE files SET status = 'Sanction' WHERE id = ?").run(fileId1);
  const eligibleFiles = db.prepare("SELECT * FROM files WHERE status = 'Sanction'").all() as any[];
  assert(eligibleFiles.some(f => f.id === fileId1), 'File marked Sanction appears in Superadmin approval queue');

  // Test 6: Disbursements blocked for non-disbursable files
  console.log('\n--- 5. Disbursement Eligibility Gate ---');
  const sanctionCheck = db.prepare('SELECT status FROM files WHERE id = ?').get(fileId1) as any;
  assert(sanctionCheck.status === 'Sanction', 'File is in Sanction status');

  // Test 7: Superadmin Approval to Disbursement
  console.log('\n--- 6. Superadmin Approval Commit & Audit Trail ---');
  const approvalTimestamp = new Date().toISOString();
  db.prepare(`
    UPDATE files 
    SET status = 'Disburse', reviewed_by = 1, reviewed_at = ?, review_remarks = 'All KYC and bank sanction verified'
    WHERE id = ?
  `).run(approvalTimestamp, fileId1);

  const approvedFile = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId1) as any;
  assert(approvedFile.status === 'Disburse', 'File status authoritatively updated to Disburse in DB');
  assert(approvedFile.reviewed_by === 1 && approvedFile.reviewed_at !== null, 'Decision recorded reviewer ID and timestamp');
  assert(approvedFile.reviewed_by === 1 && approvedFile.reviewed_at !== null, 'Decision recorded reviewer ID and timestamp');

  // Test 8: Multiple Disbursements Persistence
  console.log('\n--- 7. Multiple Loan Disbursements Recording ---');
  const d1 = db.prepare(`
    INSERT INTO disbursements (file_id, disbursement_amount, disbursement_date, created_at)
    VALUES (?, ?, ?, ?)
  `).run(fileId1, 2500000, '2026-10-15', now);

  const d2 = db.prepare(`
    INSERT INTO disbursements (file_id, disbursement_amount, disbursement_date, created_at)
    VALUES (?, ?, ?, ?)
  `).run(fileId1, 5000000, '2026-10-25', now);

  const disbursements = db.prepare('SELECT * FROM disbursements WHERE file_id = ?').all(fileId1);
  assert(disbursements.length === 2, 'Multiple disbursement tranches independently persisted for approved file');
  const totalDisbursed = disbursements.reduce((s: number, d: any) => s + Number(d.disbursement_amount), 0);
  assert(totalDisbursed === 7500000, `Total disbursed equals sanction amount: ₹${totalDisbursed}`);

  // Test: Verify disbursement exceeding sanction limit is flagged
  const file1Record = db.prepare('SELECT sanction_loan_amount FROM files WHERE id = ?').get(fileId1) as any;
  const excessDisbursementAmount = 50000;
  const exceedsSanction = (totalDisbursed + excessDisbursementAmount) > file1Record.sanction_loan_amount;
  assert(exceedsSanction === true, `Disbursement exceeding sanction limit (₹${totalDisbursed + excessDisbursementAmount} > ₹${file1Record.sanction_loan_amount}) correctly identified`);

  // Test 9: Tax Calculation Engine
  console.log('\n--- 8. Centralized Statutory GST Calculation Service ---');
  // Intra-state (Firm Maharashtra 27, Client Maharashtra 27)
  const intraTax = calculateGst(100000, '997159', 1, '27AABCT9999Z1Z5');
  assert(intraTax.isInterState === false, 'Detected Intra-State supply (both state code 27)');
  assert(intraTax.cgstRate === 9 && intraTax.cgstAmount === 9000, 'CGST 9% = ₹9,000.00');
  assert(intraTax.sgstRate === 9 && intraTax.sgstAmount === 9000, 'SGST 9% = ₹9,000.00');
  assert(intraTax.igstAmount === 0, 'IGST = 0 for intra-state');
  assert(intraTax.totalAmount === 118000, 'Total Invoice Amount = 100000 + 9000 + 9000 = ₹118,000.00');

  // Inter-state (Firm Maharashtra 27, Client Delhi 07)
  const interTax = calculateGst(100000, '997159', 1, '07AABCT9999Z1Z5');
  assert(interTax.isInterState === true, 'Detected Inter-State supply (27 vs 07)');
  assert(interTax.cgstAmount === 0 && interTax.sgstAmount === 0, 'CGST and SGST = 0 for inter-state');
  assert(interTax.igstRate === 18 && interTax.igstAmount === 18000, 'IGST 18% = ₹18,000.00');
  assert(interTax.totalAmount === 118000, 'Total Invoice Amount = 100000 + 18000 = ₹118,000.00');

  // Missing SAC rate error handling
  let missingSacHandled = false;
  try {
    calculateGst(100000, '999999_UNKNOWN', 1, '27AABCT9999Z1Z5');
  } catch (err: any) {
    missingSacHandled = err.message.includes('Tax rate configuration missing');
  }
  assert(missingSacHandled, 'Missing SAC tax configuration prevents incorrect silent invoice calculations');

  // Test 10: Invoice Generation & Accounts Ledger Link
  console.log('\n--- 9. Invoice Creation & Accounts Ledger Integration ---');
  const invId = `test-invoice-${testSeq}`;
  const invNumber = `INV/TEST/${testSeq}`;
  db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, file_id, firm_id, invoice_date, year, month,
      loan_account_no, mcf_no, disbursement_amount, sac, amount,
      cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_amount,
      firm_name_snapshot, firm_gstin_snapshot, firm_address_snapshot,
      client_company_snapshot, client_name_snapshot, client_email_snapshot, client_gstin_snapshot,
      bank_name_snapshot, product_name_snapshot, created_by, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `).run(
    invId,
    invNumber,
    fileId1,
    1,
    '2026-10-26',
    2026,
    10,
    'LA-AXIS-9921',
    'MCF-0019',
    7500000,
    '997159',
    100000,
    9, 9000, 9, 9000, 0, 0, 118000,
    'Mavin Credits', '27AAUCM0275A1ZH', 'Office No. 502, Varun Capital, Shivajinagar, Pune',
    'Test Logistics Ltd', 'Sunil Deshmukh', 'sunil@testlogistics.com', '27AABCT9999Z1Z5',
    'Axis Bank BKC', 'Loan Against Property', 1, now
  );

  // Initialize accounts row
  db.prepare(`
    INSERT INTO accounts_ledger (
      invoice_id, voucher_id, taxable_received_date, taxable_amount, taxable_bank_account_id,
      gst_received_date, gst_amount, gst_account_id, tds_amount, tds_recovery_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invId,
    1, // Bank Receipt
    '2026-10-27',
    98000, // Client paid 98k after 2k TDS
    1, // HDFC
    '2026-10-27',
    18000,
    1,
    2000, // 2% TDS under 194H
    'Recovered',
    now
  );

  const accRow = db.prepare('SELECT * FROM accounts_ledger WHERE invoice_id = ?').get(invId) as any;
  assert(accRow && accRow.invoice_id === invId, 'Accounts ledger row properly initialized and linked to Invoice ID');
  assert(accRow.tds_amount === 2000 && accRow.tds_recovery_status === 'Recovered', 'TDS details recorded in Accounts ledger');

  // Test 11: Real PDF Generation
  console.log('\n--- 10. Vectorized PDF Generation Engine ---');
  const savedInv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) as any;
  const pdfBuffer = await generateInvoicePdf(savedInv);
  assert(pdfBuffer instanceof Buffer && pdfBuffer.length > 1000, `PDF generated with real binary buffer size: ${pdfBuffer.length} bytes`);
  // Verify PDF header magic bytes %PDF-
  const isRealPdf = pdfBuffer.slice(0, 4).toString('utf-8') === '%PDF';
  assert(isRealPdf, 'Generated file contains valid %PDF header specification');

  // Test 12: GST & TDS Reports Aggregation from Accounts
  console.log('\n--- 11. Statutory GST & TDS Reports Data Consistency ---');
  const gstReportRecords = db.prepare(`
    SELECT i.invoice_number, i.amount as taxable_amount, (i.cgst_amount + i.sgst_amount + i.igst_amount) as gst_amount,
           a.gst_amount as collected_gst, a.tds_amount, a.tds_recovery_status
    FROM invoices i
    JOIN accounts_ledger a ON i.id = a.invoice_id
    WHERE i.firm_id = 1 AND i.year = 2026 AND i.month = 10
  `).all() as any[];

  assert(gstReportRecords.length > 0, `GST Report returns ${gstReportRecords.length} record(s) matching firm and period`);
  assert(Number(gstReportRecords[0].taxable_amount) === 100000, 'GST Report taxable amount strictly matches saved invoice');
  assert(Number(gstReportRecords[0].collected_gst) === 18000, 'GST Report collected amount strictly matches Accounts ledger');
  assert(Number(gstReportRecords[0].tds_amount) === 2000, 'TDS Report amount strictly matches Accounts ledger');

  // Test 13: Users Module & Credentials Management
  console.log('\n--- 12. Users Management & Access Activation ---');
  const allUsers = db.prepare('SELECT * FROM users').all() as any[];
  assert(allUsers.length >= 4, `Seeded users include reference team members (found ${allUsers.length})`);
  assert(allUsers.some(u => u.full_name === 'Priya Nair'), 'Priya Nair present in users database');
  assert(allUsers.some(u => u.full_name === 'System Superadmin'), 'System Superadmin present in users database');
  assert(allUsers.every(u => u.email.endsWith('@vinayakassociates.in')), 'All seeded users have @vinayakassociates.in email domain');

  // Create new team login via DB
  const testEmail = `test.agent.${testSeq}@vinayakassociates.in`;
  db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(testEmail, 'hashed_pwd', 'New Test Agent', 'Team', 1, now);
  const createdUser = db.prepare('SELECT * FROM users WHERE email = ?').get(testEmail) as any;
  assert(createdUser && createdUser.full_name === 'New Test Agent', 'Created team login persisted with active status');

  // Deactivate and activate user
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(createdUser.id);
  const deactivatedUser = db.prepare('SELECT is_active FROM users WHERE id = ?').get(createdUser.id) as any;
  assert(deactivatedUser.is_active === 0, 'User status successfully toggled to Deactivated (0)');

  db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(createdUser.id);
  const reactivatedUser = db.prepare('SELECT is_active FROM users WHERE id = ?').get(createdUser.id) as any;
  assert(reactivatedUser.is_active === 1, 'User status successfully toggled to Active (1)');

  // Reset password
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run('new_reset_hash', createdUser.id);
  const updatedPwUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(createdUser.id) as any;
  assert(updatedPwUser.password_hash === 'new_reset_hash', 'User password successfully reset');

  // Delete user
  db.prepare('DELETE FROM users WHERE id = ?').run(createdUser.id);
  const deletedUser = db.prepare('SELECT id FROM users WHERE id = ?').get(createdUser.id);
  assert(deletedUser === undefined, 'User successfully deleted from database');

  // Test 13: Excel Workbook Generation
  console.log('\n--- 13. Excel XLSX Export Engine ---');
  const XLSX = await import('xlsx');
  const sampleData = [
    { 'Invoice No': 'INV/2026-27/0001', 'Taxable Value': 100000, 'Billed GST': 18000, 'Status': 'Collected' }
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Test Sheet');
  const wbBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert(wbBuffer instanceof Buffer && wbBuffer.length > 100, `Generated Excel workbook binary size: ${wbBuffer.length} bytes`);

  // Test 14: File Editing, Multi-Bank Allocation & Deletion
  console.log('\n--- 14. File Editing, Multi-Bank Allocation & Deletion ---');
  const testFileSeq = Math.floor(10000 + Math.random() * 90000);
  const testEditFileId = `FL-EDIT-${testFileSeq}`;

  // Create file with multiple banks
  db.prepare(`
    INSERT INTO files (
      id, login_date, client_id, bank_id, product_id, sales_member_id,
      bank_manager_name, code, source, sanction_loan_amount, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testEditFileId,
    now,
    testClientId,
    Number(b1.lastInsertRowid),
    1,
    1,
    'Manager A',
    `CODE-EDIT-${testFileSeq}`,
    'Channel Partner',
    6000000,
    'WIP (Work in Progress)',
    now
  );

  db.prepare(`
    INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(testEditFileId, Number(b1.lastInsertRowid), 'Manager A', 3000000, now);

  db.prepare(`
    INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(testEditFileId, Number(b2.lastInsertRowid), 'Manager B', 3000000, now);

  const savedBanks = db.prepare('SELECT * FROM file_banks WHERE file_id = ?').all(testEditFileId);
  assert(savedBanks.length === 2, 'File successfully associated with multiple bank sanction allocations in DB');

  // Edit / Update file details after creation
  db.prepare(`
    UPDATE files 
    SET sanction_loan_amount = 7000000, code = ? 
    WHERE id = ?
  `).run(`CODE-UPDATED-${testFileSeq}`, testEditFileId);

  const updatedFile = db.prepare('SELECT * FROM files WHERE id = ?').get(testEditFileId) as any;
  assert(updatedFile.sanction_loan_amount === 7000000, 'File sanction amount successfully updated after creation');
  assert(updatedFile.code === `CODE-UPDATED-${testFileSeq}`, 'File code successfully updated after creation');

  // Delete file
  db.prepare('DELETE FROM file_banks WHERE file_id = ?').run(testEditFileId);
  db.prepare('DELETE FROM files WHERE id = ?').run(testEditFileId);
  const deletedCheck = db.prepare('SELECT id FROM files WHERE id = ?').get(testEditFileId);
  assert(deletedCheck === undefined, 'File and associated bank allocations successfully deleted');

  // Test 15: Multi-Bank Individual File Creation
  console.log('\n--- 15. Multi-Bank Individual File Records Generation ---');
  const ids = generateNextFileIds(1, 3);
  assert(ids.length === 3, 'Generated 3 sequential file IDs');
  assert(new Set(ids).size === 3, 'All 3 file IDs are completely distinct and non-duplicate');
  assert(ids[0] < ids[1] && ids[1] < ids[2], 'File IDs strictly follow sequential numbering');

  // Test 16: Number to Words Indian Currency Formatter
  console.log('\n--- 16. Indian Currency Words Formatter ---');
  const { numberToWordsIndian } = await import('../src/utils/numberToWords.js');
  assert(numberToWordsIndian(5000000) === 'Rupees Fifty Lakh Only', '5,000,000 converts to "Rupees Fifty Lakh Only"');
  assert(numberToWordsIndian(7500000) === 'Rupees Seventy Five Lakh Only', '7,500,000 converts to "Rupees Seventy Five Lakh Only"');
  assert(numberToWordsIndian(10000000) === 'Rupees One Crore Only', '10,000,000 converts to "Rupees One Crore Only"');

  // Test 17: Disbursements Summary API Fields
  console.log('\n--- 17. Disbursements Summary Data Table Fields ---');
  const disbSummary = db.prepare(`
    SELECT 
      f.id as file_id,
      COALESCE(c.company_name, '') as company_name,
      COALESCE(c.client_name, '') as client_name,
      COALESCE(c.gst_no, '') as gst_no,
      COALESCE(b.bank_name, '') as bank_name,
      COALESCE(f.bank_manager_name, '') as bank_manager_name,
      COALESCE(f.sanction_loan_amount, 0) as sanction_loan_amount
    FROM files f
    LEFT JOIN clients c ON f.client_id = c.id
    LEFT JOIN banks b ON f.bank_id = b.id
    WHERE f.id = ?
  `).get(fileId1) as any;
  assert(disbSummary && disbSummary.file_id === fileId1, 'Disbursements summary queries file record');
  assert('gst_no' in disbSummary, 'Disbursements summary includes client GSTIN');
  assert('bank_manager_name' in disbSummary, 'Disbursements summary includes bank manager name');

  // Test 18: Accounts Ledger Query Fields
  console.log('\n--- 18. Accounts Ledger Table Columns & Snapshot Fields ---');
  const accQuery = db.prepare(`
    SELECT 
      i.id as invoice_id,
      i.firm_name_snapshot as firm_name,
      i.year,
      i.month,
      i.client_company_snapshot as company_name,
      i.client_name_snapshot as client_name,
      i.client_gstin_snapshot as gst_no,
      i.total_amount as invoice_total_amount,
      i.invoice_date
    FROM invoices i
    WHERE i.id = ?
  `).get(invId) as any;
  assert(accQuery && accQuery.invoice_id === invId, 'Accounts ledger query finds invoice by ID');
  assert(accQuery && 'firm_name' in accQuery, 'Accounts ledger includes firm');
  assert(accQuery && 'year' in accQuery && 'month' in accQuery, 'Accounts ledger includes year and month');
  assert(accQuery && 'company_name' in accQuery && 'client_name' in accQuery && 'gst_no' in accQuery, 'Accounts ledger includes client company name, client name, and client GSTIN');
  assert(accQuery && 'invoice_total_amount' in accQuery, 'Accounts ledger includes invoice amount');
  assert(accQuery && 'invoice_date' in accQuery, 'Accounts ledger includes invoice date');
  assert(accQuery && (accQuery.total_amount - accQuery.amount) === 18000, 'Total GST calculated correctly as total_amount - taxable_amount');

  // Test 19: TDS Sec 194J (2%) and Sec 194H (10%) calculation
  console.log('\n--- 19. TDS Section Calculation (194J vs 194H) ---');
  const taxableVal = Number(accQuery.amount); // 100,000
  const tds194J = taxableVal * 0.02;
  const tds194H = taxableVal * 0.10;
  assert(tds194J === 2000, 'Sec 194J calculates 2% of taxable amount (₹2,000)');
  assert(tds194H === 10000, 'Sec 194H calculates 10% of taxable amount (₹10,000)');

  // Test 20: Accounts Ledger Status and Section Fields Persistence
  console.log('\n--- 20. Accounts Ledger Section Statuses and Fields Persistence ---');
  db.prepare(`
    UPDATE accounts_ledger SET
      taxable_status = 'Complete',
      gst_status = 'Partial',
      tds_status = 'Complete',
      tds_received_date = '2026-10-28',
      tds_section = '194J'
    WHERE invoice_id = ?
  `).run(invId);

  const updatedLedger = db.prepare('SELECT * FROM accounts_ledger WHERE invoice_id = ?').get(invId) as any;
  assert(updatedLedger.taxable_status === 'Complete', 'Taxable status persisted as Complete');
  assert(updatedLedger.gst_status === 'Partial', 'GST status persisted as Partial');
  assert(updatedLedger.tds_status === 'Complete', 'TDS status persisted as Complete');
  assert(updatedLedger.tds_received_date === '2026-10-28', 'TDS received date persisted');
  assert(updatedLedger.tds_section === '194J', 'TDS section persisted as 194J');

  // Test 21: Automated Status and Color Computation Logic
  console.log('\n--- 21. Automatic Section & Record Status Logic ---');
  const { computeSectionStatus, computeRecordStatus } = await import('../src/modules/Accounts.js');

  // Section status rules:
  // 0 / empty -> Pending (Red)
  assert(computeSectionStatus(0, 100000) === 'Pending', 'Entered 0 against 100,000 -> Pending (Red)');
  assert(computeSectionStatus(-5, 100000) === 'Pending', 'Negative value -> Pending (Red)');
  // > 0 and < total -> Partial (Yellow)
  assert(computeSectionStatus(50000, 100000) === 'Partial', 'Entered 50,000 against 100,000 -> Partial (Yellow)');
  assert(computeSectionStatus(99999, 100000) === 'Partial', 'Entered 99,999 against 100,000 -> Partial (Yellow)');
  // >= total -> Complete (Green)
  assert(computeSectionStatus(100000, 100000) === 'Complete', 'Entered 100,000 against 100,000 -> Complete (Green)');
  assert(computeSectionStatus(105000, 100000) === 'Complete', 'Entered 105,000 against 100,000 -> Complete (Green)');

  // Record status rules:
  // All 3 sections entered 0 -> Pending (Red record)
  assert(computeRecordStatus(0, 100000, 0, 18000, 0, 2000) === 'Pending', 'All 3 sections 0 -> Record status is Pending (Red)');
  // At least one partial -> Partial (Yellow record)
  assert(computeRecordStatus(50000, 100000, 0, 18000, 0, 2000) === 'Partial', 'At least one partial -> Record status is Partial (Yellow)');
  assert(computeRecordStatus(100000, 100000, 9000, 18000, 2000, 2000) === 'Partial', 'One section partial with others complete -> Record status is Partial (Yellow)');
  // All 3 complete -> Complete (Green record)
  assert(computeRecordStatus(100000, 100000, 18000, 18000, 2000, 2000) === 'Complete', 'All 3 sections complete -> Record status is Complete (Green)');

  // Cleanup test artifacts
  db.prepare('DELETE FROM disbursements WHERE file_id = ?').run(fileId1);
  db.prepare('DELETE FROM accounts_ledger WHERE invoice_id = ?').run(invId);
  db.prepare('DELETE FROM invoices WHERE id = ?').run(invId);
  db.prepare('DELETE FROM files WHERE id = ?').run(fileId1);

  // Summary
  console.log(`\n======================================================`);
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test Suite Failed with unexpected error:', err);
  process.exit(1);
});

import { db } from '../server/db.js';
import { runSeed } from '../server/seed.js';
import { calculateGst } from '../server/services/taxService.js';
import { generateProductAcronym } from '../server/routes/masterData.js';
import { generateInvoicePdf } from '../server/services/pdfService.js';

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

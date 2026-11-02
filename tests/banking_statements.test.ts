import fs from 'fs';
import path from 'path';
import { db } from '../server/db.js';
import {
  invokeParserScript,
  processStatementUpload,
  getAccountTransactions,
  updateTransactionRemarks,
  cancelPendingStatement
} from '../server/services/bankStatementService.js';

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

async function runBankingStatementTests() {
  console.log('=== Running Banking Statement Parser & Reconciliation Verification Test Suite ===\n');

  const statementsDir = path.resolve(process.cwd(), 'banking statements');

  // 1. Direct Parser Tests on all 5 Actual PDF Statements
  console.log('--- 1. Deterministic Parser Engine Extraction Accuracy ---');

  // Axis Bank 2 (Format A - Single amount column, April 2025)
  const axis2Path = path.join(statementsDir, 'axis bank 2.pdf');
  const axis2Result = await invokeParserScript(axis2Path, 'Axis Bank', '919020078367730');
  assert(axis2Result.success === true, 'Axis Bank 2.pdf parsed successfully');
  assert(axis2Result.bank_name === 'Axis Bank', 'Axis Bank 2 detected as Axis Bank');
  assert(axis2Result.account_number === '919020078367730', 'Axis Bank 2 account number matches 919020078367730');
  assert(axis2Result.transactions?.length === 31, `Axis Bank 2 extracted exactly 31 transactions (got ${axis2Result.transactions?.length})`);
  assert(axis2Result.opening_balance_paise === 67563678, 'Axis Bank 2 opening balance is 675,636.78');
  assert(axis2Result.closing_balance_paise === 37055855, 'Axis Bank 2 closing balance is 370,558.55');

  // Axis Bank (Format B - Multi-page, January 2026)
  const axis1Path = path.join(statementsDir, 'axis bank.pdf');
  const axis1Result = await invokeParserScript(axis1Path, 'Axis Bank', '919020078367730');
  assert(axis1Result.success === true, 'Axis Bank.pdf parsed successfully');
  assert(axis1Result.transactions?.length === 45, `Axis Bank.pdf extracted exactly 45 transactions (got ${axis1Result.transactions?.length})`);
  assert(axis1Result.opening_balance_paise === 23647298, 'Axis Bank opening balance is 236,472.98');
  assert(axis1Result.closing_balance_paise === 55909964, 'Axis Bank closing balance is 559,099.64');

  // Bank of Baroda (Monospaced layout, April-October 2025)
  const bobPath = path.join(statementsDir, 'Bank Of Baroda.pdf');
  const bobResult = await invokeParserScript(bobPath, 'Bank of Baroda', '89740100001411');
  assert(bobResult.success === true, 'Bank of Baroda.pdf parsed successfully');
  assert(bobResult.bank_name === 'Bank of Baroda', 'Bank of Baroda detected correctly');
  assert(bobResult.transactions?.length === 27, `Bank of Baroda extracted exactly 27 transactions (got ${bobResult.transactions?.length})`);
  assert(bobResult.opening_balance_paise === 23600, 'Bank of Baroda opening balance is 236.00');
  assert(bobResult.closing_balance_paise === 1039068, 'Bank of Baroda closing balance is 10,390.68');

  // HDFC Bank (Coordinate columnar, April 2023 - March 2024)
  const hdfcPath = path.join(statementsDir, 'hdfc bank.pdf');
  const hdfcResult = await invokeParserScript(hdfcPath, 'HDFC Bank', '50200030895472');
  assert(hdfcResult.success === true, 'HDFC Bank.pdf parsed successfully');
  assert(hdfcResult.bank_name === 'HDFC Bank', 'HDFC Bank detected correctly');
  assert(hdfcResult.transactions?.length === 38, `HDFC Bank extracted exactly 38 transactions (got ${hdfcResult.transactions?.length})`);
  assert(hdfcResult.opening_balance_paise === 1096436, 'HDFC Bank opening balance is 10,964.36');
  assert(hdfcResult.closing_balance_paise === 2259977, 'HDFC Bank closing balance is 22,599.77');
  assert(hdfcResult.total_debit_paise === 37131052, 'HDFC Bank total debits equal 371,310.52');
  assert(hdfcResult.total_credit_paise === 38294593, 'HDFC Bank total credits equal 382,945.93');

  // ICICI Bank (Single page table, April-November 2025)
  const iciciPath = path.join(statementsDir, 'icici.pdf');
  const iciciResult = await invokeParserScript(iciciPath, 'ICICI Bank', '000505501299');
  assert(iciciResult.success === true, 'ICICI Bank.pdf parsed successfully');
  assert(iciciResult.bank_name === 'ICICI Bank', 'ICICI Bank detected correctly');
  assert(iciciResult.transactions?.length === 13, `ICICI Bank extracted exactly 13 transactions (got ${iciciResult.transactions?.length})`);
  assert(iciciResult.opening_balance_paise === 11822965, 'ICICI Bank opening balance is 118,229.65');
  assert(iciciResult.closing_balance_paise === 6086615, 'ICICI Bank closing balance is 60,866.15');

  // 2. Bank Account Verification & Mismatch Protection
  console.log('\n--- 2. Bank Account Security & Verification ---');
  let bankMismatchCaught = false;
  try {
    // Attempting to upload Axis statement to HDFC Bank account
    await invokeParserScript(axis2Path, 'HDFC Bank', '50200030895472');
  } catch (err: any) {
    bankMismatchCaught = err.message.includes('Bank mismatch');
  }
  assert(bankMismatchCaught, 'Rejects statement uploaded to mismatched bank name');

  let accMismatchCaught = false;
  try {
    // Attempting to upload statement to wrong account number
    await invokeParserScript(hdfcPath, 'HDFC Bank', '99999999999999');
  } catch (err: any) {
    accMismatchCaught = err.message.includes('Account mismatch');
  }
  assert(accMismatchCaught, 'Rejects statement uploaded to mismatched account number');

  // 3. Database Persistence, Duplicate Detection & Gap Reconciliation
  console.log('\n--- 3. Database Persistence, Duplicates & Gap Reconciliation ---');
  
  // Register clean test account in DB
  db.prepare("DELETE FROM banking_accounts WHERE account_number LIKE 'TEST%'").run();
  const now = new Date().toISOString();
  const testAccRes = db.prepare(`
    INSERT INTO banking_accounts (bank_name, branch, account_type, ifsc_code, account_number, account_holder_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Axis Bank', 'Shivajinagar', 'CA', 'UTIB0000037', 'TEST919020078367730', 'VINAYAK ASSOCIATES', now);
  const testAccId = Number(testAccRes.lastInsertRowid);

  // Copy axis2 to temp file to test upload
  const tempDir = path.resolve(process.cwd(), 'uploads', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempFile1 = path.join(tempDir, 'test_upload_1.pdf');
  fs.copyFileSync(axis2Path, tempFile1);

  // First-time clean statement upload
  const upload1 = await processStatementUpload(testAccId, tempFile1, 'axis_bank_2.pdf', false);
  assert(upload1.status === 'success', 'First-time statement upload succeeds');
  assert(upload1.imported_count === 31, 'Imported exactly 31 transactions');

  // Verify DB records
  const dbTxns = getAccountTransactions(testAccId);
  assert(dbTxns.length === 31, `Database contains exactly 31 stored transactions (found ${dbTxns.length})`);
  assert(dbTxns[0].transaction_date === '2025-04-02', 'First transaction date is 2025-04-02');
  assert(dbTxns[0].debit === 41250, 'First transaction debit amount is ₹41,250.00');
  assert(dbTxns[0].balance === 634386.78, 'First transaction balance is ₹634,386.78');

  // Verify monthly_statuses updated to complete for 2025-4
  const updatedAcc = db.prepare('SELECT monthly_statuses FROM banking_accounts WHERE id = ?').get(testAccId) as any;
  const statuses = JSON.parse(updatedAcc.monthly_statuses || '{}');
  assert(statuses['2025-4'] === 'complete', 'Dashboard monthly status for 2025-4 updated to complete');

  // 4. Duplicate Statement Upload Test (100% Duplicate)
  console.log('\n--- 4. Duplicate Transaction Detection ---');
  const tempFileDup = path.join(tempDir, 'test_upload_dup.pdf');
  fs.copyFileSync(axis2Path, tempFileDup);

  const uploadDup = await processStatementUpload(testAccId, tempFileDup, 'axis_bank_2_dup.pdf', false);
  assert(uploadDup.status === 'all_duplicates', 'Detects all-duplicate statement and rejects re-import');
  assert(uploadDup.duplicate_count === 31, 'Reports 31 duplicate transactions');
  assert(getAccountTransactions(testAccId).length === 31, 'No duplicate transactions inserted into DB');

  // 5. Remarks Autosave Test
  console.log('\n--- 5. Transaction Remarks & Autosave ---');
  const firstTxnId = dbTxns[0].id;
  const remarkSaved = updateTransactionRemarks(firstTxnId, 'Verified partner payment');
  assert(remarkSaved === true, 'Remarks updated successfully in database');
  
  const reloadedTxns = getAccountTransactions(testAccId);
  assert(reloadedTxns[0].remarks === 'Verified partner payment', 'Persisted remarks loaded correctly');

  // 6. Missing Transactions Gap Detection Test
  console.log('\n--- 6. Financial Integrity: Missing Transaction Gap Blocking ---');
  // Upload Jan 2026 statement (`axis bank.pdf`) directly after April 2025 (`axis bank 2.pdf`).
  // April closing is 370558.55, but Jan starts at 236472.98. Missing gap between May-Dec 2025!
  const tempFileGap = path.join(tempDir, 'test_upload_gap.pdf');
  fs.copyFileSync(axis1Path, tempFileGap);

  const uploadGap = await processStatementUpload(testAccId, tempFileGap, 'axis_bank_jan2026.pdf', false);
  assert(uploadGap.status === 'gap_detected', 'Blocks upload and triggers gap_detected on balance jump');
  assert(uploadGap.gap_details?.missing_from_date === '2025-04-30', 'Identified gap start date as 2025-04-30');
  assert(uploadGap.gap_details?.missing_to_date === '2026-01-01', 'Identified gap end date as 2026-01-01');
  assert(uploadGap.gap_details?.previous_closing_balance === 370558.55, 'Reports previous closing balance as 370,558.55');
  assert(uploadGap.gap_details?.new_opening_balance === 236472.98, 'Reports new opening balance as 236,472.98');
  assert(getAccountTransactions(testAccId).length === 31, 'Zero unverified transactions imported while blocked');

  // Cancel pending statement holding record
  const cancelSuccess = cancelPendingStatement(testAccId);
  assert(cancelSuccess === true, 'Pending gap statement cancelled successfully');

  // Clean up test account & test artifacts
  db.prepare("DELETE FROM banking_accounts WHERE account_number LIKE 'TEST%'").run();
  console.log('  ✓ [PASS] Cleaned up temporary test database records');

  // Summary
  console.log(`\n======================================================`);
  console.log(`Banking Statement Test Suite: ${passed} Passed, ${failed} Failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runBankingStatementTests().catch(err => {
  console.error('Banking Statement Test Suite Failed:', err);
  process.exit(1);
});


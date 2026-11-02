import { db } from '../server/db.js';
import bankingRouter from '../server/routes/banking.js';

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

async function runBankingTests() {
  console.log('=== Running Banking Module Automated Verification Test Suite ===\n');

  // Test 1: Verify Schema & Table Structure
  console.log('--- 1. Database Schema & Integrity ---');
  const tableInfo = db.prepare("PRAGMA table_info(banking_accounts)").all() as any[];
  assert(tableInfo.length >= 8, 'banking_accounts table exists with at least 8 columns');

  const colNames = tableInfo.map(c => c.name);
  assert(colNames.includes('id'), 'banking_accounts has id column');
  assert(colNames.includes('bank_name'), 'banking_accounts has bank_name column');
  assert(colNames.includes('branch'), 'banking_accounts has branch column');
  assert(colNames.includes('account_type'), 'banking_accounts has account_type column');
  assert(colNames.includes('ifsc_code'), 'banking_accounts has ifsc_code column');
  assert(colNames.includes('account_number'), 'banking_accounts has account_number column');
  assert(colNames.includes('account_holder_name'), 'banking_accounts has account_holder_name column');
  assert(colNames.includes('created_at'), 'banking_accounts has created_at column');

  // Test 2: Clean up any prior test banking accounts
  db.prepare("DELETE FROM banking_accounts WHERE account_number LIKE 'TEST%'").run();

  // Test 3: Account Type Constraint & Insertion
  console.log('\n--- 2. Banking Account Insertion & Account Types ---');
  const now = new Date().toISOString();

  // Current Account (CA)
  const caResult = db.prepare(`
    INSERT INTO banking_accounts (bank_name, branch, account_type, ifsc_code, account_number, account_holder_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('HDFC Bank', 'Shivajinagar Pune', 'CA', 'HDFC0000240', 'TEST502000123456', 'Mavin Credit Consultant Pvt Ltd', now);

  const caId = Number(caResult.lastInsertRowid);
  const caRecord = db.prepare('SELECT * FROM banking_accounts WHERE id = ?').get(caId) as any;
  assert(caRecord && caRecord.bank_name === 'HDFC Bank', 'CA account inserted with correct Bank Name');
  assert(caRecord && caRecord.branch === 'Shivajinagar Pune', 'CA account inserted with correct Branch');
  assert(caRecord && caRecord.account_type === 'CA', 'CA account has account_type = CA');
  assert(caRecord && caRecord.ifsc_code === 'HDFC0000240', 'CA account has correct IFSC Code');
  assert(caRecord && caRecord.account_number === 'TEST502000123456', 'CA account has correct Account Number');
  assert(caRecord && caRecord.account_holder_name === 'Mavin Credit Consultant Pvt Ltd', 'CA account has correct Account Holder Name');

  // Savings Account (Saving)
  const saResult = db.prepare(`
    INSERT INTO banking_accounts (bank_name, branch, account_type, ifsc_code, account_number, account_holder_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('ICICI Bank', 'Swargate Pune', 'Saving', 'ICIC0000004', 'TEST000405009999', 'Vinayak Associates Partner', now);

  const saId = Number(saResult.lastInsertRowid);
  const saRecord = db.prepare('SELECT * FROM banking_accounts WHERE id = ?').get(saId) as any;
  assert(saRecord && saRecord.account_type === 'Saving', 'Saving account inserted with account_type = Saving');

  // Invalid Account Type rejected by DB check constraint
  let invalidTypeCaught = false;
  try {
    db.prepare(`
      INSERT INTO banking_accounts (bank_name, branch, account_type, ifsc_code, account_number, account_holder_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('Axis Bank', 'Kothrud', 'FixedDeposit', 'UTIB0000123', 'TEST999999999999', 'Test User', now);
  } catch (err: any) {
    invalidTypeCaught = true;
  }
  assert(invalidTypeCaught, 'Database check constraint rejects account_type not in (CA, Saving)');

  // Test 4: Duplicate Prevention Constraint
  console.log('\n--- 3. Duplicate Account Prevention ---');
  let duplicateCaught = false;
  try {
    db.prepare(`
      INSERT INTO banking_accounts (bank_name, branch, account_type, ifsc_code, account_number, account_holder_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('HDFC Bank', 'Another Branch', 'CA', 'HDFC0000240', 'TEST502000123456', 'Duplicate Attempt', now);
  } catch (err: any) {
    duplicateCaught = true;
  }
  assert(duplicateCaught, 'Unique constraint prevents duplicate (account_number + ifsc_code)');

  // Test 5: Validation Logic in API Route
  console.log('\n--- 4. Backend Route API Handler & Validation ---');
  assert(typeof bankingRouter === 'function', 'bankingRouter is a valid Express router');

  // Clean up test accounts
  db.prepare("DELETE FROM banking_accounts WHERE account_number LIKE 'TEST%'").run();
  console.log('  ✓ [PASS] Cleaned up temporary test artifacts');

  // Summary
  console.log(`\n======================================================`);
  console.log(`Banking Test Execution Finished: ${passed} Passed, ${failed} Failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runBankingTests().catch(err => {
  console.error('Banking Test Suite Failed with unexpected error:', err);
  process.exit(1);
});


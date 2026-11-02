import { describe, it } from 'node:test';
import assert from 'node:assert';
import { db } from '../server/db.js';
import {
  getAccountTransactions,
  updateTransactionRemarks
} from '../server/services/bankStatementService.js';

console.log('=== Running Month-Wise Transaction Access & Dynamic Completion Test Suite ===\n');

// 1. Setup temporary test account
const testAccNo = '99990000888811';
const testIfsc = 'HDFC0000240';
db.prepare('DELETE FROM banking_transactions WHERE account_id IN (SELECT id FROM banking_accounts WHERE account_number = ?)').run(testAccNo);
db.prepare('DELETE FROM banking_accounts WHERE account_number = ?').run(testAccNo);

const insertAcc = db.prepare(`
  INSERT INTO banking_accounts (bank_name, branch, account_type, ifsc_code, account_number, account_holder_name, created_at)
  VALUES ('HDFC Bank', 'Fort, Mumbai', 'CA', ?, ?, 'Test Account Holder', ?)
`).run(testIfsc, testAccNo, new Date().toISOString());

const testAccId = Number(insertAcc.lastInsertRowid);
assert(testAccId > 0, 'Test account created');

try {
  // Insert transactions across two different months: April 2026 and May 2026
  // April 2026: 3 transactions (initially 0 remarks)
  db.prepare(`
    INSERT INTO banking_transactions (account_id, statement_batch_id, transaction_date, original_date_str, particulars, debit_paise, credit_paise, balance_paise, remarks, created_at)
    VALUES (?, 'batch1', '2026-04-05', '05-04-2026', 'Vendor payment 1', 100000, 0, 900000, '', ?)
  `).run(testAccId, new Date().toISOString());

  db.prepare(`
    INSERT INTO banking_transactions (account_id, statement_batch_id, transaction_date, original_date_str, particulars, debit_paise, credit_paise, balance_paise, remarks, created_at)
    VALUES (?, 'batch1', '2026-04-12', '12-04-2026', 'Vendor payment 2', 200000, 0, 700000, '', ?)
  `).run(testAccId, new Date().toISOString());

  db.prepare(`
    INSERT INTO banking_transactions (account_id, statement_batch_id, transaction_date, original_date_str, particulars, debit_paise, credit_paise, balance_paise, remarks, created_at)
    VALUES (?, 'batch1', '2026-04-20', '20-04-2026', 'Client receipt', 0, 500000, 1200000, '', ?)
  `).run(testAccId, new Date().toISOString());

  // May 2026: 2 transactions (both with remarks filled)
  db.prepare(`
    INSERT INTO banking_transactions (account_id, statement_batch_id, transaction_date, original_date_str, particulars, debit_paise, credit_paise, balance_paise, remarks, created_at)
    VALUES (?, 'batch2', '2026-05-02', '02-05-2026', 'Office supplies', 50000, 0, 1150000, 'Approved expense', ?)
  `).run(testAccId, new Date().toISOString());

  db.prepare(`
    INSERT INTO banking_transactions (account_id, statement_batch_id, transaction_date, original_date_str, particulars, debit_paise, credit_paise, balance_paise, remarks, created_at)
    VALUES (?, 'batch2', '2026-05-15', '15-05-2026', 'Software subscription', 30000, 0, 1120000, 'Cloud hosting monthly', ?)
  `).run(testAccId, new Date().toISOString());

  console.log('--- 1. Month-Wise Transaction Access & Filtering ---');
  // Query April 2026 only
  const aprilTxns = getAccountTransactions(testAccId, '2026-04');
  assert.strictEqual(aprilTxns.length, 3, 'April 2026 returns exactly 3 transactions');
  assert(aprilTxns.every(t => t.transaction_date.startsWith('2026-04')), 'All April transactions start with 2026-04');
  console.log('  ✓ [PASS] April 2026 query returns exactly 3 April transactions');

  // Query May 2026 only
  const mayTxns = getAccountTransactions(testAccId, '2026-05');
  assert.strictEqual(mayTxns.length, 2, 'May 2026 returns exactly 2 transactions');
  assert(mayTxns.every(t => t.transaction_date.startsWith('2026-05')), 'All May transactions start with 2026-05');
  console.log('  ✓ [PASS] May 2026 query returns exactly 2 May transactions');

  // Query March 2026 (0 transactions)
  const marchTxns = getAccountTransactions(testAccId, '2026-03');
  assert.strictEqual(marchTxns.length, 0, 'March 2026 returns 0 transactions');
  console.log('  ✓ [PASS] Month with no transactions returns empty array');

  // Query without month returns all transactions
  const allTxns = getAccountTransactions(testAccId);
  assert.strictEqual(allTxns.length, 5, 'All query returns total 5 transactions');
  console.log('  ✓ [PASS] Query without month parameter returns all transactions for account');

  console.log('\n--- 2. Distinct Available Months Discovery ---');
  const availableRows = db.prepare(`
    SELECT DISTINCT SUBSTR(transaction_date, 1, 7) as ym
    FROM banking_transactions
    WHERE account_id = ?
    ORDER BY ym DESC
  `).all(testAccId) as any[];
  const availableMonths = availableRows.map(r => r.ym);
  assert.deepStrictEqual(availableMonths, ['2026-05', '2026-04'], 'Available months discovers exactly 2026-05 and 2026-04');
  console.log('  ✓ [PASS] Available months dropdown discovers only months with transactions (2026-05, 2026-04)');

  console.log('\n--- 3. Dynamic Status & Progress Bar Calculation ---');
  // Run dynamic calculation aggregation
  const computeStats = () => {
    const stats = db.prepare(`
      SELECT 
        account_id,
        SUBSTR(transaction_date, 1, 7) as ym,
        COUNT(*) as total_txns,
        SUM(CASE WHEN remarks IS NOT NULL AND TRIM(remarks) != '' THEN 1 ELSE 0 END) as remarks_filled
      FROM banking_transactions
      WHERE account_id = ?
      GROUP BY account_id, SUBSTR(transaction_date, 1, 7)
    `).all(testAccId) as any[];

    const result: Record<string, { status: string; total: number; filled: number; progress: number }> = {};
    for (const s of stats) {
      const total = Number(s.total_txns);
      const filled = Number(s.remarks_filled);
      const progress = total > 0 ? Math.round((filled / total) * 100) : 0;
      let status = 'unuploaded';
      if (total > 0) {
        if (filled === total) status = 'complete';
        else if (filled > 0) status = 'partially_complete';
        else status = 'fully_incomplete';
      }
      result[s.ym] = { status, total, filled, progress };
    }
    return result;
  };

  let stats = computeStats();

  // Test Condition 1: Fully Incomplete (April: 0/3 filled)
  assert.strictEqual(stats['2026-04'].status, 'fully_incomplete', 'April 2026 is fully_incomplete');
  assert.strictEqual(stats['2026-04'].progress, 0, 'April 2026 progress is 0%');
  assert.strictEqual(stats['2026-04'].total, 3, 'April 2026 total is 3');
  assert.strictEqual(stats['2026-04'].filled, 0, 'April 2026 filled is 0');
  console.log('  ✓ [PASS] April 2026 (0/3 filled): fully_incomplete, 0% progress');

  // Test Condition 2: Complete (May: 2/2 filled)
  assert.strictEqual(stats['2026-05'].status, 'complete', 'May 2026 is complete');
  assert.strictEqual(stats['2026-05'].progress, 100, 'May 2026 progress is 100%');
  assert.strictEqual(stats['2026-05'].total, 2, 'May 2026 total is 2');
  assert.strictEqual(stats['2026-05'].filled, 2, 'May 2026 filled is 2');
  console.log('  ✓ [PASS] May 2026 (2/2 filled): complete, 100% progress');

  console.log('\n--- 4. Real-time Status Transitions on Remark Edit & Clear ---');
  // Fill remark for 1st transaction in April (1 of 3 filled -> partially_complete, 33%)
  const firstTxnId = aprilTxns[0].id;
  updateTransactionRemarks(firstTxnId, 'Direct tax advance payment');
  stats = computeStats();
  assert.strictEqual(stats['2026-04'].status, 'partially_complete', 'April 2026 transitions to partially_complete');
  assert.strictEqual(stats['2026-04'].filled, 1, 'April 2026 filled is 1');
  assert.strictEqual(stats['2026-04'].progress, 33, 'April 2026 progress is 33%');
  console.log('  ✓ [PASS] Filling 1 remark in April transitions status to partially_complete (33% progress)');

  // Fill remark for 2nd and 3rd transaction in April (3 of 3 filled -> complete, 100%)
  updateTransactionRemarks(aprilTxns[1].id, 'Audit fee Q4');
  updateTransactionRemarks(aprilTxns[2].id, 'Consulting invoice #402');
  stats = computeStats();
  assert.strictEqual(stats['2026-04'].status, 'complete', 'April 2026 transitions to complete');
  assert.strictEqual(stats['2026-04'].filled, 3, 'April 2026 filled is 3');
  assert.strictEqual(stats['2026-04'].progress, 100, 'April 2026 progress is 100%');
  console.log('  ✓ [PASS] Filling all remarks transitions status to complete (100% progress)');

  // Clear all remarks in April -> transitions back to fully_incomplete
  updateTransactionRemarks(aprilTxns[0].id, '');
  updateTransactionRemarks(aprilTxns[1].id, '   '); // whitespace only
  updateTransactionRemarks(aprilTxns[2].id, '');
  stats = computeStats();
  assert.strictEqual(stats['2026-04'].status, 'fully_incomplete', 'April 2026 transitions back to fully_incomplete');
  assert.strictEqual(stats['2026-04'].filled, 0, 'April 2026 filled is 0');
  assert.strictEqual(stats['2026-04'].progress, 0, 'April 2026 progress is 0%');
  console.log('  ✓ [PASS] Clearing remarks transitions status back to fully_incomplete (0% progress)');

  console.log('\n======================================================');
  console.log('All Month-Wise Banking & Dynamic Status Tests Passed!');
  console.log('======================================================\n');
} finally {
  // Cleanup test records
  db.prepare('DELETE FROM banking_transactions WHERE account_id = ?').run(testAccId);
  db.prepare('DELETE FROM banking_accounts WHERE id = ?').run(testAccId);
}

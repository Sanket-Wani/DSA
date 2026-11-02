import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { BankingAccount, BankingTransaction, StatementGapDetails, StatementUploadResponse } from '../../src/types/index.js';

export interface ParsedStatementTransaction {
  date: string;              // 'YYYY-MM-DD'
  original_date_str: string; // 'DD-MM-YYYY' or 'DD/MM/YY'
  particulars: string;
  debit_paise: number;
  credit_paise: number;
  balance_paise: number;
}

export interface ParsedStatementResult {
  success: boolean;
  error?: string;
  bank_name?: string;
  account_number?: string;
  account_number_masked?: boolean;
  account_holder_name?: string;
  ifsc_code?: string;
  from_date?: string;
  to_date?: string;
  opening_balance_paise?: number;
  closing_balance_paise?: number;
  total_debit_paise?: number;
  total_credit_paise?: number;
  transaction_count?: number;
  transactions?: ParsedStatementTransaction[];
}

/**
 * Validate that file begins with standard PDF magic bytes '%PDF-'
 */
export function validatePdfMagicBytes(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const buffer = Buffer.alloc(5);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buffer, 0, 5, 0);
    return buffer.toString('utf-8') === '%PDF-';
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Executes Python parser script deterministically
 */
export async function invokeParserScript(
  filePath: string,
  expectedBank?: string,
  expectedAccount?: string
): Promise<ParsedStatementResult> {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'parse_bank_statement.py');
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Parser script not found at ${scriptPath}`);
  }

  // Resolve Python command
  const pythonCmd = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');

  const args = [scriptPath, filePath];
  if (expectedBank) args.push(expectedBank);
  if (expectedAccount) args.push(expectedAccount);

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, args, { cwd: process.cwd() });
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', chunk => {
      stdoutData += chunk.toString('utf-8');
    });

    child.stderr.on('data', chunk => {
      stderrData += chunk.toString('utf-8');
    });

    child.on('error', err => {
      reject(new Error(`Failed to spawn Python parser process: ${err.message}`));
    });

    child.on('close', code => {
      // Find JSON in stdout (in case of any stray non-JSON prints)
      const trimmed = stdoutData.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as ParsedStatementResult;
          if (parsed.success) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || 'Parsing failed'));
          }
        } catch (jsonErr: any) {
          reject(new Error(`Failed to parse parser JSON output: ${jsonErr.message}. Output was: ${stdoutData}`));
        }
      } else {
        const errMsg = stderrData.trim() || stdoutData.trim() || `Process exited with code ${code}`;
        reject(new Error(`Python parser execution failed: ${errMsg}`));
      }
    });
  });
}

/**
 * Core business workflow for bank statement upload:
 * Validation -> Extraction -> Duplicate Detection -> Gap Reconciliation -> Persistence -> Monthly Status Update
 */
export async function processStatementUpload(
  accountId: number,
  tempFilePath: string,
  originalFilename: string,
  skipDuplicates: boolean = false
): Promise<StatementUploadResponse> {
  // 1. Fetch bank account record
  const account = db.prepare('SELECT * FROM banking_accounts WHERE id = ?').get(accountId) as any;
  if (!account) {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    throw new Error(`Bank account with ID ${accountId} not found.`);
  }

  // 2. Validate PDF format
  if (!validatePdfMagicBytes(tempFilePath)) {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    throw new Error('Invalid file format. Uploaded file does not have a valid PDF header (%PDF-).');
  }

  // 3. Execute deterministic parser
  const parsed = await invokeParserScript(tempFilePath, account.bank_name, account.account_number);
  const transactions = parsed.transactions || [];

  if (transactions.length === 0) {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    throw new Error('No transactions found in uploaded bank statement.');
  }

  // 4. Fetch existing transactions for duplicate detection and continuity check
  const existingTxns = db.prepare(`
    SELECT id, transaction_date, debit_paise, credit_paise, balance_paise, remarks, particulars
    FROM banking_transactions
    WHERE account_id = ?
    ORDER BY transaction_date ASC, id ASC
  `).all(accountId) as any[];

  // 5. Duplicate Detection
  // Criteria: Transaction Date + Debit + Credit + Running Balance
  const detectedDuplicates: ParsedStatementTransaction[] = [];
  const genuinelyNewTransactions: ParsedStatementTransaction[] = [];

  for (const t of transactions) {
    const isDup = existingTxns.some(
      e =>
        e.transaction_date === t.date &&
        e.debit_paise === t.debit_paise &&
        e.credit_paise === t.credit_paise &&
        e.balance_paise === t.balance_paise
    );
    if (isDup) {
      detectedDuplicates.push(t);
    } else {
      genuinelyNewTransactions.push(t);
    }
  }

  // 5A: All-duplicate statement
  if (detectedDuplicates.length === transactions.length) {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    return {
      status: 'all_duplicates',
      message: `All ${transactions.length} transactions in the statement already exist in your account. No new records were imported.`,
      duplicate_count: transactions.length,
      total_count: transactions.length,
      imported_count: 0
    };
  }

  // 5B: Partial duplicates without user confirmation to skip
  if (detectedDuplicates.length > 0 && !skipDuplicates) {
    // Keep temp file for immediate retry if user clicks 'Skip Duplicates and Upload'
    return {
      status: 'duplicates_detected',
      message: `${detectedDuplicates.length} duplicate transactions were detected in the uploaded statement.`,
      duplicate_count: detectedDuplicates.length,
      total_count: transactions.length,
      imported_count: genuinelyNewTransactions.length
    };
  }

  // 6. Balance Continuity & Gap Detection
  // Validate that the new statement forms continuous financial balance records
  if (existingTxns.length > 0) {
    const latestExisting = existingTxns[existingTxns.length - 1];
    const firstStatementTxn = transactions[0];

    // Check if new statement is strictly AFTER existing transactions
    if (firstStatementTxn.date > latestExisting.transaction_date) {
      const expectedOpening = latestExisting.balance_paise;
      const actualOpening = parsed.opening_balance_paise !== undefined ? parsed.opening_balance_paise : firstStatementTxn.balance_paise + firstStatementTxn.debit_paise - firstStatementTxn.credit_paise;

      if (expectedOpening !== actualOpening) {
        // Genuine missing transaction range detected!
        // BLOCK upload and store pending statement in holding
        const gapDetails: StatementGapDetails = {
          missing_from_date: latestExisting.transaction_date,
          missing_to_date: firstStatementTxn.date,
          previous_closing_balance: latestExisting.balance_paise / 100,
          new_opening_balance: actualOpening / 100,
          difference: Math.abs(actualOpening - expectedOpening) / 100,
          reason: `Previous known balance is ₹${(latestExisting.balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}, but new statement starts with ₹${(actualOpening / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
        };

        // Move to secure persistent pending storage
        const pendingDir = path.resolve(process.cwd(), 'uploads', 'pending');
        if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true });
        const pendingFile = path.join(pendingDir, `pending_${accountId}_${Date.now()}.pdf`);
        fs.copyFileSync(tempFilePath, pendingFile);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

        // Store pending record
        const insertPending = db.prepare(`
          INSERT INTO banking_pending_statements (
            account_id, original_filename, temp_file_path, from_date, to_date,
            opening_balance_paise, closing_balance_paise, extracted_json, gap_details_json, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_gap', ?)
        `);
        const now = new Date().toISOString();
        const pendingResult = insertPending.run(
          accountId,
          originalFilename,
          pendingFile,
          parsed.from_date || firstStatementTxn.date,
          parsed.to_date || transactions[transactions.length - 1].date,
          parsed.opening_balance_paise || 0,
          parsed.closing_balance_paise || 0,
          JSON.stringify(transactions),
          JSON.stringify(gapDetails),
          now
        );

        return {
          status: 'gap_detected',
          message: 'Missing transactions detected. Statement upload is blocked until continuity is established.',
          gap_details: gapDetails,
          pending_statement_id: Number(pendingResult.lastInsertRowid)
        };
      }
    }
  }

  // 7. Atomic Database Insertion & Monthly Status Updates
  const txnsToImport = skipDuplicates ? genuinelyNewTransactions : transactions;
  const batchId = randomUUID();
  const now = new Date().toISOString();

  const insertTxnStmt = db.prepare(`
    INSERT INTO banking_transactions (
      account_id, statement_batch_id, transaction_date, original_date_str,
      particulars, debit_paise, credit_paise, balance_paise, remarks, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)
  `);

  const updatedMonthsSet = new Set<string>();

  const commitTransaction = db.transaction(() => {
    for (const t of txnsToImport) {
      insertTxnStmt.run(
        accountId,
        batchId,
        t.date,
        t.original_date_str,
        t.particulars,
        t.debit_paise,
        t.credit_paise,
        t.balance_paise,
        now
      );

      // Collect months for status update e.g. '2025-4', '2026-1'
      const dtParts = t.date.split('-');
      if (dtParts.length >= 2) {
        const y = parseInt(dtParts[0], 10);
        const m = parseInt(dtParts[1], 10);
        updatedMonthsSet.add(`${y}-${m}`);
      }
    }

    // Update account's monthly_statuses JSON
    let monthlyStatuses: Record<string, string> = {};
    try {
      if (account.monthly_statuses) {
        monthlyStatuses = JSON.parse(account.monthly_statuses);
      }
    } catch {
      monthlyStatuses = {};
    }

    for (const ym of updatedMonthsSet) {
      monthlyStatuses[ym] = 'complete';
    }

    db.prepare('UPDATE banking_accounts SET monthly_statuses = ? WHERE id = ?').run(
      JSON.stringify(monthlyStatuses),
      accountId
    );

    // If an intermediate statement resolved a pending gap statement, check if pending can now be committed!
    checkAndResolvePendingStatements(accountId);
  });

  commitTransaction();

  // 8. Secure Temporary File Cleanup
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }

  // Fetch updated account record
  const updatedAccount = db.prepare('SELECT * FROM banking_accounts WHERE id = ?').get(accountId) as any;
  if (updatedAccount && updatedAccount.monthly_statuses) {
    try {
      updatedAccount.monthly_statuses = JSON.parse(updatedAccount.monthly_statuses);
    } catch {
      updatedAccount.monthly_statuses = {};
    }
  }

  return {
    status: 'success',
    message: `Bank statement uploaded successfully. ${txnsToImport.length} transactions imported.`,
    imported_count: txnsToImport.length,
    duplicate_count: detectedDuplicates.length,
    total_count: transactions.length,
    months_updated: Array.from(updatedMonthsSet),
    account: updatedAccount
  };
}

/**
 * Checks if a pending gap statement can now be bridged and committed
 */
export function checkAndResolvePendingStatements(accountId: number) {
  const pending = db.prepare(`
    SELECT * FROM banking_pending_statements 
    WHERE account_id = ? AND status = 'pending_gap'
    ORDER BY id ASC
  `).all(accountId) as any[];

  if (pending.length === 0) return;

  const existingTxns = db.prepare(`
    SELECT id, transaction_date, debit_paise, credit_paise, balance_paise
    FROM banking_transactions
    WHERE account_id = ?
    ORDER BY transaction_date ASC, id ASC
  `).all(accountId) as any[];

  if (existingTxns.length === 0) return;

  const latest = existingTxns[existingTxns.length - 1];

  for (const p of pending) {
    try {
      const txns = JSON.parse(p.extracted_json) as ParsedStatementTransaction[];
      if (!txns || txns.length === 0) continue;

      const firstTxn = txns[0];
      const opening = p.opening_balance_paise || (firstTxn.balance_paise + firstTxn.debit_paise - firstTxn.credit_paise);

      // Check if latest transaction connects to opening balance
      if (latest.balance_paise === opening && firstTxn.date >= latest.transaction_date) {
        // Continuity established! Commit pending transactions
        const batchId = randomUUID();
        const now = new Date().toISOString();
        const insertTxnStmt = db.prepare(`
          INSERT INTO banking_transactions (
            account_id, statement_batch_id, transaction_date, original_date_str,
            particulars, debit_paise, credit_paise, balance_paise, remarks, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)
        `);

        for (const t of txns) {
          insertTxnStmt.run(
            accountId,
            batchId,
            t.date,
            t.original_date_str,
            t.particulars,
            t.debit_paise,
            t.credit_paise,
            t.balance_paise,
            now
          );
        }

        // Mark pending statement resolved
        db.prepare("UPDATE banking_pending_statements SET status = 'resolved' WHERE id = ?").run(p.id);

        // Remove pending temp file
        if (p.temp_file_path && fs.existsSync(p.temp_file_path)) {
          fs.unlinkSync(p.temp_file_path);
        }
      }
    } catch (err) {
      console.error(`Error resolving pending statement ${p.id}:`, err);
    }
  }
}

/**
 * Fetch all stored transactions for an account in chronological order
 */
export function getAccountTransactions(accountId: number): BankingTransaction[] {
  const rows = db.prepare(`
    SELECT 
      id, account_id, statement_batch_id, transaction_date, original_date_str,
      particulars, debit_paise, credit_paise, balance_paise, remarks, created_at
    FROM banking_transactions
    WHERE account_id = ?
    ORDER BY transaction_date ASC, id ASC
  `).all(accountId) as any[];

  return rows.map(r => ({
    id: r.id,
    account_id: r.account_id,
    statement_batch_id: r.statement_batch_id,
    transaction_date: r.transaction_date,
    original_date_str: r.original_date_str,
    particulars: r.particulars,
    debit: r.debit_paise / 100,
    credit: r.credit_paise / 100,
    balance: r.balance_paise / 100,
    debit_paise: r.debit_paise,
    credit_paise: r.credit_paise,
    balance_paise: r.balance_paise,
    remarks: r.remarks || '',
    created_at: r.created_at
  }));
}

/**
 * Update user remarks with debounced autosave
 */
export function updateTransactionRemarks(transactionId: number, remarks: string): boolean {
  const res = db.prepare('UPDATE banking_transactions SET remarks = ? WHERE id = ?').run(
    remarks.trim(),
    transactionId
  );
  return res.changes > 0;
}

/**
 * Cancel a pending gap statement and cleanup file
 */
export function cancelPendingStatement(accountId: number): boolean {
  const pending = db.prepare(`
    SELECT id, temp_file_path FROM banking_pending_statements 
    WHERE account_id = ? AND status = 'pending_gap'
  `).all(accountId) as any[];

  for (const p of pending) {
    if (p.temp_file_path && fs.existsSync(p.temp_file_path)) {
      try {
        fs.unlinkSync(p.temp_file_path);
      } catch {}
    }
  }

  const res = db.prepare("UPDATE banking_pending_statements SET status = 'cancelled' WHERE account_id = ? AND status = 'pending_gap'").run(accountId);
  return res.changes > 0;
}


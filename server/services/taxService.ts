import { db } from '../db.js';

export interface TaxCalculationResult {
  taxableAmount: number;
  sacCode: string;
  gstRate: number;
  isInterState: boolean;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
}

export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateGst(
  taxableAmount: number,
  sacCode: string,
  firmId: number,
  clientGstin: string
): TaxCalculationResult {
  if (taxableAmount < 0 || isNaN(taxableAmount)) {
    throw new Error('Taxable amount must be a valid positive number');
  }

  // 1. Fetch tax rate from configuration
  const taxRateRow = db.prepare('SELECT * FROM tax_rates WHERE sac_code = ?').get(sacCode.trim()) as { gst_rate: number; description: string } | undefined;

  if (!taxRateRow) {
    throw new Error(`Tax rate configuration missing for SAC code "${sacCode}". Configure the SAC tax rate before generating invoices.`);
  }

  // 2. Fetch firm details
  const firm = db.prepare('SELECT * FROM firms WHERE id = ?').get(firmId) as { id: number; firm_name: string; state_code: string; gstin: string } | undefined;

  if (!firm) {
    throw new Error(`Configured firm with ID ${firmId} not found.`);
  }

  const gstRate = taxRateRow.gst_rate;
  const firmStateCode = firm.state_code.trim();

  // Extract client state code from GSTIN (First 2 digits)
  const trimmedClientGst = (clientGstin || '').trim();
  let clientStateCode = '';
  if (trimmedClientGst.length >= 2 && /^\d{2}/.test(trimmedClientGst)) {
    clientStateCode = trimmedClientGst.substring(0, 2);
  }

  // Determine if Inter-state or Intra-state
  // If client has a valid 15-char GSTIN and state differs from firm, it is Inter-State (IGST).
  // If state matches or client is unregistered / within same state, it is Intra-State (CGST + SGST).
  const isInterState = clientStateCode !== '' && clientStateCode !== firmStateCode;

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstRate = gstRate;
    igstAmount = roundToTwoDecimals(taxableAmount * (igstRate / 100));
  } else {
    cgstRate = roundToTwoDecimals(gstRate / 2);
    sgstRate = roundToTwoDecimals(gstRate / 2);
    cgstAmount = roundToTwoDecimals(taxableAmount * (cgstRate / 100));
    sgstAmount = roundToTwoDecimals(taxableAmount * (sgstRate / 100));
  }

  const totalTax = roundToTwoDecimals(cgstAmount + sgstAmount + igstAmount);
  const totalAmount = roundToTwoDecimals(taxableAmount + totalTax);

  return {
    taxableAmount: roundToTwoDecimals(taxableAmount),
    sacCode,
    gstRate,
    isInterState,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalTax,
    totalAmount
  };
}

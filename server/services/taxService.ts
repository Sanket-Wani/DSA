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
  clientGstin: string,
  gstType?: 'intra' | 'inter'
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

  // Extract client GSTIN
  const trimmedClientGst = (clientGstin || '').trim();

  // Rule: If GST starts with 27 -> Intra-state (CGST & SGST); otherwise Inter-state (IGST)
  const isInterState = !trimmedClientGst.startsWith('27');

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

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface InvoicePdfData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  file_id?: string;
  firm_name_snapshot: string;
  firm_gstin_snapshot: string;
  firm_address_snapshot: string;
  client_company_snapshot: string;
  client_name_snapshot: string;
  client_email_snapshot: string;
  client_gstin_snapshot: string;
  bank_name_snapshot: string;
  product_name_snapshot: string;
  loan_account_no: string;
  mcf_no: string;
  disbursement_amount: number;
  sac: string;
  amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_amount: number;
  file_source?: string;
  sac_description?: string;
  firm_bank_name?: string;
  firm_account_name?: string;
  firm_account_no?: string;
  firm_ifsc_code?: string;
  firm_branch?: string;
}

/**
 * Converts a numeric amount to Indian currency words
 * e.g. 14570 -> "Rupees Fourteen Thousand Five Hundred Seventy Only"
 * Matches Excel '=SpellNumber(J44)'
 */
export function numberToWordsIndian(num: number): string {
  if (isNaN(num) || num <= 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) {
      const t = tens[Math.floor(n / 10)];
      const o = ones[n % 10];
      return o ? `${t} ${o}` : t;
    }
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const r = n % 100;
      return r ? `${ones[h]} Hundred ${convert(r)}` : `${ones[h]} Hundred`;
    }
    if (n < 100000) {
      const th = Math.floor(n / 1000);
      const r = n % 1000;
      return r ? `${convert(th)} Thousand ${convert(r)}` : `${convert(th)} Thousand`;
    }
    if (n < 10000000) {
      const lk = Math.floor(n / 100000);
      const r = n % 100000;
      return r ? `${convert(lk)} Lakh ${convert(r)}` : `${convert(lk)} Lakh`;
    }
    const cr = Math.floor(n / 10000000);
    const r = n % 10000000;
    return r ? `${convert(cr)} Crore ${convert(r)}` : `${convert(cr)} Crore`;
  }

  const rounded = Math.round(num * 100) / 100;
  const intPart = Math.floor(rounded);
  const paise = Math.round((rounded - intPart) * 100);

  const mainWords = convert(intPart).trim() || 'Zero';
  let result = `Rupees ${mainWords}`;

  if (paise > 0) {
    result += ` and ${convert(paise).trim()} Paise`;
  }
  result += ' Only';

  return result;
}

export function generateInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Standard A4 dimensions: 595.28 x 841.89 points
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true
      });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const leftX = 40;
      const rightX = 555;
      const tableWidth = rightX - leftX; // 515 points

      // 1. Top Logo / Header (Right side)
      const isVinayak = (invoice.firm_name_snapshot || '').toLowerCase().includes('vinayak');
      if (isVinayak) {
        const vinayakLogoPath = path.join(__dirname, '..', 'assets', 'vinayak_associates_logo.png');
        if (fs.existsSync(vinayakLogoPath)) {
          doc.image(vinayakLogoPath, 395, 18, { width: 160 });
        } else {
          doc.fontSize(15).font('Helvetica-Bold').fillColor('#1e3a8a');
          doc.text('VINAYAK ASSOCIATES', 340, 40, { width: 215, align: 'right' });
          doc.fontSize(8).font('Helvetica').fillColor('#64748b');
          doc.text('Financial Services & Syndication', 340, 58, { width: 215, align: 'right' });
        }
      } else {
        const logoPath = path.join(__dirname, '..', 'assets', 'mavin_credit_logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 385, 36, { width: 170 });
        }
      }

      // 2. Row 8: TAX INVOICE Header
      const headerY = 114;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
      doc.text('TAX INVOICE', leftX, headerY, {
        width: tableWidth,
        align: 'center'
      });
      // Bottom thin border for TAX INVOICE
      doc.strokeColor('#202020').lineWidth(0.5).moveTo(leftX, headerY + 18).lineTo(rightX, headerY + 18).stroke();

      // 3. Rows 10-16: Supplier (Left) & Metadata (Right)
      const supplierStartY = 140;

      // Supplier Section (Left: cols B to F in Excel)
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      doc.text('Supplier -', leftX, supplierStartY);
      // Underline under "Supplier -"
      doc.strokeColor('#202020').lineWidth(0.5).moveTo(leftX, supplierStartY + 12).lineTo(leftX + 220, supplierStartY + 12).stroke();

      const supplierName = invoice.firm_name_snapshot || (isVinayak ? 'Vinayak Associates' : 'Mavin Credits');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text(supplierName, leftX, supplierStartY + 16, { width: 330 });

      const supplierAddr = 'Office No. 502, Varun Capital,\nOff J. M. Road, Shivajinagar, Pune – 411005';
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      doc.text(supplierAddr, leftX, supplierStartY + 29, { width: 330 });

      const emailWeb = isVinayak 
        ? 'contact@vinayakassociates.in  | www.vinayakassociates.in  '
        : 'smeloans@mavincredit.com  | www.mavincredit.com  ';
      doc.text(emailWeb, leftX, supplierStartY + 55);

      const supplierGst = invoice.firm_gstin_snapshot || (isVinayak ? '27AABCV5544K1Z8' : '27AAUCM0275A1ZH');
      doc.font('Helvetica-Bold').text(`GSTN   ${supplierGst}`, leftX, supplierStartY + 68);
      if (!isVinayak) {
        doc.font('Helvetica').text('CIN   U66190PN2025PTC247784', leftX, supplierStartY + 81);
      }

      // Metadata Section (Right: cols I to J in Excel)
      const metaLabelX = 390;
      const metaValX = 465;
      const metaWidth = rightX - metaValX;

      // Row 11: Invoice No.
      doc.fontSize(10).font('Helvetica').fillColor('#000000');
      doc.text('Invoice No.', metaLabelX, supplierStartY + 16);
      doc.text(invoice.invoice_number, metaValX, supplierStartY + 16, { width: metaWidth });

      // Row 13: Invoice Date
      doc.text('Invoice Date', metaLabelX, supplierStartY + 42);
      doc.text(invoice.invoice_date, metaValX, supplierStartY + 42, { width: metaWidth });

      // Row 15: Login ID
      doc.text('Login ID', metaLabelX, supplierStartY + 68);
      doc.text(invoice.file_id || invoice.id, metaValX, supplierStartY + 68, { width: metaWidth });

      // 4. Rows 18-23: Buyer Details (Left)
      const buyerStartY = 240;
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      doc.text('Buyer -', leftX, buyerStartY);
      // Underline under "Buyer -"
      doc.strokeColor('#202020').lineWidth(0.5).moveTo(leftX, buyerStartY + 12).lineTo(leftX + 220, buyerStartY + 12).stroke();

      const buyerCompany = invoice.client_company_snapshot || '';
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text(buyerCompany, leftX, buyerStartY + 16, { width: 330 });

      if (invoice.client_name_snapshot) {
        doc.fontSize(9).font('Helvetica').fillColor('#000000');
        doc.text(invoice.client_name_snapshot, leftX, buyerStartY + 28, { width: 330 });
      }

      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      doc.text('eMail', leftX, buyerStartY + 42);
      doc.text(invoice.client_email_snapshot || 'N/A', leftX + 45, buyerStartY + 42);

      doc.font('Helvetica-Bold').text('GSTN  ', leftX, buyerStartY + 55);
      doc.font('Helvetica').text(invoice.client_gstin_snapshot || 'Unregistered', leftX + 45, buyerStartY + 55);

      // Row 24: Horizontal separator line
      const row24Y = 314;
      doc.strokeColor('#202020').lineWidth(0.5).moveTo(leftX, row24Y).lineTo(rightX, row24Y).stroke();

      // 5. Main Table Specifications
      // Column coordinates based on Excel proportions:
      // PARTICULARS: cols A to H -> leftX to colSacX (40 to 400, width 360)
      // SAC: col I -> colSacX to colAmtX (400 to 463, width 63)
      // AMOUNT: cols J to K -> colAmtX to rightX (463 to 555, width 92)
      const colSacX = 400;
      const colAmtX = 463;

      // Row 25: Table Header
      const tableHeaderY = 322;
      const tableHeaderHeight = 24;

      // Gray Header Fill: #F2F2F2
      doc.rect(leftX, tableHeaderY, tableWidth, tableHeaderHeight).fillColor('#F2F2F2').fill();

      // Top and bottom borders
      doc.strokeColor('#202020').lineWidth(0.5);
      doc.moveTo(leftX, tableHeaderY).lineTo(rightX, tableHeaderY).stroke();
      doc.moveTo(leftX, tableHeaderY + tableHeaderHeight).lineTo(rightX, tableHeaderY + tableHeaderHeight).stroke();

      // Vertical lines for header
      doc.moveTo(leftX, tableHeaderY).lineTo(leftX, tableHeaderY + tableHeaderHeight).stroke();
      doc.moveTo(colSacX, tableHeaderY).lineTo(colSacX, tableHeaderY + tableHeaderHeight).stroke();
      doc.moveTo(colAmtX, tableHeaderY).lineTo(colAmtX, tableHeaderY + tableHeaderHeight).stroke();
      doc.moveTo(rightX, tableHeaderY).lineTo(rightX, tableHeaderY + tableHeaderHeight).stroke();

      // Header Labels (Arial 12pt Bold in Excel)
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
      doc.text('PARTICULARS', leftX + 12, tableHeaderY + 5);
      doc.text('SAC', colSacX, tableHeaderY + 5, { width: colAmtX - colSacX, align: 'center' });
      doc.text('AMOUNT', colAmtX, tableHeaderY + 5, { width: rightX - colAmtX - 10, align: 'right' });

      // Rows 26-38: Table Body Area
      const tableBodyStartY = tableHeaderY + tableHeaderHeight;
      const tableBodyHeight = 175;
      const tableBodyEndY = tableBodyStartY + tableBodyHeight; // 521

      // Vertical lines extending through the body
      doc.strokeColor('#202020').lineWidth(0.5);
      doc.moveTo(leftX, tableBodyStartY).lineTo(leftX, tableBodyEndY).stroke();
      doc.moveTo(colSacX, tableBodyStartY).lineTo(colSacX, tableBodyEndY).stroke();
      doc.moveTo(colAmtX, tableBodyStartY).lineTo(colAmtX, tableBodyEndY).stroke();
      doc.moveTo(rightX, tableBodyStartY).lineTo(rightX, tableBodyEndY).stroke();

      // Row 27: Particulars Description & SAC & Taxable Amount
      let sacDescription = invoice.sac_description;
      if (!sacDescription) {
        if (invoice.sac === '998311') {
          sacDescription = 'General Advisory Services and Agent Fees.';
        } else {
          sacDescription = 'Financial Intermediary Service, Loan Processing Commission and Agent Fees.';
        }
      }

      const row27Y = tableBodyStartY + 10;
      doc.fontSize(10).font('Helvetica').fillColor('#000000');
      doc.text(sacDescription, leftX + 12, row27Y, { width: colSacX - leftX - 24 });
      doc.text(invoice.sac, colSacX, row27Y, { width: colAmtX - colSacX, align: 'center' });
      doc.text(
        invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        colAmtX,
        row27Y,
        { width: rightX - colAmtX - 10, align: 'right' }
      );

      // Rows 31-35: Loan Particulars Sub-Table inside PARTICULARS column
      // Excel placement: cols B to G inside rows 31 to 35
      const subTableX = leftX + 12;
      const subTableStartY = tableBodyStartY + 64;
      const subLabelWidth = 110;
      const subValWidth = 225;
      const subRowHeight = 18;

      const subTableRows = [
        { label: 'Case Sourced', val: invoice.file_source || 'Urban Money' },
        { label: 'Loan Account No.', val: invoice.loan_account_no || 'N/A' },
        { label: 'MCF No.', val: invoice.mcf_no || 'N/A' },
        { label: 'Product', val: invoice.product_name_snapshot || 'N/A' },
        {
          label: 'Disbursed Amount',
          val: Number(invoice.disbursement_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        }
      ];

      subTableRows.forEach((row, i) => {
        const curY = subTableStartY + i * subRowHeight;

        // Label Cell with gray fill #F2F2F2
        doc.rect(subTableX, curY, subLabelWidth, subRowHeight).fillColor('#F2F2F2').fill();
        doc.strokeColor('#202020').lineWidth(0.5).rect(subTableX, curY, subLabelWidth, subRowHeight).stroke();

        // Label text (Arial 9pt regular in Excel)
        doc.fontSize(9).font('Helvetica').fillColor('#000000');
        doc.text(row.label, subTableX + 6, curY + 4, { width: subLabelWidth - 12 });

        // Value Cell with white fill and border
        doc.rect(subTableX + subLabelWidth, curY, subValWidth, subRowHeight).fillColor('#FFFFFF').fill();
        doc.strokeColor('#202020').lineWidth(0.5).rect(subTableX + subLabelWidth, curY, subValWidth, subRowHeight).stroke();

        // Value text (Arial 9pt regular, left-aligned)
        doc.fontSize(9).font('Helvetica').fillColor('#000000');
        doc.text(String(row.val), subTableX + subLabelWidth + 8, curY + 4, {
          width: subValWidth - 16,
          align: 'left'
        });
      });

      // 6. Tax Summary Rows (Rows 39-43 in Excel)
      const summaryStartY = tableBodyEndY;
      const summaryRowHeight = 18;

      // Top line of summary section
      doc.strokeColor('#202020').lineWidth(0.5).moveTo(leftX, summaryStartY).lineTo(rightX, summaryStartY).stroke();

      // Only include the selected type of GST (exclude non-selected)
      const isIgst = (invoice.igst_amount || 0) > 0 || ((invoice.cgst_amount || 0) === 0 && (invoice.sgst_amount || 0) === 0 && (invoice.igst_rate || 0) > 0);

      const summaryRows = [
        {
          label: 'Sub- Total',
          amount: invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        }
      ];

      if (isIgst) {
        summaryRows.push({
          label: `IGST ${invoice.igst_rate || 18}%`,
          amount: invoice.igst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        });
      } else {
        summaryRows.push({
          label: `CGST ${invoice.cgst_rate || 9}%`,
          amount: invoice.cgst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        });
        summaryRows.push({
          label: `SGST ${invoice.sgst_rate || 9}%`,
          amount: invoice.sgst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        });
      }

      summaryRows.forEach((item, idx) => {
        const curY = summaryStartY + idx * summaryRowHeight;

        // Vertical lines for each summary row
        doc.strokeColor('#202020').lineWidth(0.5);
        doc.moveTo(leftX, curY).lineTo(leftX, curY + summaryRowHeight).stroke();
        doc.moveTo(colAmtX, curY).lineTo(colAmtX, curY + summaryRowHeight).stroke();
        doc.moveTo(rightX, curY).lineTo(rightX, curY + summaryRowHeight).stroke();

        // Label in Col G (right-aligned before AMOUNT column)
        doc.fontSize(9).font('Helvetica').fillColor('#000000');
        doc.text(item.label, colSacX - 40, curY + 4, {
          width: colAmtX - (colSacX - 40) - 10,
          align: 'right'
        });

        // Value in AMOUNT column (right-aligned)
        doc.fontSize(10).font('Helvetica').fillColor('#000000');
        doc.text(item.amount, colAmtX, curY + 4, {
          width: rightX - colAmtX - 10,
          align: 'right'
        });
      });

      // Spacing Row bottom line
      const rowSpacingEndY = summaryStartY + summaryRows.length * summaryRowHeight + 8;
      doc.strokeColor('#202020').lineWidth(0.5);
      doc.moveTo(leftX, summaryStartY + summaryRows.length * summaryRowHeight).lineTo(leftX, rowSpacingEndY).stroke();
      doc.moveTo(colAmtX, summaryStartY + summaryRows.length * summaryRowHeight).lineTo(colAmtX, rowSpacingEndY).stroke();
      doc.moveTo(rightX, summaryStartY + summaryRows.length * summaryRowHeight).lineTo(rightX, rowSpacingEndY).stroke();
      doc.moveTo(leftX, rowSpacingEndY).lineTo(rightX, rowSpacingEndY).stroke();

      // 7. Row 44: Grand Total Bar (Shaded #F2F2F2 in Excel)
      const grandTotalY = rowSpacingEndY;
      const grandTotalHeight = 22;

      doc.rect(leftX, grandTotalY, tableWidth, grandTotalHeight).fillColor('#F2F2F2').fill();
      doc.strokeColor('#202020').lineWidth(0.5);
      doc.moveTo(leftX, grandTotalY).lineTo(rightX, grandTotalY).stroke();
      doc.moveTo(leftX, grandTotalY + grandTotalHeight).lineTo(rightX, grandTotalY + grandTotalHeight).stroke();
      doc.moveTo(leftX, grandTotalY).lineTo(leftX, grandTotalY + grandTotalHeight).stroke();
      doc.moveTo(colAmtX, grandTotalY).lineTo(colAmtX, grandTotalY + grandTotalHeight).stroke();
      doc.moveTo(rightX, grandTotalY).lineTo(rightX, grandTotalY + grandTotalHeight).stroke();

      // Label: Grand total (Arial 10pt in Excel)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Grand total', colSacX - 40, grandTotalY + 5, {
        width: colAmtX - (colSacX - 40) - 10,
        align: 'right'
      });

      // Value: Grand total amount
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(
        invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        colAmtX,
        grandTotalY + 5,
        { width: rightX - colAmtX - 10, align: 'right' }
      );

      // 8. Row 45: Amount in Words (=SpellNumber(J44))
      const spellNumberY = grandTotalY + grandTotalHeight + 12;
      const wordsText = numberToWordsIndian(invoice.total_amount);
      doc.fontSize(10.5).font('Helvetica').fillColor('#000000');
      doc.text(wordsText, leftX, spellNumberY, { width: tableWidth });

      // 9. Bank Details display fields at bottom left
      const bankBoxY = spellNumberY + 24;
      const bankBoxWidth = 275;
      const bankBoxHeight = 84;

      doc.rect(leftX, bankBoxY, bankBoxWidth, bankBoxHeight).fillColor('#F9FAFB').fill();
      doc.strokeColor('#CBD5E1').lineWidth(0.5).rect(leftX, bankBoxY, bankBoxWidth, bankBoxHeight).stroke();

      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1E293B');
      doc.text(`BANK DETAILS (${supplierName.toUpperCase()})`, leftX + 8, bankBoxY + 6);
      doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(leftX + 8, bankBoxY + 17).lineTo(leftX + bankBoxWidth - 8, bankBoxY + 17).stroke();

      const bankName = invoice.firm_bank_name || (isVinayak ? 'ICICI Bank' : 'HDFC Bank');
      const acName = invoice.firm_account_name || (isVinayak ? 'Vinayak Associates' : 'Mavin Credit Consultant Private Limited');
      const acNo = invoice.firm_account_no || (isVinayak ? '000405001234' : '50200012345678');
      const ifsc = invoice.firm_ifsc_code || (isVinayak ? 'ICIC0000004' : 'HDFC0000240');
      const branch = invoice.firm_branch || 'Shivajinagar, Pune';

      const bankFields = [
        { label: 'Bank Name:', val: bankName },
        { label: 'A/c Name:', val: acName },
        { label: 'A/c No.:', val: acNo },
        { label: 'IFSC Code:', val: ifsc },
        { label: 'Branch:', val: branch }
      ];

      bankFields.forEach((bf, bIdx) => {
        const lineY = bankBoxY + 21 + bIdx * 11.5;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748B');
        doc.text(bf.label, leftX + 8, lineY, { width: 70 });
        doc.font('Helvetica').fillColor('#0F172A');
        doc.text(bf.val, leftX + 80, lineY, { width: bankBoxWidth - 88 });
      });

      // Signatory block at bottom right
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`For ${supplierName}`, rightX - 170, bankBoxY + 12, { width: 170, align: 'right' });
      doc.strokeColor('#202020').lineWidth(0.5).moveTo(rightX - 150, bankBoxY + 68).lineTo(rightX, bankBoxY + 68).stroke();
      doc.fontSize(8.5).font('Helvetica').fillColor('#333333');
      doc.text('Authorized Signatory', rightX - 150, bankBoxY + 72, { width: 150, align: 'center' });

      // Clean footer note at the bottom of the page
      const pageFooterY = 780;
      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(leftX, pageFooterY).lineTo(rightX, pageFooterY).stroke();
      doc.fontSize(8).font('Helvetica').fillColor('#777777');
      doc.text(`This is a computer-generated tax invoice verified by ${supplierName}.`, leftX, pageFooterY + 6);
      doc.text('Authorized Signatory', rightX - 120, pageFooterY + 6, { width: 120, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export type Role = 'Superadmin' | 'Team';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active?: number;
  created_at?: string;
}

export interface Firm {
  id: number;
  firm_name: string;
  gstin: string;
  state: string;
  state_code: string;
  address: string;
  is_active: number;
  bank_name?: string;
  account_name?: string;
  account_no?: string;
  ifsc_code?: string;
  branch?: string;
}

export interface Product {
  id: number;
  name: string;
  acronym: string;
  created_at?: string;
}

export interface SalesMember {
  id: number;
  name: string;
  created_at?: string;
}

export interface Bank {
  id: number;
  client_id: number;
  bank_name: string;
  bank_gst_no: string;
  created_at?: string;
}

export interface VoucherType {
  id: number;
  voucher_name: string;
}

export interface ReceivingAccount {
  id: number;
  account_name: string;
  bank_name: string;
  account_number: string;
  ifsc: string;
}

export type FileStatus =
  | 'WIP (Work in Progress)'
  | 'Document Pending'
  | 'IP Pending'
  | 'Valuation'
  | 'Legal'
  | 'Query'
  | 'Sanction'
  | 'Disburse'
  | 'Rejected from Bank'
  | 'Cancelled'
  | 'Hold'
  | 'Qualification Issue (Rejected by Firm)';

export const ALL_FILE_STATUSES: FileStatus[] = [
  'WIP (Work in Progress)',
  'Document Pending',
  'IP Pending',
  'Valuation',
  'Legal',
  'Query',
  'Sanction',
  'Disburse',
  'Rejected from Bank',
  'Cancelled',
  'Hold',
  'Qualification Issue (Rejected by Firm)'
];

export interface FileBankEntry {
  id?: number;
  bank_id: number;
  bank_name?: string;
  bank_gst_no?: string;
  bank_manager_name: string;
  sanction_loan_amount: number | string;
}

export interface FileRecord {
  id: string;
  login_date: string;
  client_id: number;
  company_name: string;
  gst_no: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  product_id: number;
  product_name: string;
  product_acronym: string;
  bank_id: number;
  bank_name: string;
  bank_gst_no: string;
  sales_member_id: number;
  sales_member_name: string;
  bank_manager_name: string;
  code: string;
  source?: string | null;
  sanction_loan_amount: number;
  status: FileStatus;
  firm_id?: number;
  firm_name?: string;
  banks?: FileBankEntry[];
  created_at: string;
  reviewed_at?: string | null;
  review_remarks?: string | null;
  reviewer_name?: string | null;
}

export interface DisbursementRow {
  disbursement_amount: string | number;
  disbursement_date: string;
}

export interface DisbursementRecord {
  id: number;
  file_id: string;
  disbursement_amount: number;
  disbursement_date: string;
  created_at: string;
  company_name?: string;
  client_name?: string;
  product_name?: string;
  product_acronym?: string;
  bank_name?: string;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  file_id: string;
  firm_id: number;
  invoice_date: string;
  year: number;
  month: number;
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
  firm_name_snapshot: string;
  firm_gstin_snapshot: string;
  firm_address_snapshot: string;
  client_company_snapshot: string;
  client_name_snapshot: string;
  client_email_snapshot: string;
  client_gstin_snapshot: string;
  bank_name_snapshot: string;
  product_name_snapshot: string;
  created_at: string;
}

export interface AccountsRecord {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  year: number;
  month: number;
  invoice_taxable_amount: number;
  invoice_total_amount: number;
  invoice_gst_amount?: number;
  firm_name: string;
  trade_legal_name: string;
  company_name?: string;
  client_name?: string;
  gst_no: string;
  firm_id: number;
  firm_bank_name?: string;
  firm_account_name?: string;
  firm_account_no?: string;
  firm_ifsc_code?: string;
  firm_branch?: string;
  ledger_id?: number;
  voucher_id?: number | null;
  voucher_name?: string | null;
  taxable_received_date?: string | null;
  taxable_amount?: number | null;
  taxable_bank_account_id?: number | null;
  taxable_bank_account_name?: string | null;
  taxable_status?: 'Pending' | 'Partial' | 'Complete';
  gst_received_date?: string | null;
  gst_amount?: number | null;
  gst_account_id?: number | null;
  gst_account_name?: string | null;
  gst_status?: 'Pending' | 'Partial' | 'Complete';
  tds_amount?: number | null;
  tds_received_date?: string | null;
  tds_bank_account_id?: number | null;
  tds_bank_account_name?: string | null;
  tds_section?: '194J' | '194H';
  tds_status?: 'Pending' | 'Partial' | 'Complete';
  tds_recovery_status?: 'Pending' | 'Recovered' | 'Claimed in Return' | 'Written Off';
  updated_at?: string | null;
}

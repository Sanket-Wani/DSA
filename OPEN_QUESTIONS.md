# Open Questions and Business Rules Documentation

**System:** DSA Management Software  
**Document Status:** Active / Authoritative Assumptions  
**Last Updated:** October 2026

This document records the unresolved business rules, financial assumptions, and real-world master data requirements identified during implementation, along with the concrete, safe default assumptions implemented to ensure operational stability without inventing arbitrary business data.

---

## 1. Master Data & Entity Assumptions

### 1.1 Registered Firms & GST Details
* **Open Requirement:** The exact legal entity names, registered addresses, states, and GSTINs of the operating DSA firm(s) were not provided in the specification.
* **Implemented Assumption:** 
  - A persistent relational `firms` table is created, supporting multi-firm operations.
  - Two authoritative firms are configured:
    - **Firm 1:** *Mavin Credits*
      - **GSTIN:** *27AAUCM0275A1ZH* (State code 27 - Maharashtra)
      - **State:** *Maharashtra*
      - **Address:** *Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005*
    - **Firm 2:** *Vinayak Associates*
      - **GSTIN:** *27AABCV5544K1Z8* (State code 27 - Maharashtra)
      - **State:** *Maharashtra*
      - **Address:** *Office No. 101, Vinayak Chambers, Near Swargate, Pune – 411030*
  - Create Invoices, Accounts, GST Reports, and TDS Reports use the database records from this table. If a firm's details are edited, all dropdowns and reports update automatically.
* **Production Action Needed:** Maintain real-world master data for Mavin Credits and Vinayak Associates.

---

### 1.2 Receiving Bank Accounts for Accounts Module
* **Open Requirement:** The business specification mandates that the Accounts ledger record a "Bank account" for Taxable value receipts and a "GST account" for GST collections, but did not specify the operating bank accounts or if they are separate physical accounts.
* **Implemented Assumption:**
  - A dedicated `receiving_bank_accounts` table is maintained.
  - Two default accounts are configured:
    - *HDFC Bank - Current A/C (50200012345678)*
    - *ICICI Bank - Current A/C (000405001234)*
  - The client loan bank (e.g., SBI or Axis where the client's loan is sanctioned) is strictly segregated from the DSA's receiving bank accounts.
* **Production Action Needed:** Confirm DSA firm banking credentials and whether GST collections are deposited into a dedicated statutory tax bank account or the standard operating current account.

---

### 1.3 Voucher Types for Accounts Ledger
* **Open Requirement:** The specification mandates a "Voucher" dropdown in Accounts without listing the company's chart of accounts or voucher nomenclature.
* **Implemented Assumption:**
  - Standard GAAP / Indian accounting voucher types are configured in the database:
    - `Bank Receipt` (standard customer collection via RTGS/NEFT/Cheque)
    - `Cash Receipt` (cash collections where applicable)
    - `Journal Voucher` (accounting adjustment / contra entries)
    - `Credit Note` (reconciliation adjustments)
* **Production Action Needed:** Confirm standard accounting voucher series with the company chartered accountant.

---

### 1.4 GST Rates & SAC Codes
* **Open Requirement:** The prompt requires GST calculation but notes: *"The supplied requirements do not specify the applicable GST rates, SAC-to-rate mapping, or complete firm tax configuration. Build the implementation so these values can be configured... Do not silently guess the tax rate."*
* **Implemented Assumption:**
  - A centralized `tax_rates` and `sac_codes` configuration table is implemented.
  - Baseline service classification for loan DSA services in India is configured:
    - **SAC Code:** `997159` (Other Financial Services, including loan syndication and intermediation).
    - **Applicable GST Rate:** `18.00%`.
  - Intra-state logic: If the Client's GSTIN state matches the Firm's GSTIN state (e.g., both 27 - Maharashtra), the system calculates:
    - `CGST` = 9.00%
    - `SGST` = 9.00%
    - `IGST` = 0.00%
  - Inter-state logic: If the Client's GSTIN state differs from the Firm's GSTIN state, the system calculates:
    - `CGST` = 0.00%
    - `SGST` = 0.00%
    - `IGST` = 18.00%
  - If a SAC code is entered that lacks a registered rate or if tax configuration is incomplete, the system disables invoice saving and informs the user.
* **Production Action Needed:** Verify if any non-standard or concessional SAC codes apply to specific retail vs. corporate lending products.

---

### 1.5 Invoice Numbering Convention
* **Open Requirement:** An invoice numbering rule was not specified.
* **Implemented Assumption:**
  - Formats follow standard GST compliance (`INV/YYYY-YY/XXXX` format, e.g., `INV/2026-27/0001`), ensuring uniqueness per financial year and per firm.
  - The internal system primary key (`id`) and the public invoice number (`invoice_number`) are strictly separated.
* **Production Action Needed:** Confirm if the business requires a firm-specific prefix or branch code (e.g., `APEX/MUM/26-27/001`).

---

### 1.6 Collections & Partial Receipts in Accounts
* **Open Requirement:** The initial requirements specify single fields for Taxable Value received date/amount/account and GST received date/amount/account. In commercial operations, clients or banks sometimes pay commissions across multiple tranches or deduct TDS prior to remittance.
* **Implemented Assumption:**
  - Single collection set per invoice row as strictly requested in Section 11 of the specification.
  - The schema is architected cleanly so that multiple receipts can be accommodated in future versions without breaking the current single-entry interface.
* **Production Action Needed:** Confirm whether multi-part payments should be scheduled for Phase 2.

---

### 1.7 GST and TDS Reporting Period
* **Open Requirement:** Section 12 & 13 specify filtering by Month and Year, but does not clarify whether the period refers to:
  a) The Invoice Date month/year, or
  b) The Receipt Date month/year.
* **Implemented Assumption:**
  - As instructed in Section 12/13, reports default to the **Invoice Date (Accounting period)**, while displaying the actual receipt dates and recovery statuses side-by-side.
* **Production Action Needed:** Confirm if GSTR-1 (liability by invoice date) vs GSTR-3B (cash reconciliation) requires a toggle between invoice date and receipt date.

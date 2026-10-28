# DSA Management Software

A complete, production-grade, browser-based management application for Loan Direct Selling Agents (DSA) to administer client files, multi-tranche loan disbursements, GST-compliant tax invoicing, accounts collection ledger reconciliation, and statutory GST / TDS reporting.

Strictly built in accordance with the specifications in `ui_design_system_source_of_truth.md`.

---

## 1. System Features & Modules

1. **Dashboard:** Clean, quiet workspace reserved for future executive analytics (zero fabricated or decorative charts).
2. **Telecalling:** Operational shell reserved for call queues (zero placeholder widgets).
3. **File Logged-in:**
   - Register client loan files with automatic generation of sequential IDs (`FL-YYYY-XXXX`).
   - Inline creation of products with automatic acronym generation from initials (e.g. *Loan Against Property* -> `LAP`).
   - Associate multiple lender banks with individual clients.
   - Persistent sales member master list.
   - Status workflow: `In Progress` -> `Eligible` (triggers Superadmin approval pipeline).
4. **File Approve (Superadmin Only):**
   - Strictly restricted to Superadmin via server-side authorization and UI navigation isolation.
   - Review queue for all `Eligible` files.
   - Full inspection modal, audit logging (`reviewed_by`, `reviewed_at`, decision remarks).
   - Only `Approved` files proceed downstream to disbursements and invoicing.
5. **Disbursements:**
   - Canonical lookup by File Logged-in ID with strict eligibility gate.
   - Autofetches client, company, bank, product, and case sourced data.
   - Supports multiple disbursement tranches (amounts and dates) per file in an atomic database transaction.
6. **Create Invoices:**
   - Connected directly to approved files.
   - Centralized statutory tax service calculating intra-state (CGST + SGST) or inter-state (IGST) tax based on configured firm and client state codes.
   - Generates sequential invoice numbers (`INV/YYYY-YY/XXXX`) and immutable snapshot records.
   - Generates high-fidelity vectorized **Tax Invoice PDFs** on demand using PDFKit.
7. **Accounts:**
   - Comprehensive ledger of all saved invoices with read-only source protection.
   - Expandable row interface for three financial sub-sections:
     - **Taxable Value:** Received date, amount, receiving bank account.
     - **GST:** Received date, amount, receiving GST account.
     - **TDS:** Amount, recovery status (`Pending`, `Recovered`, `Claimed in Return`, `Written Off`).
8. **GST Report:**
   - Filter by Firm, Month, and Year.
   - Retrieves linked Accounts and Invoices records.
   - Displays taxable amounts, billed GST, collected GST, receipt dates, and summary totals.
9. **TDS Report:**
   - Filter by Firm, Month, and Year.
   - Reconciles TDS deductions against Accounts recovery records.

---

## 2. Technology Architecture

- **Frontend:** React 18, TypeScript, Vite.
- **Styling:** Vanilla CSS with centralized design tokens (`tokens.css`, `reset.css`, `components.css`, `shell.css`) strictly implementing `ui_design_system_source_of_truth.md`.
- **Icons:** Monochrome outline icons via `lucide-react`.
- **Backend:** Node.js, Express, TypeScript.
- **Database:** SQLite (`better-sqlite3`) with WAL mode, foreign keys, and relational integrity.
- **PDF Engine:** PDFKit (vectorized server-side generation).

---

## 3. Getting Started

### Prerequisites
- Node.js (v18+ or v22 LTS)
- npm (v9+)

### Installation
```bash
npm install
```

### Database Initialization & Master Data Seeding
To initialize the SQLite schema and seed baseline master data (users, firms, products, voucher types, receiving banks, and tax rates):
```bash
npm run seed
```

### Running the Application (Development)
Starts both the Express backend API (`http://localhost:5000`) and the Vite frontend dev server (`http://localhost:3000`):
```bash
npm run dev
```

Open your browser at `http://localhost:3000`.

### Production Build & Deployment
```bash
# Build frontend bundle
npm run build

# Start production server
NODE_ENV=production npm start
```

---

## 4. Default Credentials & Role Switching

The database is pre-seeded with two operational accounts:

| User Name | Role | Email | Permissions |
|---|---|---|---|
| **Superadmin User** | `Superadmin` | `admin@dsa.local` | Full access to all 9 modules including **File Approve** |
| **Operations Team Member** | `Team` | `team@dsa.local` | Access to operational modules (File Approve is hidden & blocked) |

*You can instantly switch between Superadmin and Team profiles using the role switcher dropdown in the top utility bar.*

---

## 5. Running Automated Verification Tests

The project includes an end-to-end automated test runner covering all 48 criteria:
```bash
npm test
```

Tests verify:
- Product acronym generation algorithms.
- Master data and relational foreign-key constraints.
- File status workflow (`In Progress` -> `Eligible` -> `Approved` / `Rejected`).
- Role-based authorization gates (Superadmin vs Team).
- Multi-tranche disbursement entry and totals calculation.
- Centralized GST calculations (intra-state vs inter-state) and decimal precision.
- Immutable invoice snapshot persistence.
- Accounts ledger row expansion and updates.
- Real PDF generation with valid `%PDF` binary header.
- GST and TDS report aggregations.

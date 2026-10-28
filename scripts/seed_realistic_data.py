import sqlite3
from datetime import datetime

def seed_database(db_path='data/dsa.db'):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('PRAGMA foreign_keys = OFF')

    # Ensure accounts_ledger has all new columns
    ledger_cols = [col[1] for col in c.execute("PRAGMA table_info(accounts_ledger)").fetchall()]
    if 'taxable_status' not in ledger_cols:
        c.execute("ALTER TABLE accounts_ledger ADD COLUMN taxable_status TEXT DEFAULT 'Pending'")
    if 'gst_status' not in ledger_cols:
        c.execute("ALTER TABLE accounts_ledger ADD COLUMN gst_status TEXT DEFAULT 'Pending'")
    if 'tds_status' not in ledger_cols:
        c.execute("ALTER TABLE accounts_ledger ADD COLUMN tds_status TEXT DEFAULT 'Pending'")
    if 'tds_received_date' not in ledger_cols:
        c.execute("ALTER TABLE accounts_ledger ADD COLUMN tds_received_date TEXT")
    if 'tds_bank_account_id' not in ledger_cols:
        c.execute("ALTER TABLE accounts_ledger ADD COLUMN tds_bank_account_id INTEGER REFERENCES receiving_bank_accounts(id)")
    if 'tds_section' not in ledger_cols:
        c.execute("ALTER TABLE accounts_ledger ADD COLUMN tds_section TEXT DEFAULT '194J'")

    # 1. Clear existing operational records
    c.execute('DELETE FROM file_banks')
    c.execute('DELETE FROM disbursements')
    c.execute('DELETE FROM accounts_ledger')
    c.execute('DELETE FROM invoices')
    c.execute('DELETE FROM files')
    c.execute('DELETE FROM clients')
    c.execute('DELETE FROM banks')

    now = datetime.utcnow().isoformat() + 'Z'

    # 2. Insert the 10 Requested Banks
    requested_banks = [
        (1, 1, 'State Bank of India', '27AAACS8577K1ZQ', now),
        (2, 1, 'HDFC Bank', '27AAACH2702H1ZQ', now),
        (3, 1, 'ICICI Bank', '27AAACI4740K1ZB', now),
        (4, 1, 'Axis Bank', '27AAACA0182E1ZS', now),
        (5, 1, 'Punjab National Bank', '27AAACP0168G1Z0', now),
        (6, 1, 'Bank of Baroda', '27AAACB2308H1ZU', now),
        (7, 1, 'Kotak Mahindra Bank', '27AAACK1313H1ZK', now),
        (8, 1, 'Union Bank of India', '27AAACU0580N1ZT', now),
        (9, 1, 'Canara Bank', '27AAACC6106D1ZM', now),
        (10, 1, 'IDFC FIRST Bank', '27AAACI7227F1ZW', now),
    ]

    for b in requested_banks:
        c.execute('INSERT INTO banks (id, client_id, bank_name, bank_gst_no, created_at) VALUES (?, ?, ?, ?, ?)', b)

    # 3. Insert Realistic Clients
    clients_data = [
        (1, 'Apex Precision Engineering Pvt Ltd', '27AABCA5432B1Z8', 'Vikram Kulkarni', 'vikram@apexeng.in', '9822014589', now),
        (2, 'Sterling Logistics & Warehousing LLP', '27AAKCS9876C1Z4', 'Rajiv Deshmukh', 'rajiv@sterlinglogistics.in', '9823126790', now),
        (3, 'Nova BioPharma Laboratories Ltd', '27AABCN8765D1Z2', 'Dr. Sneha Joshi', 'sneha@novabio.com', '9890145236', now),
        (4, 'Kalyani Auto Components Pvt Ltd', '27AABCK4321E1Z0', 'Sachin Kalyani', 'sachin@kalyaniauto.com', '9850234187', now),
        (5, 'Sahyadri Agro Processing Industries', '27AAECS7654F1ZY', 'Nitin Patil', 'nitin@sahyadriagro.in', '9860451298', now),
        (6, 'Zenith Cloud Technologies Pvt Ltd', '27AABCZ3210G1ZW', 'Ananya Roy', 'ananya@zenithcloud.io', '9822784512', now),
        (7, 'Mahalaxmi Textiles & Retail Traders', '27AAXPS6543H1ZU', 'Gopal Shinde', 'gopal@mahalaxmitex.com', '9890234567', now),
        (8, 'Varun Infra Developers & Builders', '27AABCV2109I1ZS', 'Rohan Varun', 'rohan@varuninfra.in', '9823567891', now),
        (9, 'Trident Packaging Solutions LLP', '27AAACT1098J1ZQ', 'Manish Agarwal', 'manish@tridentpack.com', '9850123478', now),
        (10, 'Pinnacle Diagnostics & Hospitals', '27AABCP0987K1ZO', 'Dr. Mahesh Kadam', 'drkadam@pinnacledx.com', '9860345612', now),
        (11, 'Oasis Hospitality & Banquets', '27AAACF9876L1ZM', 'Farhan Shaikh', 'farhan@oasishotel.in', '9822456789', now),
        (12, 'Supreme Polychem Industries', '27AABCS8765M1ZK', 'Dinesh Shah', 'dinesh@supremepoly.in', '9890567812', now),
    ]

    for cl in clients_data:
        c.execute('INSERT INTO clients (id, company_name, gst_no, client_name, client_email, client_phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', cl)

    # 4. Insert Active Files (File Logged-in Section)
    active_files = [
        ('26-BLX-001', '2026-10-22', 1, 1, 1, 1, 'Sanjay Deshpande', 'DIR-781', 'Direct Client Referral', 7500000, 'WIP (Work in Progress)', 1, '2026-10-22T09:30:00Z', 1),
        ('26-LAP-002', '2026-10-23', 2, 2, 8, 2, 'Rahul Kapoor', 'CON-412', 'Chartered Accountant Network', 15000000, 'Valuation', 1, '2026-10-23T10:15:00Z', 2),
        ('26-CFX-003', '2026-10-24', 8, 3, 2, 3, 'Deepak Sawant', 'REF-904', 'Corporate Channel Partner', 30000000, 'Legal', 1, '2026-10-24T11:00:00Z', 2),
        ('26-ODX-004', '2026-10-25', 4, 4, 12, 1, 'Meera Iyer', 'DIR-822', 'Branch Walk-in', 8500000, 'Sanction', 1, '2026-10-25T14:20:00Z', 1),
        ('26-TLX-005', '2026-10-26', 5, 6, 14, 2, 'Vikas Rao', 'DIR-319', 'Vendor Financing Tie-up', 6000000, 'Query', 1, '2026-10-26T15:00:00Z', 1),
        ('26-MLX-006', '2026-10-27', 9, 7, 11, 3, 'Sunil More', 'EXP-551', 'Industrial Exhibition Lead', 4500000, 'Document Pending', 1, '2026-10-27T16:45:00Z', 2),
        ('26-HLX-007', '2026-10-28', 7, 8, 6, 1, 'Anil Joshi', 'RET-108', 'Retail Channel Lead', 9000000, 'IP Pending', 1, '2026-10-28T11:30:00Z', 1),
    ]

    for f in active_files:
        c.execute('''
            INSERT INTO files (id, login_date, client_id, bank_id, product_id, sales_member_id, bank_manager_name, code, source, sanction_loan_amount, status, created_by, created_at, firm_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', f)

    # File banks for multi-bank support on active files
    c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
              ('26-BLX-001', 1, 'Sanjay Deshpande', 7500000, now))
    c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
              ('26-LAP-002', 2, 'Rahul Kapoor', 15000000, now))
    c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
              ('26-CFX-003', 3, 'Deepak Sawant', 30000000, now))
    c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
              ('26-ODX-004', 4, 'Meera Iyer', 8500000, now))
    c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
              ('26-TLX-005', 6, 'Vikas Rao', 6000000, now))
    c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
              ('26-TLX-005', 5, 'Kavita Sen', 4000000, now))
    c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
              ('26-MLX-006', 7, 'Sunil More', 4500000, now))
    c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
              ('26-HLX-007', 8, 'Anil Joshi', 9000000, now))

    # 5. Insert Disbursed Files (Disbursements Section)
    disbursed_files = [
        ('26-BLX-010', '2026-09-15', 3, 2, 1, 1, 'Rahul Kapoor', 'DIR-101', 'Direct Lead', 10000000, 'Disburse', 1, '2026-09-15T10:00:00Z', 1),
        ('26-LAP-011', '2026-09-20', 6, 3, 8, 2, 'Deepak Sawant', 'CON-202', 'Chartered Accountant Lead', 8000000, 'Disburse', 1, '2026-09-20T11:30:00Z', 2),
        ('26-TLX-012', '2026-09-25', 10, 1, 14, 1, 'Sanjay Deshpande', 'REF-303', 'Hospital Channel Partner', 12000000, 'Disburse', 1, '2026-09-25T14:00:00Z', 1),
        ('26-CFX-013', '2026-10-01', 11, 4, 2, 3, 'Meera Iyer', 'DIR-404', 'Corporate Banking Tie-up', 20000000, 'Disburse', 1, '2026-10-01T15:30:00Z', 2),
        ('26-MLX-014', '2026-10-05', 12, 9, 11, 2, 'Pradeep Nambiar', 'DIR-505', 'Machine Manufacturer Tie-up', 5000000, 'Disburse', 1, '2026-10-05T16:00:00Z', 1),
    ]

    for f in disbursed_files:
        c.execute('''
            INSERT INTO files (id, login_date, client_id, bank_id, product_id, sales_member_id, bank_manager_name, code, source, sanction_loan_amount, status, created_by, created_at, firm_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', f)

    for f in disbursed_files:
        c.execute('INSERT INTO file_banks (file_id, bank_id, bank_manager_name, sanction_loan_amount, created_at) VALUES (?, ?, ?, ?, ?)',
                  (f[0], f[3], f[6], f[9], f[12]))

    # 6. Insert Disbursements Tranches
    disbursements_data = [
        # 26-BLX-010 (Sanction 1,00,00,000 -> 60L + 40L = 100L, Remaining 0)
        ('26-BLX-010', 6000000, '2026-09-28', '2026-09-28T12:00:00Z'),
        ('26-BLX-010', 4000000, '2026-10-15', '2026-10-15T14:30:00Z'),
        # 26-LAP-011 (Sanction 80,00,000 -> 50L + 15L = 65L, Remaining 15L)
        ('26-LAP-011', 5000000, '2026-10-05', '2026-10-05T10:15:00Z'),
        ('26-LAP-011', 1500000, '2026-10-20', '2026-10-20T16:00:00Z'),
        # 26-TLX-012 (Sanction 1,20,00,000 -> 70L, Remaining 50L)
        ('26-TLX-012', 7000000, '2026-10-10', '2026-10-10T11:45:00Z'),
        # 26-CFX-013 (Sanction 2,00,00,000 -> 100L + 50L = 150L, Remaining 50L)
        ('26-CFX-013', 10000000, '2026-10-18', '2026-10-18T13:00:00Z'),
        ('26-CFX-013', 5000000, '2026-10-25', '2026-10-25T15:20:00Z'),
        # 26-MLX-014 (Sanction 50,00,000 -> 50L, Remaining 0)
        ('26-MLX-014', 5000000, '2026-10-22', '2026-10-22T10:00:00Z'),
    ]

    for d in disbursements_data:
        c.execute('INSERT INTO disbursements (file_id, disbursement_amount, disbursement_date, created_at) VALUES (?, ?, ?, ?)', d)

    # 7. Insert Invoices & Accounts Ledger Records
    invoices_data = [
        # Invoice 1: Complete (Green) for 26-BLX-010 (Mavin Credits)
        (
            'inv-001', 'INV/2026-27/0001', '26-BLX-010', 1, '2026-10-01', 2026, 10,
            'LA-HDFC-99124', 'MCF-001', 10000000, '997119', 100000.0,
            9.0, 9000.0, 9.0, 9000.0, 0.0, 0.0, 118000.0,
            'Mavin Credits', '27AAUCM0275A1ZH', 'Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005',
            'Nova BioPharma Laboratories Ltd', 'Dr. Sneha Joshi', 'sneha@novabio.com', '27AABCN8765D1Z2',
            'HDFC Bank', 'Business Loan', 1, '2026-10-01T10:00:00Z'
        ),
        # Invoice 2: Partial (Yellow) for 26-LAP-011 (Vinayak Associates)
        (
            'inv-002', 'INV/2026-27/0002', '26-LAP-011', 2, '2026-10-12', 2026, 10,
            'LA-ICICI-88231', 'MCF-002', 6500000, '997119', 81250.0,
            9.0, 7312.5, 9.0, 7312.5, 0.0, 0.0, 95875.0,
            'Vinayak Associates', '27AABCV5544K1Z8', 'Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005',
            'Zenith Cloud Technologies Pvt Ltd', 'Ananya Roy', 'ananya@zenithcloud.io', '27AABCZ3210G1ZW',
            'ICICI Bank', 'Loan Against Property', 1, '2026-10-12T11:00:00Z'
        ),
        # Invoice 3: Pending (Red) for 26-TLX-012 (Mavin Credits)
        (
            'inv-003', 'INV/2026-27/0003', '26-TLX-012', 1, '2026-10-22', 2026, 10,
            'LA-SBI-77341', 'MCF-003', 7000000, '997119', 70000.0,
            9.0, 6300.0, 9.0, 6300.0, 0.0, 0.0, 82600.0,
            'Mavin Credits', '27AAUCM0275A1ZH', 'Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005',
            'Pinnacle Diagnostics & Hospitals', 'Dr. Mahesh Kadam', 'drkadam@pinnacledx.com', '27AABCP0987K1ZO',
            'State Bank of India', 'Term Loan', 1, '2026-10-22T14:30:00Z'
        ),
        # Invoice 4: Pending (Red) for 26-CFX-013 (Vinayak Associates)
        (
            'inv-004', 'INV/2026-27/0004', '26-CFX-013', 2, '2026-10-26', 2026, 10,
            'LA-AXIS-66412', 'MCF-004', 15000000, '997119', 112500.0,
            9.0, 10125.0, 9.0, 10125.0, 0.0, 0.0, 132750.0,
            'Vinayak Associates', '27AABCV5544K1Z8', 'Office No. 502, Varun Capital, Off J. M. Road, Shivajinagar, Pune – 411005',
            'Oasis Hospitality & Banquets', 'Farhan Shaikh', 'farhan@oasishotel.in', '27AAACF9876L1ZM',
            'Axis Bank', 'Construction Finance', 1, '2026-10-26T16:00:00Z'
        ),
    ]

    for inv in invoices_data:
        c.execute('''
            INSERT INTO invoices (
                id, invoice_number, file_id, firm_id, invoice_date, year, month,
                loan_account_no, mcf_no, disbursement_amount, sac, amount,
                cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_amount,
                firm_name_snapshot, firm_gstin_snapshot, firm_address_snapshot,
                client_company_snapshot, client_name_snapshot, client_email_snapshot, client_gstin_snapshot,
                bank_name_snapshot, product_name_snapshot, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', inv)

    # Accounts Ledger Rows:
    # 1. inv-001 (Complete, Green): Taxable = 1,00,000, GST = 18,000, TDS = 2,000 (2% 194J)
    c.execute('''
        INSERT INTO accounts_ledger (
            invoice_id, voucher_id,
            taxable_received_date, taxable_amount, taxable_bank_account_id, taxable_status,
            gst_received_date, gst_amount, gst_account_id, gst_status,
            tds_amount, tds_received_date, tds_bank_account_id, tds_section, tds_status, tds_recovery_status,
            updated_at, updated_by
        ) VALUES (
            'inv-001', 1,
            '2026-10-10', 100000.0, 1, 'Complete',
            '2026-10-12', 18000.0, 1, 'Complete',
            2000.0, '2026-10-15', 1, '194J', 'Complete', 'Recovered',
            '2026-10-15T15:00:00Z', 1
        )
    ''')

    # 2. inv-002 (Partial, Yellow): Taxable = 50,000 of 81,250, GST = 14,625, TDS = 0 of 1,625
    c.execute('''
        INSERT INTO accounts_ledger (
            invoice_id, voucher_id,
            taxable_received_date, taxable_amount, taxable_bank_account_id, taxable_status,
            gst_received_date, gst_amount, gst_account_id, gst_status,
            tds_amount, tds_received_date, tds_bank_account_id, tds_section, tds_status, tds_recovery_status,
            updated_at, updated_by
        ) VALUES (
            'inv-002', 1,
            '2026-10-18', 50000.0, 2, 'Partial',
            '2026-10-20', 14625.0, 2, 'Complete',
            0.0, NULL, 2, '194J', 'Pending', 'Pending',
            '2026-10-20T17:00:00Z', 1
        )
    ''')

    # 3. inv-003 (Pending, Red): Taxable = 0, GST = 0, TDS = 0
    c.execute('''
        INSERT INTO accounts_ledger (
            invoice_id, voucher_id,
            taxable_received_date, taxable_amount, taxable_bank_account_id, taxable_status,
            gst_received_date, gst_amount, gst_account_id, gst_status,
            tds_amount, tds_received_date, tds_bank_account_id, tds_section, tds_status, tds_recovery_status,
            updated_at, updated_by
        ) VALUES (
            'inv-003', 1,
            NULL, 0.0, 1, 'Pending',
            NULL, 0.0, 1, 'Pending',
            0.0, NULL, 1, '194J', 'Pending', 'Pending',
            ?, 1
        )
    ''', (now,))

    # 4. inv-004 (Pending, Red): Taxable = 0, GST = 0, TDS = 0 (194H 10%)
    c.execute('''
        INSERT INTO accounts_ledger (
            invoice_id, voucher_id,
            taxable_received_date, taxable_amount, taxable_bank_account_id, taxable_status,
            gst_received_date, gst_amount, gst_account_id, gst_status,
            tds_amount, tds_received_date, tds_bank_account_id, tds_section, tds_status, tds_recovery_status,
            updated_at, updated_by
        ) VALUES (
            'inv-004', 1,
            NULL, 0.0, 2, 'Pending',
            NULL, 0.0, 2, 'Pending',
            0.0, NULL, 2, '194H', 'Pending', 'Pending',
            ?, 1
        )
    ''', (now,))

    conn.commit()
    c.execute('PRAGMA foreign_keys = ON')
    conn.close()
    print("Database seeding completed successfully.")

if __name__ == '__main__':
    seed_database()

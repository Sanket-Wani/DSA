import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Disc,
  Grid3x3,
  FileSpreadsheet,
  UploadCloud,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Clock,
  ShieldCheck,
  Check,
  RotateCcw
} from 'lucide-react';
import { Button } from '../components/Button.js';

export interface LeadContact {
  id: string;
  name: string;
  rawPhone: string;
  maskedPhone: string;
  status: 'pending' | 'in-call' | 'completed';
  callDuration?: number; // seconds
  disposition?: string;
  notes?: string;
}

export interface ActiveCallState {
  contactId: string;
  name: string;
  maskedPhone: string;
  rawPhone: string;
  status: 'dialing' | 'connected';
  duration: number; // in seconds
  isMuted: boolean;
  isSpeaker: boolean;
  isRecording: boolean;
  showKeypad: boolean;
  keypadInput: string;
  disposition: string;
  notes: string;
}

// Utility to mask phone numbers safely: preserves privacy while remaining recognizable
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '—';
  const cleaned = String(phone).replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('+91') && cleaned.length >= 12) {
    const core = cleaned.slice(3);
    if (core.length >= 10) {
      return `+91 ${core.slice(0, 2)}******${core.slice(-2)}`;
    }
    return `+91 ${core.slice(0, 2)}****${core.slice(-2)}`;
  } else if (cleaned.startsWith('91') && cleaned.length >= 12) {
    const core = cleaned.slice(2);
    if (core.length >= 10) {
      return `+91 ${core.slice(0, 2)}******${core.slice(-2)}`;
    }
  }

  // Standard 10 digit Indian number: 9876543210 -> 98******10
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}******${cleaned.slice(8)}`;
  } else if (cleaned.length > 6) {
    const visibleStart = Math.min(2, Math.floor(cleaned.length / 4));
    const visibleEnd = Math.min(2, Math.floor(cleaned.length / 4));
    const maskLen = cleaned.length - visibleStart - visibleEnd;
    return `${cleaned.slice(0, visibleStart)}${'*'.repeat(Math.max(maskLen, 4))}${cleaned.slice(-visibleEnd)}`;
  }
  return cleaned.slice(0, 2) + '****';
}

// Format seconds into MM:SS
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Initial dummy lead contacts for demonstration and immediate workflow readiness
const INITIAL_DUMMY_CONTACTS: LeadContact[] = [
  {
    id: 'lead-dummy-1',
    name: 'Rahul Sharma',
    rawPhone: '9820112345',
    maskedPhone: '98******45',
    status: 'pending'
  },
  {
    id: 'lead-dummy-2',
    name: 'Priya Deshmukh',
    rawPhone: '9819234567',
    maskedPhone: '98******67',
    status: 'completed',
    callDuration: 142,
    disposition: 'Interested - Follow Up Scheduled',
    notes: 'Interested in business loan of ₹25 Lakhs. Follow up on Monday.'
  },
  {
    id: 'lead-dummy-3',
    name: 'Amit Kulkarni',
    rawPhone: '9867345678',
    maskedPhone: '98******78',
    status: 'pending'
  },
  {
    id: 'lead-dummy-4',
    name: 'Neha Joshi',
    rawPhone: '9833456789',
    maskedPhone: '98******89',
    status: 'pending'
  },
  {
    id: 'lead-dummy-5',
    name: 'Vikram Patil',
    rawPhone: '9822567890',
    maskedPhone: '98******90',
    status: 'completed',
    callDuration: 85,
    disposition: 'Documents Required',
    notes: 'Requested checklist of ITR and bank statement documents via WhatsApp.'
  },
  {
    id: 'lead-dummy-6',
    name: 'Ananya Verma',
    rawPhone: '9845671234',
    maskedPhone: '98******34',
    status: 'pending'
  },
  {
    id: 'lead-dummy-7',
    name: 'Suresh Bhosale',
    rawPhone: '9890123456',
    maskedPhone: '98******56',
    status: 'pending'
  },
  {
    id: 'lead-dummy-8',
    name: 'Pooja Mehta',
    rawPhone: '9870987654',
    maskedPhone: '98******54',
    status: 'pending'
  }
];

export const Telecalling: React.FC = () => {
  // Section 1: Upload state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section 2: Contacts queue state initialized with dummy records
  const [contacts, setContacts] = useState<LeadContact[]>(INITIAL_DUMMY_CONTACTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed'>('all');

  // Section 3: Active Call state (empty when not calling)
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  // Sound oscillator for DTMF keypad feedback
  const playBeep = (freq = 440) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable or blocked by user gesture
    }
  };

  // Timer for active call duration
  useEffect(() => {
    if (!activeCall) return;

    // Simulate connecting -> connected after 1.4s
    const connectTimer = setTimeout(() => {
      setActiveCall(prev => (prev ? { ...prev, status: 'connected' } : null));
    }, 1400);

    // Live ticking timer
    const interval = setInterval(() => {
      setActiveCall(prev => {
        if (!prev) return null;
        if (prev.status === 'connected') {
          return { ...prev, duration: prev.duration + 1 };
        }
        return prev;
      });
    }, 1000);

    return () => {
      clearTimeout(connectTimer);
      clearInterval(interval);
    };
  }, [activeCall?.contactId]);

  // Handle parsing uploaded file (Excel / CSV)
  const handleProcessFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => fileNameLower.endsWith(ext));

    if (!hasValidExt) {
      setUploadError('Invalid file type. Please upload only Excel (.xlsx, .xls) or CSV (.csv) files.');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      if (!workbook.SheetNames.length) {
        setUploadError('The uploaded workbook contains no sheets.');
        return;
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!rawRows || rawRows.length < 2) {
        setUploadError("The file does not have enough data. Please include a header row and at least one contact row.");
        return;
      }

      // Identify header row
      const headerRow = rawRows[0].map(h => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

      // Column name checks
      const nameHeaders = ['name', 'fullname', 'clientname', 'customername', 'contactname', 'leadname', 'borrowername', 'applicantname', 'person'];
      const phoneHeaders = ['phone', 'phonenumber', 'phoneno', 'mobile', 'mobilenumber', 'mobileno', 'contact', 'contactnumber', 'contactno', 'cell', 'tel', 'telephone'];

      const nameIndex = headerRow.findIndex(h => nameHeaders.includes(h));
      const phoneIndex = headerRow.findIndex(h => phoneHeaders.includes(h));

      // STRICT VALIDATION: "it would only accept excels/csv with name and phone number parameter."
      if (nameIndex === -1 || phoneIndex === -1) {
        const foundCols = rawRows[0].filter(Boolean).join(', ') || 'None';
        setUploadError(
          `Invalid file structure! The file must contain both 'Name' and 'Phone Number' columns. Found columns: [${foundCols}]. Please check your headers and upload again.`
        );
        return;
      }

      // Parse data rows
      const parsedContacts: LeadContact[] = [];
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const rawName = String(row[nameIndex] ?? '').trim();
        const rawPhone = String(row[phoneIndex] ?? '').trim();

        if (rawName && rawPhone) {
          parsedContacts.push({
            id: `lead-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            name: rawName,
            rawPhone,
            maskedPhone: maskPhoneNumber(rawPhone),
            status: 'pending'
          });
        }
      }

      if (parsedContacts.length === 0) {
        setUploadError("No valid rows found. Please make sure the rows contain both Name and Phone Number.");
        return;
      }

      setContacts(parsedContacts);
      setUploadedFileName(file.name);
      setUploadSuccess(`Successfully loaded ${parsedContacts.length} contacts from "${file.name}"!`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setUploadError(`Failed to parse file: ${err.message || 'Unknown error'}`);
    }
  };

  // Download sample template (.csv)
  const handleDownloadSample = () => {
    const sampleData = [
      { 'Name': 'Rahul Sharma', 'Phone Number': '9820112345' },
      { 'Name': 'Priya Deshmukh', 'Phone Number': '9819234567' },
      { 'Name': 'Amit Kulkarni', 'Phone Number': '9867345678' },
      { 'Name': 'Neha Joshi', 'Phone Number': '9833456789' },
      { 'Name': 'Vikram Patil', 'Phone Number': '9822567890' },
      { 'Name': 'Ananya Verma', 'Phone Number': '9845671234' }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'telecalling_sample_template.xlsx');
  };

  // Start Call handler (triggered from Section 2 Call button)
  const handleStartCall = (contact: LeadContact) => {
    // If already in a call, prompt or automatically end previous
    if (activeCall && activeCall.contactId === contact.id) {
      return;
    }

    // Set contact as in-call
    setContacts(prev =>
      prev.map(c => (c.id === contact.id ? { ...c, status: 'in-call' } : c))
    );

    // Initialize Active Call in Section 3
    setActiveCall({
      contactId: contact.id,
      name: contact.name,
      maskedPhone: contact.maskedPhone,
      rawPhone: contact.rawPhone,
      status: 'dialing',
      duration: 0,
      isMuted: false,
      isSpeaker: true,
      isRecording: false,
      showKeypad: false,
      keypadInput: '',
      disposition: '',
      notes: ''
    });

    playBeep(520);
  };

  // End Call handler (Section 3)
  const handleEndCall = () => {
    if (!activeCall) return;

    const finalDuration = activeCall.duration;
    const finalDisposition = activeCall.disposition;
    const finalNotes = activeCall.notes;

    // Update the contact's record in Section 2
    setContacts(prev =>
      prev.map(c =>
        c.id === activeCall.contactId
          ? {
              ...c,
              status: 'completed',
              callDuration: finalDuration,
              disposition: finalDisposition || 'Completed',
              notes: finalNotes
            }
          : c
      )
    );

    playBeep(320);

    // Empty the Section 3 Calling Screen as instructed
    setActiveCall(null);
  };

  // Filter contacts list based on search and tab
  const filteredContacts = contacts.filter(contact => {
    if (filterTab === 'pending' && contact.status === 'completed') return false;
    if (filterTab === 'completed' && contact.status !== 'completed') return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      contact.name.toLowerCase().includes(q) ||
      contact.maskedPhone.toLowerCase().includes(q) ||
      contact.rawPhone.includes(q)
    );
  });

  const totalCount = contacts.length;
  const completedCount = contacts.filter(c => c.status === 'completed').length;
  const pendingCount = totalCount - completedCount;

  return (
    <div className="page-content" style={{ maxWidth: '1600px', margin: '0 auto', paddingTop: '16px' }}>
      {/* Dynamic Keyframe & Audio wave animations */}
      <style>{`
        @keyframes pulseRing {
          0% {
            transform: scale(0.92);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45);
          }
          70% {
            transform: scale(1.04);
            box-shadow: 0 0 0 20px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(0.92);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        @keyframes waveBar {
          0%, 100% {
            height: 6px;
            opacity: 0.35;
          }
          50% {
            height: 38px;
            opacity: 1;
          }
        }

        @keyframes blinkRec {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }

        .dropzone-hover {
          border-color: #2563eb !important;
          background-color: #f0f7ff !important;
        }

        .call-btn-pulse {
          animation: pulseRing 1.6s infinite ease-in-out;
        }
      `}</style>

      {/* ========================================================================= */}
      {/* 3-SECTION LAYOUT MATCHING USER HANDDRAWN WIREFRAME                        */}
      {/* Left Column: Top = Upload Section, Bottom = Contacts Table                 */}
      {/* Right Column: Full height = Calling Dialer                                */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(500px, 1.25fr) minmax(420px, 0.95fr)',
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* ======================================================================= */}
        {/* LEFT COLUMN: Section 1 (Upload) & Section 2 (Contacts List)             */}
        {/* ======================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* --------------------------------------------------------------------- */}
          {/* SECTION 1: UPLOAD EXCEL / CSV FILE OPTION                             */}
          {/* --------------------------------------------------------------------- */}
          <div
            className="panel"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '10px',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px'
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    margin: 0,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FileSpreadsheet size={18} color="#2563eb" />
                  Upload Leads (Excel / CSV)
                </h2>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
                  Accepts files with <strong style={{ color: '#1e293b' }}>Name</strong> and{' '}
                  <strong style={{ color: '#1e293b' }}>Phone Number</strong> columns.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {uploadedFileName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '6px',
                        color: '#475569'
                      }}
                    >
                      {uploadedFileName}
                    </span>
                    <button
                      onClick={() => {
                        setContacts(INITIAL_DUMMY_CONTACTS);
                        setUploadedFileName(null);
                        setUploadSuccess(null);
                        setUploadError(null);
                      }}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Reset uploaded leads"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadSample}
                  icon={<Download size={14} />}
                  title="Download Excel template with sample Name and Phone Number columns"
                >
                  Sample Template
                </Button>
              </div>
            </div>

            {/* Hidden Input for file selection */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleProcessFile(file);
              }}
            />

            {/* Drag & Drop Zone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={isDragging ? 'dropzone-hover' : ''}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '24px 20px',
                textAlign: 'center',
                backgroundColor: isDragging ? '#eff6ff' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px auto'
                }}
              >
                <UploadCloud size={22} color="#0284c7" />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                Click to browse or drag and drop your file here
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
              </div>
            </div>

            {/* Error Message */}
            {uploadError && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#991b1b'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Success Message */}
            {uploadSuccess && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#166534'
                }}
              >
                <CheckCircle2 size={16} color="#16a34a" />
                <span>{uploadSuccess}</span>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* SECTION 2: CONTACTS QUEUE (NAME, PHONE NUMBER MASKED, CALL BUTTON)     */}
          {/* --------------------------------------------------------------------- */}
          <div
            className="panel"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '10px',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            {/* Header & Search */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Calling Queue
                  </h2>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '12px',
                      color: '#475569'
                    }}
                  >
                    {filteredContacts.length}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  3 Columns: Name, Masked Phone Number, and Calling Action
                </div>
              </div>

              {/* Search & Filter tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="search-box" style={{ width: '200px' }}>
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search name/phone..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="input-control"
                    style={{ height: '32px', fontSize: '12px' }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '6px',
                    padding: '2px'
                  }}
                >
                  <button
                    onClick={() => setFilterTab('all')}
                    style={{
                      border: 'none',
                      backgroundColor: filterTab === 'all' ? '#ffffff' : 'transparent',
                      color: filterTab === 'all' ? '#0f172a' : '#64748b',
                      fontWeight: filterTab === 'all' ? 700 : 500,
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterTab('pending')}
                    style={{
                      border: 'none',
                      backgroundColor: filterTab === 'pending' ? '#ffffff' : 'transparent',
                      color: filterTab === 'pending' ? '#0f172a' : '#64748b',
                      fontWeight: filterTab === 'pending' ? 700 : 500,
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setFilterTab('completed')}
                    style={{
                      border: 'none',
                      backgroundColor: filterTab === 'completed' ? '#ffffff' : 'transparent',
                      color: filterTab === 'completed' ? '#0f172a' : '#64748b',
                      fontWeight: filterTab === 'completed' ? 700 : 500,
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>

            {/* Table: 3 Columns (Name, Phone Number (Masked), Call Button) */}
            <div
              className="table-container"
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                maxHeight: '480px',
                overflowY: 'auto'
              }}
            >
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ width: '45%' }}>Name</th>
                    <th style={{ width: '35%' }}>Phone Number (Masked)</th>
                    <th style={{ width: '20%', textAlign: 'center' }}>Call Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '40px 16px' }}>
                        <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                          {contacts.length === 0
                            ? 'No contacts uploaded yet'
                            : 'No contacts match your search'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                          {contacts.length === 0
                            ? 'Upload an Excel or CSV file in the section above to automatically populate contacts.'
                            : 'Try adjusting your search query or switching tabs.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact, idx) => {
                      const isCurrentInCall = activeCall?.contactId === contact.id;
                      const isCompleted = contact.status === 'completed';

                      return (
                        <tr
                          key={contact.id}
                          style={{
                            backgroundColor: isCurrentInCall
                              ? '#f0fdf4'
                              : idx % 2 === 1
                              ? '#fafafa'
                              : '#ffffff',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {/* Column 1: Name */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: isCurrentInCall
                                    ? '#dcfce7'
                                    : isCompleted
                                    ? '#e0e7ff'
                                    : '#f1f5f9',
                                  color: isCurrentInCall
                                    ? '#15803d'
                                    : isCompleted
                                    ? '#4338ca'
                                    : '#475569',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                {contact.name
                                  .split(' ')
                                  .map(p => p[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                                  {contact.name}
                                </div>
                                {isCompleted && (
                                  <div style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                    <Check size={11} />
                                    <span>Called • {formatDuration(contact.callDuration || 0)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Column 2: Phone Number (Masked) */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ShieldCheck size={14} color="#059669" />
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: '#334155',
                                  letterSpacing: '0.04em'
                                }}
                              >
                                {contact.maskedPhone}
                              </span>
                            </div>
                          </td>

                          {/* Column 3: Call Button */}
                          <td style={{ textAlign: 'center' }}>
                            {isCurrentInCall ? (
                              <button
                                onClick={handleEndCall}
                                style={{
                                  backgroundColor: '#dc2626',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                                title="End active call"
                              >
                                <PhoneOff size={13} />
                                In Call
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartCall(contact)}
                                style={{
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 14px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)',
                                  transition: 'background-color 0.15s ease'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#15803d')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#16a34a')}
                                title={`Initiate call to ${contact.name}`}
                              >
                                <Phone size={13} />
                                Call
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: SECTION 3 (CALLING DIALER / PHONE SCREEN)                 */}
        {/* Strictly empty when idle; loads only when Call button is clicked       */}
        {/* ======================================================================= */}
        <div style={{ position: 'sticky', top: '24px' }}>
          {!activeCall ? (
            /* EMPTY STATE: "the calling section would be empty when the user has not clicked on the phone button" */
            <div
              className="panel"
              style={{
                minHeight: '640px',
                backgroundColor: '#ffffff',
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 24px',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <PhoneCall size={32} color="#94a3b8" />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Calling Dialer Inactive
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '300px', lineHeight: 1.5 }}>
                Click on the green <strong style={{ color: '#16a34a' }}>Call</strong> button next to any contact in the queue to initiate a live outbound telecall.
              </div>
            </div>
          ) : (
            /* ACTIVE PHONE CALLING SCREEN */
            <div
              className="panel"
              style={{
                minHeight: '640px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '16px',
                padding: '28px 24px',
                color: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Top Status Bar */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #1e293b',
                    paddingBottom: '14px',
                    marginBottom: '20px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        backgroundColor: activeCall.status === 'connected' ? '#10b981' : '#f59e0b',
                        boxShadow: activeCall.status === 'connected' ? '0 0 8px #10b981' : '0 0 8px #f59e0b'
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: activeCall.status === 'connected' ? '#34d399' : '#fbbf24' }}>
                      {activeCall.status === 'connected' ? 'Connected' : 'Dialing...'}
                    </span>
                  </div>

                  {/* Recording indicator */}
                  {activeCall.isRecording && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#450a0a',
                        border: '1px solid #7f1d1d',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#f87171'
                      }}
                    >
                      <div
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          animation: 'blinkRec 1s infinite'
                        }}
                      />
                      <span>REC {formatDuration(activeCall.duration)}</span>
                    </div>
                  )}

                  {/* Call Duration */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#cbd5e1',
                      fontFamily: 'monospace'
                    }}
                  >
                    <Clock size={13} color="#94a3b8" />
                    <span>{formatDuration(activeCall.duration)}</span>
                  </div>
                </div>

                {/* Contact Hero Area */}
                <div style={{ textAlign: 'center', padding: '10px 0 16px 0' }}>
                  {/* Glowing Avatar */}
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      margin: '0 auto 16px auto',
                      backgroundColor: '#1e293b',
                      border: '2px solid #10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px',
                      fontWeight: 800,
                      color: '#34d399',
                      animation: activeCall.status === 'connected' ? 'pulseRing 2s infinite ease-out' : 'none'
                    }}
                  >
                    {activeCall.name
                      .split(' ')
                      .map(p => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>

                  {/* Name */}
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                    {activeCall.name}
                  </div>

                  {/* Masked Phone Number */}
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#94a3b8',
                      marginTop: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontFamily: 'monospace'
                    }}
                  >
                    <ShieldCheck size={14} color="#10b981" />
                    <span>{activeCall.maskedPhone}</span>
                  </div>

                  {/* Outbound Channel Tag */}
                  <div style={{ marginTop: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#1e293b',
                        color: '#94a3b8',
                        padding: '3px 10px',
                        borderRadius: '12px'
                      }}
                    >
                      DSA Telecom Line 1 • Encrypted
                    </span>
                  </div>
                </div>

                {/* =============================================================== */}
                {/* VOICE ANIMATION WAVEFORM                                       */}
                {/* Dynamically animates frequency bars when connected             */}
                {/* =============================================================== */}
                <div
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    margin: '12px 0 20px 0',
                    border: '1px solid #334155',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {activeCall.isMuted
                      ? 'Microphone Muted'
                      : activeCall.status === 'connected'
                      ? 'Live Audio Stream'
                      : 'Connecting audio channel...'}
                  </div>

                  {/* 24 Frequency Voice Waveform Bars */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      height: '44px'
                    }}
                  >
                    {Array.from({ length: 24 }).map((_, i) => {
                      // Variable animation delays to mimic speech spectrum
                      const delays = [0.1, 0.4, 0.2, 0.6, 0.3, 0.5, 0.7, 0.2, 0.4, 0.8, 0.3, 0.5, 0.2, 0.6, 0.4, 0.7, 0.3, 0.5, 0.2, 0.4, 0.6, 0.3, 0.5, 0.2];
                      const durations = [0.8, 0.9, 0.7, 1.1, 0.85, 1.0, 0.75, 0.95, 0.8, 1.05, 0.9, 0.75, 0.85, 1.1, 0.8, 0.95, 0.7, 1.0, 0.85, 0.9, 1.05, 0.8, 0.95, 0.75];
                      const delay = delays[i % delays.length];
                      const dur = durations[i % durations.length];

                      return (
                        <div
                          key={i}
                          style={{
                            width: '4px',
                            borderRadius: '3px',
                            backgroundColor: activeCall.isMuted
                              ? '#64748b'
                              : activeCall.status === 'connected'
                              ? '#10b981'
                              : '#f59e0b',
                            height: activeCall.isMuted ? '5px' : activeCall.status === 'connected' ? '24px' : '8px',
                            animation:
                              activeCall.status === 'connected' && !activeCall.isMuted
                                ? `waveBar ${dur}s infinite ease-in-out ${delay}s`
                                : 'none',
                            transition: 'height 0.2s ease, background-color 0.2s ease'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Keypad Display (if toggled open) */}
                {activeCall.showKeypad && (
                  <div
                    style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      padding: '14px',
                      marginBottom: '16px',
                      border: '1px solid #334155'
                    }}
                  >
                    <div
                      style={{
                        textAlign: 'center',
                        fontSize: '18px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: '#34d399',
                        minHeight: '26px',
                        marginBottom: '10px'
                      }}
                    >
                      {activeCall.keypadInput || '—'}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px'
                      }}
                    >
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                        <button
                          key={key}
                          onClick={() => {
                            playBeep(key === '*' ? 300 : key === '#' ? 700 : 350 + Number(key) * 35);
                            setActiveCall(prev => (prev ? { ...prev, keypadInput: prev.keypadInput + key } : null));
                          }}
                          style={{
                            backgroundColor: '#334155',
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '10px 0',
                            fontSize: '16px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'background-color 0.1s ease'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#475569')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#334155')}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Calling Controls Grid */}
              <div>
                {/* Quick Call Disposition selection */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    Call Disposition:
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['Interested', 'Follow Up', 'RNR', 'Busy', 'Not Interested'].map(disp => {
                      const isSel = activeCall.disposition === disp;
                      return (
                        <button
                          key={disp}
                          onClick={() => setActiveCall(prev => (prev ? { ...prev, disposition: disp } : null))}
                          style={{
                            backgroundColor: isSel ? '#0284c7' : '#1e293b',
                            border: isSel ? '1px solid #38bdf8' : '1px solid #334155',
                            color: isSel ? '#ffffff' : '#cbd5e1',
                            borderRadius: '6px',
                            fontSize: '11px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontWeight: isSel ? 700 : 500
                          }}
                        >
                          {disp}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons: Speaker, Mute, Record, Keypad */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '10px',
                    marginBottom: '24px'
                  }}
                >
                  {/* Speaker */}
                  <button
                    onClick={() => setActiveCall(prev => (prev ? { ...prev, isSpeaker: !prev.isSpeaker } : null))}
                    style={{
                      backgroundColor: activeCall.isSpeaker ? '#1e3a8a' : '#1e293b',
                      border: activeCall.isSpeaker ? '1px solid #3b82f6' : '1px solid #334155',
                      borderRadius: '12px',
                      padding: '12px 6px',
                      color: activeCall.isSpeaker ? '#60a5fa' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    {activeCall.isSpeaker ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    <span>Speaker</span>
                  </button>

                  {/* Mute */}
                  <button
                    onClick={() => setActiveCall(prev => (prev ? { ...prev, isMuted: !prev.isMuted } : null))}
                    style={{
                      backgroundColor: activeCall.isMuted ? '#450a0a' : '#1e293b',
                      border: activeCall.isMuted ? '1px solid #ef4444' : '1px solid #334155',
                      borderRadius: '12px',
                      padding: '12px 6px',
                      color: activeCall.isMuted ? '#f87171' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    {activeCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    <span>{activeCall.isMuted ? 'Muted' : 'Mute'}</span>
                  </button>

                  {/* Record */}
                  <button
                    onClick={() => setActiveCall(prev => (prev ? { ...prev, isRecording: !prev.isRecording } : null))}
                    style={{
                      backgroundColor: activeCall.isRecording ? '#450a0a' : '#1e293b',
                      border: activeCall.isRecording ? '1px solid #ef4444' : '1px solid #334155',
                      borderRadius: '12px',
                      padding: '12px 6px',
                      color: activeCall.isRecording ? '#f87171' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    <Disc size={20} />
                    <span>{activeCall.isRecording ? 'Rec On' : 'Record'}</span>
                  </button>

                  {/* Keypad */}
                  <button
                    onClick={() => setActiveCall(prev => (prev ? { ...prev, showKeypad: !prev.showKeypad } : null))}
                    style={{
                      backgroundColor: activeCall.showKeypad ? '#042f2e' : '#1e293b',
                      border: activeCall.showKeypad ? '1px solid #14b8a6' : '1px solid #334155',
                      borderRadius: '12px',
                      padding: '12px 6px',
                      color: activeCall.showKeypad ? '#2dd4bf' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    <Grid3x3 size={20} />
                    <span>Keypad</span>
                  </button>
                </div>

                {/* Big End Call Button */}
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={handleEndCall}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: '#dc2626',
                      border: 'none',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 8px 20px rgba(220, 38, 38, 0.4)',
                      transition: 'transform 0.15s ease, background-color 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.08)';
                      e.currentTarget.style.backgroundColor = '#b91c1c';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.backgroundColor = '#dc2626';
                    }}
                    title="End Call"
                  >
                    <PhoneOff size={28} />
                  </button>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f87171', marginTop: '8px' }}>
                    End Call
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

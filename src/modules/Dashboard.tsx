import React, { useState } from 'react';
import { FileLoggedIn } from './FileLoggedIn.js';
import { Disbursements } from './Disbursements.js';
import { Accounts } from './Accounts.js';

export type DashboardCardType = 'files' | 'disbursements' | 'accounts';

interface DashboardProps {
  initialCard?: DashboardCardType | null;
}

// Inward Concave Fillets for the Merged Tab effect
const LeftFillet: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    style={{
      position: 'absolute',
      bottom: '-1px',
      left: '-16px',
      zIndex: 21,
      pointerEvents: 'none'
    }}
    aria-hidden="true"
  >
    <path d="M 0,16 A 16,16 0 0,0 16,0 L 16,16 Z" fill="#ffffff" />
    <path d="M 0,16 A 16,16 0 0,0 16,0" fill="none" stroke="#e2e8f0" strokeWidth="1" />
  </svg>
);

const RightFillet: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    style={{
      position: 'absolute',
      bottom: '-1px',
      right: '-16px',
      zIndex: 21,
      pointerEvents: 'none'
    }}
    aria-hidden="true"
  >
    <path d="M 0,0 A 16,16 0 0,0 16,16 L 0,16 Z" fill="#ffffff" />
    <path d="M 0,0 A 16,16 0 0,0 16,16" fill="none" stroke="#e2e8f0" strokeWidth="1" />
  </svg>
);

export const Dashboard: React.FC<DashboardProps> = ({ initialCard = null }) => {
  // Default to 'disbursements' or 'files' (or initialCard)
  const [selectedCard, setSelectedCard] = useState<DashboardCardType>(initialCard || 'disbursements');

  return (
    <div className="page-content">
      <div className="dashboard-deck">
        {/* The 3 Cards Row */}
        <div className="dashboard-cards-grid" role="tablist" aria-label="Dashboard Modules">
          
          {/* Card 1: File Logged-in */}
          <div
            className={`dashboard-card ${selectedCard === 'files' ? 'active' : ''}`}
            onClick={() => setSelectedCard('files')}
            role="tab"
            aria-selected={selectedCard === 'files'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedCard('files');
              }
            }}
          >
            {/* When Card 1 is active, render bottom mask and right fillet */}
            {selectedCard === 'files' && (
              <>
                <div className="dashboard-card-bottom-mask" />
                <RightFillet />
              </>
            )}

            <div className="dashboard-card-title">File Logged-in</div>
          </div>

          {/* Card 2: Disbursements */}
          <div
            className={`dashboard-card ${selectedCard === 'disbursements' ? 'active' : ''}`}
            onClick={() => setSelectedCard('disbursements')}
            role="tab"
            aria-selected={selectedCard === 'disbursements'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedCard('disbursements');
              }
            }}
          >
            {/* When Card 2 is active, render bottom mask, left fillet, and right fillet */}
            {selectedCard === 'disbursements' && (
              <>
                <LeftFillet />
                <div className="dashboard-card-bottom-mask" />
                <RightFillet />
              </>
            )}

            <div className="dashboard-card-title">Disbursements</div>
          </div>

          {/* Card 3: Accounts */}
          <div
            className={`dashboard-card ${selectedCard === 'accounts' ? 'active' : ''}`}
            onClick={() => setSelectedCard('accounts')}
            role="tab"
            aria-selected={selectedCard === 'accounts'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedCard('accounts');
              }
            }}
          >
            {/* When Card 3 is active, render left fillet and bottom mask */}
            {selectedCard === 'accounts' && (
              <>
                <LeftFillet />
                <div className="dashboard-card-bottom-mask" />
              </>
            )}

            <div className="dashboard-card-title">Accounts</div>
          </div>

        </div>

        {/* Data Section Container — Dynamically merges with the active card */}
        <div
          className="dashboard-data-container"
          role="tabpanel"
          aria-label={`${selectedCard} workspace`}
          style={{
            borderTopLeftRadius: selectedCard === 'files' ? 0 : 20,
            borderTopRightRadius: selectedCard === 'accounts' ? 0 : 20
          }}
        >
          <div className="dashboard-embedded-content">
            {selectedCard === 'files' && <FileLoggedIn />}
            {selectedCard === 'disbursements' && <Disbursements />}
            {selectedCard === 'accounts' && <Accounts />}
          </div>
        </div>

      </div>
    </div>
  );
};


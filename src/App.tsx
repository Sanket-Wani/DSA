import React, { useState } from 'react';
import { Sidebar, NavigationModule } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { Dashboard, DashboardCardType } from './modules/Dashboard.js';
import { Telecalling } from './modules/Telecalling.js';
import { CreateInvoices } from './modules/CreateInvoices.js';
import { GSTReport } from './modules/GSTReport.js';
import { TDSReport } from './modules/TDSReport.js';
import { UsersModule } from './modules/Users.js';

export const App: React.FC = () => {
  const getInitialState = (): { module: NavigationModule; card?: DashboardCardType | null } => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('user')) return { module: 'Users' };
    if (path.includes('gst')) return { module: 'GST report' };
    if (path.includes('tds')) return { module: 'TDS report' };
    if (path.includes('account')) return { module: 'Dashboard', card: 'accounts' };
    if (path.includes('invoice')) return { module: 'Create Invoices' };
    if (path.includes('disbursement')) return { module: 'Dashboard', card: 'disbursements' };
    if (path.includes('telecalling')) return { module: 'Telecalling' };
    if (path.includes('file') || path.includes('approve')) return { module: 'Dashboard', card: 'files' };
    return { module: 'Dashboard', card: null };
  };

  const initialState = getInitialState();
  const [activeModule, setActiveModule] = useState<NavigationModule>(initialState.module);
  const [initialDashboardCard] = useState<DashboardCardType | null>(initialState.card ?? null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderModule = () => {
    switch (activeModule) {
      case 'Dashboard':
        return <Dashboard initialCard={initialDashboardCard} />;
      case 'Telecalling':
        return <Telecalling />;
      case 'Create Invoices':
        return <CreateInvoices />;
      case 'GST report':
        return <GSTReport />;
      case 'TDS report':
        return <TDSReport />;
      case 'Users':
        return <UsersModule />;
      case 'File Logged-in':
        return <Dashboard initialCard="files" />;
      case 'Disbursements':
        return <Dashboard initialCard="disbursements" />;
      case 'Accounts':
        return <Dashboard initialCard="accounts" />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="app-main">
        <TopBar
          activeModule={activeModule}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />

        <main role="main">
          {renderModule()}
        </main>
      </div>
    </div>
  );
};

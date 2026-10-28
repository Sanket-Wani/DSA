import React, { useState } from 'react';
import { Sidebar, NavigationModule } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { useAuth } from './context/AuthContext.js';
import { Dashboard } from './modules/Dashboard.js';
import { Telecalling } from './modules/Telecalling.js';
import { FileLoggedIn } from './modules/FileLoggedIn.js';
import { FileApprove } from './modules/FileApprove.js';
import { Disbursements } from './modules/Disbursements.js';
import { CreateInvoices } from './modules/CreateInvoices.js';
import { Accounts } from './modules/Accounts.js';
import { GSTReport } from './modules/GSTReport.js';
import { TDSReport } from './modules/TDSReport.js';
import { UsersModule } from './modules/Users.js';

export const App: React.FC = () => {
  const getInitialModule = (): NavigationModule => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('user')) return 'Users';
    if (path.includes('gst')) return 'GST report';
    if (path.includes('tds')) return 'TDS report';
    if (path.includes('account')) return 'Accounts';
    if (path.includes('invoice')) return 'Create Invoices';
    if (path.includes('disbursement')) return 'Disbursements';
    if (path.includes('approve')) return 'File Approve';
    return 'File Logged-in';
  };

  const [activeModule, setActiveModule] = useState<NavigationModule>(getInitialModule);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isSuperadmin } = useAuth();

  // If a non-superadmin is somehow on File Approve, fallback safely
  const resolvedModule = activeModule === 'File Approve' && !isSuperadmin ? 'File Logged-in' : activeModule;

  const renderModule = () => {
    switch (resolvedModule) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Telecalling':
        return <Telecalling />;
      case 'File Logged-in':
        return <FileLoggedIn />;
      case 'Disbursements':
        return <Disbursements />;
      case 'Create Invoices':
        return <CreateInvoices />;
      case 'Accounts':
        return <Accounts />;
      case 'GST report':
        return <GSTReport />;
      case 'TDS report':
        return <TDSReport />;
      case 'File Approve':
        return <FileApprove />;
      case 'Users':
        return <UsersModule />;
      default:
        return <FileLoggedIn />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeModule={resolvedModule}
        onSelectModule={setActiveModule}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="app-main">
        <TopBar
          activeModule={resolvedModule}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />

        <main role="main">
          {renderModule()}
        </main>
      </div>
    </div>
  );
};

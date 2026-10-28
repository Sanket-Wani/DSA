import React from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  Receipt,
  FileSpreadsheet,
  Landmark,
  Users
} from 'lucide-react';

export type NavigationModule =
  | 'Dashboard'
  | 'Telecalling'
  | 'File Logged-in'
  | 'Disbursements'
  | 'Create Invoices'
  | 'Accounts'
  | 'GST report'
  | 'TDS report'
  | 'File Approve'
  | 'Users';

interface SidebarProps {
  activeModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItemConfig {
  name: NavigationModule;
  label: string;
  icon: React.ReactNode;
  superadminOnly?: boolean;
}

const mainNavItems: NavItemConfig[] = [
  { name: 'Dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { name: 'Telecalling', label: 'Telecalling', icon: <PhoneCall size={18} /> },
  { name: 'Create Invoices', label: 'Create Invoices', icon: <Receipt size={18} /> },
  { name: 'GST report', label: 'GST Reports', icon: <FileSpreadsheet size={18} /> },
  { name: 'TDS report', label: 'TDS Reports', icon: <Landmark size={18} /> }
];

const bottomNavItems: NavItemConfig[] = [
  { name: 'Users', label: 'Users', icon: <Users size={18} /> }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  isMobileOpen = false,
  onCloseMobile
}) => {
  return (
    <aside className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="Main Navigation">
      <div className="sidebar-header">
        <div className="brand-icon" aria-hidden="true">
          DS
        </div>
        <div className="brand-name">DSA Manager</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-main">
          {mainNavItems.map(item => {
            const isActive = activeModule === item.name;
            return (
              <button
                key={item.name}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectModule(item.name);
                  if (onCloseMobile) onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-nav-bottom">
          {bottomNavItems.map(item => {
            const isActive = activeModule === item.name;
            return (
              <button
                key={item.name}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectModule(item.name);
                  if (onCloseMobile) onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>DSA Platform</span>
          <span>v1.0</span>
        </div>
      </div>
    </aside>
  );
};

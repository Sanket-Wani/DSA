import React from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  FileText,
  Banknote,
  Receipt,
  BookOpen,
  FileSpreadsheet,
  Landmark,
  CheckSquare,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

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

const navItems: NavItemConfig[] = [
  { name: 'Dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { name: 'Telecalling', label: 'Telecalling', icon: <PhoneCall size={18} /> },
  { name: 'File Logged-in', label: 'File Logged-in', icon: <FileText size={18} /> },
  { name: 'Disbursements', label: 'Disbursements', icon: <Banknote size={18} /> },
  { name: 'Create Invoices', label: 'Create Invoices', icon: <Receipt size={18} /> },
  { name: 'Accounts', label: 'Accounts', icon: <BookOpen size={18} /> },
  { name: 'GST report', label: 'GST report', icon: <FileSpreadsheet size={18} /> },
  { name: 'TDS report', label: 'TDS report', icon: <Landmark size={18} /> },
  { name: 'File Approve', label: 'File Approve', icon: <CheckSquare size={18} />, superadminOnly: true },
  { name: 'Users', label: 'Users', icon: <Users size={18} /> }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { isSuperadmin } = useAuth();

  const visibleItems = navItems.filter(item => {
    if (item.superadminOnly && !isSuperadmin) {
      return false;
    }
    return true;
  });

  return (
    <aside className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="Main Navigation">
      <div className="sidebar-header">
        <div className="brand-icon" aria-hidden="true">
          DS
        </div>
        <div className="brand-name">DSA Manager</div>
      </div>

      <nav className="sidebar-nav">
        {visibleItems.map(item => {
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

import React from 'react';
import { Menu, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Button } from './Button.js';

interface TopBarProps {
  activeModule: string;
  onToggleMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeModule, onToggleMobileMenu }) => {
  const { user, users, switchUser, isSuperadmin } = useAuth();

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <Button
          variant="ghost"
          size="sm"
          className="btn-icon-only d-md-none"
          onClick={onToggleMobileMenu}
          aria-label="Toggle Navigation Menu"
          icon={<Menu size={18} />}
        />
        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          Module / <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{activeModule}</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Role & Switcher Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            className={`role-badge ${isSuperadmin ? 'role-badge-superadmin' : 'role-badge-team'}`}
            title={`Active role: ${user?.role}`}
          >
            {isSuperadmin ? <ShieldCheck size={12} /> : <Users size={12} />}
            <span>{user?.role || 'Guest'}</span>
          </div>

          {/* User / Role Switcher */}
          <select
            value={user?.id || ''}
            onChange={(e) => {
              const selected = users.find(u => u.id === Number(e.target.value));
              if (selected) switchUser(selected);
            }}
            className="select-control"
            style={{ height: '30px', fontSize: 'var(--font-size-xs)', padding: '0 8px', width: 'auto' }}
            aria-label="Switch User Profile"
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {/* User avatar */}
        <div className="user-profile-menu">
          <div className="user-avatar" title={user?.full_name || 'User'}>
            {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'US'}
          </div>
        </div>
      </div>
    </header>
  );
};

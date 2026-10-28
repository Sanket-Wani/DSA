import React, { useState, useEffect } from 'react';
import { UserPlus, Key, UserX, UserCheck, Shield, RefreshCw, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { User } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { Select } from '../components/Select.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';

export const UsersModule: React.FC = () => {
  const { user: currentUser, refreshUsers } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<User | null>(null);
  const [statusToggleUser, setStatusToggleUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'Team' as 'Team' | 'Superadmin'
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Password State
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const fetchUsersList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ users: User[] }>('/api/users');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr.split('T')[0];
    }
  };

  // Handle Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!createForm.full_name.trim()) errs.full_name = 'Full name is required';
    
    let formattedEmail = createForm.email.trim().toLowerCase();
    if (!formattedEmail) {
      errs.email = 'Email address is required';
    } else {
      if (!formattedEmail.includes('@')) {
        formattedEmail = `${formattedEmail}@vinayakassociates.in`;
      } else if (!formattedEmail.endsWith('@vinayakassociates.in')) {
        const username = formattedEmail.split('@')[0];
        formattedEmail = `${username}@vinayakassociates.in`;
      }
    }

    if (!createForm.password || createForm.password.length < 4) errs.password = 'Password must be at least 4 characters';

    setCreateErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest<{ message: string; user: User }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...createForm, email: formattedEmail })
      });
      setSuccessMsg(`Team login created successfully for ${res.user.full_name}.`);
      setIsCreateOpen(false);
      setCreateForm({ full_name: '', email: '', password: '', role: 'Team' });
      fetchUsersList();
      refreshUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reset Password
  const handleResetPasswordSubmit = async () => {
    if (!resetPwUser) return;
    if (!newPassword || newPassword.length < 4) {
      setResetError('New password must be at least 4 characters');
      return;
    }

    setIsSubmitting(true);
    setResetError(null);
    try {
      await apiRequest(`/api/users/${resetPwUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword })
      });
      setSuccessMsg(`Password reset successfully for ${resetPwUser.full_name}.`);
      setResetPwUser(null);
      setNewPassword('');
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Status (Deactivate / Activate)
  const handleToggleStatus = async () => {
    if (!statusToggleUser) return;
    const currentIsActive = statusToggleUser.is_active !== 0;
    const nextStatus = currentIsActive ? 0 : 1;

    setIsSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/users/${statusToggleUser.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: nextStatus })
      });
      setSuccessMsg(
        `User ${statusToggleUser.full_name} is now ${nextStatus === 1 ? 'Active' : 'Deactivated'}.`
      );
      setStatusToggleUser(null);
      fetchUsersList();
      refreshUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/users/${deleteConfirmUser.id}`, {
        method: 'DELETE'
      });
      setSuccessMsg(`User ${deleteConfirmUser.full_name} deleted successfully.`);
      setDeleteConfirmUser(null);
      fetchUsersList();
      refreshUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      {/* Header section matching reference screenshot */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <div className="page-subtitle">Manage team logins, passwords, and access activation</div>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            icon={<UserPlus size={16} />}
          >
            Create Team Login
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setSuccessMsg(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Users Table matching reference design */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>NAME</th>
              <th style={{ width: '25%' }}>EMAIL</th>
              <th style={{ width: '12%' }}>ROLE</th>
              <th style={{ width: '10%' }}>STATUS</th>
              <th style={{ width: '14%' }}>CREATED AT</th>
              <th style={{ width: '17%', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && users.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  No users found. Click "Create Team Login" to add your first user.
                </td>
              </tr>
            ) : (
              users.map(u => {
                const isActive = u.is_active !== 0;
                const isSuper = u.role === 'Superadmin';
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isSuper && (
                          <span
                            title="System Superadmin"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              color: 'var(--color-info)'
                            }}
                          >
                            <Shield size={14} />
                          </span>
                        )}
                        <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {u.full_name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-md)' }}>
                        {u.email}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          backgroundColor: isSuper ? 'var(--color-info-bg)' : 'var(--color-surface-muted)',
                          color: isSuper ? 'var(--color-info)' : 'var(--color-text-primary)',
                          border: isSuper ? '1px solid #c8dcf0' : '1px solid var(--color-border)'
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {isActive ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 500,
                            backgroundColor: 'var(--color-success-bg)',
                            color: 'var(--color-success)'
                          }}
                        >
                          Active
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 500,
                            backgroundColor: 'var(--color-surface-muted)',
                            color: 'var(--color-text-disabled)'
                          }}
                        >
                          Inactive
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="num-tabular" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatDate(u.created_at)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setResetPwUser(u);
                            setNewPassword('');
                            setResetError(null);
                          }}
                          icon={<Key size={13} />}
                        >
                          Reset PW
                        </Button>

                        {isActive ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setStatusToggleUser(u)}
                            icon={<UserX size={13} />}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setStatusToggleUser(u)}
                            icon={<UserCheck size={13} />}
                            style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                          >
                            Activate
                          </Button>
                        )}

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteConfirmUser(u)}
                          icon={<Trash2 size={13} />}
                          title="Delete User"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Create Team Login */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Team Login"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateSubmit} isLoading={isSubmitting}>
              Create Team Login
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="Full Name"
            required
            placeholder="e.g. Priya Nair"
            value={createForm.full_name}
            onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })}
            error={createErrors.full_name}
          />

          <Input
            type="email"
            label="Email Address"
            required
            placeholder="e.g. priya@vinayakassociates.in"
            value={createForm.email}
            onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
            error={createErrors.email}
            helperText="Domain: @vinayakassociates.in (enter username or full email)"
          />

          <Input
            type="password"
            label="Initial Password"
            required
            placeholder="At least 4 characters"
            value={createForm.password}
            onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
            error={createErrors.password}
            helperText="The user will use this password to sign into the DSA software."
          />

          <Select
            label="Role Permission"
            required
            value={createForm.role}
            onChange={e => setCreateForm({ ...createForm, role: e.target.value as any })}
            helperText="Team members have operational access. Superadmins have approval and user admin rights."
          >
            <option value="Team">TEAM (Operational Access)</option>
            <option value="Superadmin">SUPERADMIN (Full Management & Approvals)</option>
          </Select>
        </form>
      </Modal>

      {/* Modal: Reset Password */}
      <Modal
        isOpen={resetPwUser !== null}
        onClose={() => setResetPwUser(null)}
        title={`Reset Password for ${resetPwUser?.full_name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetPwUser(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleResetPasswordSubmit} isLoading={isSubmitting}>
              Save New Password
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Updating credentials for <strong>{resetPwUser?.email}</strong>.
          </div>

          <Input
            type="password"
            label="New Password"
            required
            placeholder="Enter new password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            error={resetError || undefined}
          />
        </div>
      </Modal>

      {/* Modal: Confirm Activation / Deactivation */}
      <Modal
        isOpen={statusToggleUser !== null}
        onClose={() => setStatusToggleUser(null)}
        title={statusToggleUser?.is_active !== 0 ? 'Confirm Deactivation' : 'Confirm Activation'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusToggleUser(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant={statusToggleUser?.is_active !== 0 ? 'danger' : 'primary'}
              onClick={handleToggleStatus}
              isLoading={isSubmitting}
            >
              {statusToggleUser?.is_active !== 0 ? 'Deactivate User' : 'Activate User'}
            </Button>
          </>
        }
      >
        <div>
          Are you sure you want to {statusToggleUser?.is_active !== 0 ? 'deactivate' : 'activate'}{' '}
          <strong>{statusToggleUser?.full_name}</strong> ({statusToggleUser?.email})?
          {statusToggleUser?.is_active !== 0 && (
            <div className="alert alert-warning" style={{ marginTop: '12px', fontSize: 'var(--font-size-xs)' }}>
              Deactivating this user will prevent them from signing in or performing operations in the system.
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Confirm Delete User */}
      <Modal
        isOpen={deleteConfirmUser !== null}
        onClose={() => !isSubmitting && setDeleteConfirmUser(null)}
        title="Delete User"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirmUser(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              isLoading={isSubmitting}
              icon={<Trash2 size={14} />}
            >
              Delete User
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            Are you sure you want to permanently delete user{' '}
            <strong>{deleteConfirmUser?.full_name}</strong> ({deleteConfirmUser?.email})?
          </div>
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #fecaca'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>This action is permanent and cannot be undone. All access credentials for this user will be removed.</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

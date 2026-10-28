import { Router } from 'express';
import { db } from '../db.js';
import crypto from 'crypto';

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

// 1. List all users
router.get('/', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, email, full_name, role, COALESCE(is_active, 1) as is_active, created_at 
      FROM users 
      ORDER BY role DESC, id ASC
    `).all();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list users' });
  }
});

// 2. Create new Team Login
router.post('/', (req, res) => {
  const { full_name, email, password, role = 'Team' } = req.body;

  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  let trimmedEmail = (email || '').trim().toLowerCase();
  if (!trimmedEmail) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  // Ensure domain is always vinayakassociates.in
  if (!trimmedEmail.includes('@')) {
    trimmedEmail = `${trimmedEmail}@vinayakassociates.in`;
  } else if (!trimmedEmail.endsWith('@vinayakassociates.in')) {
    const userPart = trimmedEmail.split('@')[0];
    trimmedEmail = `${userPart}@vinayakassociates.in`;
  }

  if (!password || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const validRole = role === 'Superadmin' ? 'Superadmin' : 'Team';

  try {
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(trimmedEmail);
    if (existing) {
      return res.status(400).json({ error: `User with email "${trimmedEmail}" already exists` });
    }

    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    const info = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(trimmedEmail, passwordHash, full_name.trim(), validRole, now);

    const newUser = db.prepare(`
      SELECT id, email, full_name, role, is_active, created_at 
      FROM users 
      WHERE id = ?
    `).get(info.lastInsertRowid);

    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

// 3. Reset password
router.put('/:id/password', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { password } = req.body;

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (!password || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  try {
    const user = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newHash = hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    res.json({ message: `Password reset successfully for ${user.full_name}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reset password' });
  }
});

// 4. Toggle activation status
router.put('/:id/status', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { is_active } = req.body;

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const newStatus = is_active === 1 || is_active === true ? 1 : 0;

  try {
    const user = db.prepare('SELECT id, full_name, email, role, is_active FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Safety check: Prevent deactivating the only active Superadmin
    if (newStatus === 0 && user.role === 'Superadmin') {
      const activeSuperadmins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Superadmin' AND is_active = 1").get() as { count: number };
      if (activeSuperadmins.count <= 1) {
        return res.status(400).json({ error: 'Cannot deactivate the primary Superadmin account' });
      }
    }

    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, userId);

    const updated = db.prepare('SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id = ?').get(userId);
    res.json({
      message: `User ${user.full_name} is now ${newStatus === 1 ? 'Active' : 'Deactivated'}`,
      user: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update user status' });
  }
});

// 5. Delete user
router.delete('/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const user = db.prepare('SELECT id, full_name, email, role FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Safety check: Prevent deleting the primary/only Superadmin
    if (user.role === 'Superadmin') {
      const superadmins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Superadmin'").get() as { count: number };
      if (superadmins.count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the primary Superadmin account' });
      }
    }

    const deleteUserTx = db.transaction((id: number) => {
      // Clear references in related tables to maintain relational integrity
      db.prepare('UPDATE files SET created_by = NULL WHERE created_by = ?').run(id);
      db.prepare('UPDATE files SET reviewed_by = NULL WHERE reviewed_by = ?').run(id);
      db.prepare('UPDATE invoices SET created_by = NULL WHERE created_by = ?').run(id);
      db.prepare('UPDATE accounts_ledger SET updated_by = NULL WHERE updated_by = ?').run(id);

      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });

    deleteUserTx(userId);

    res.json({ message: `User "${user.full_name}" deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete user' });
  }
});

export default router;

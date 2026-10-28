import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// Current user profile
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

// List users for switching / selection
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, email, full_name, role, created_at FROM users ORDER BY role DESC, id ASC').all();
  res.json({ users });
});

export default router;

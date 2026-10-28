import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: 'Superadmin' | 'Team';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Support Authorization: Bearer <user_id_or_token> or x-user-id header
  const authHeader = req.headers.authorization;
  const userIdHeader = req.headers['x-user-id'];

  let userId: number | null = null;

  if (userIdHeader) {
    userId = parseInt(String(userIdHeader), 10);
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    // In our system, the token can be user ID or a signed token
    const parsed = parseInt(token, 10);
    if (!isNaN(parsed)) {
      userId = parsed;
    }
  }

  // If no header provided, check if a default user exists for seamless operation
  if (!userId) {
    // Default to Superadmin user ID 1 or fallback
    const defaultUser = db.prepare('SELECT id, email, full_name, role FROM users LIMIT 1').get() as AuthUser | undefined;
    if (defaultUser) {
      req.user = defaultUser;
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = db.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?').get(userId) as AuthUser | undefined;

  if (!user) {
    return res.status(401).json({ error: 'User not found or session expired' });
  }

  req.user = user;
  next();
}

export function requireSuperadmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'Superadmin') {
    return res.status(403).json({ error: 'Access denied: Only Superadmin can perform this action' });
  }

  next();
}

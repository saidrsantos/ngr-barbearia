import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedUser {
  id: number;
  name: string;
  role: 'owner' | 'staff';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token não encontrado.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET as string) as AuthedUser;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado.' });
  }
}

export function requireRoles(...roles: Array<AuthedUser['role']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Sem permissão para esta ação.' });
    }
    next();
  };
}

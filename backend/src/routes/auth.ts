import { Router } from 'express';
import { Pool, RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { auth } from '../middleware/auth';

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'owner' | 'staff';
  active: boolean;
}

export function createAuthRouter(pool: Pool): Router {
  const router = Router();
  const JWT_SECRET = process.env.JWT_SECRET as string;

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email e password são obrigatórios.' });
    }
    const [rows] = await pool.query<UserRow[]>('SELECT * FROM users WHERE email = ? AND active = 1', [
      email,
    ]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, {
      expiresIn: '7d',
    });
    res.json({ success: true, data: { token, user: { id: user.id, name: user.name, role: user.role } } });
  });

  router.get('/me', auth, (req, res) => {
    res.json({ success: true, data: req.user });
  });

  return router;
}

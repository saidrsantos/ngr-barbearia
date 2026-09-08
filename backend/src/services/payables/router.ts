import { Router } from 'express';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { AuthedUser } from '../../middleware/auth';

interface RouterDeps {
  pool: Pool;
  auth: import('express').RequestHandler;
  requireRoles: (...roles: Array<AuthedUser['role']>) => import('express').RequestHandler;
}

/**
 * Contas a pagar da barbearia (aluguel, fornecedor, contas etc.) — diferente
 * de barber_debts (dinheiro que o barbeiro deve pra barbearia). Sem
 * parcelamento automático: cada conta é um lançamento com um vencimento.
 */
export function createPayablesRouter({ pool, auth, requireRoles }: RouterDeps): Router {
  const router = Router();

  router.get('/payables', auth, async (req, res) => {
    const { status } = req.query;
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM payables ${where} ORDER BY due_date`,
      params
    );
    res.json({ success: true, data: rows });
  });

  router.post('/payables', auth, requireRoles('owner'), async (req, res) => {
    const { description, amount_cents, due_date } = req.body;
    if (!description || !amount_cents || !due_date) {
      return res.status(400).json({
        success: false,
        message: 'description, amount_cents e due_date são obrigatórios.',
      });
    }
    const [result] = await pool.execute(
      'INSERT INTO payables (description, amount_cents, due_date) VALUES (?, ?, ?)',
      [description, amount_cents, due_date]
    );
    res.status(201).json({ success: true, data: { id: (result as any).insertId } });
  });

  router.delete('/payables/:id', auth, requireRoles('owner'), async (req, res) => {
    await pool.execute('DELETE FROM payables WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  router.patch('/payables/:id/pay', auth, async (req, res) => {
    await pool.execute("UPDATE payables SET status = 'paid', paid_at = NOW() WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  });

  router.patch('/payables/:id/unpay', auth, async (req, res) => {
    await pool.execute("UPDATE payables SET status = 'pending', paid_at = NULL WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  });

  return router;
}

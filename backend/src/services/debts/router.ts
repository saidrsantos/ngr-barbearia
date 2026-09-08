import { Router } from 'express';
import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { AuthedUser } from '../../middleware/auth';

interface RouterDeps {
  pool: Pool;
  auth: import('express').RequestHandler;
  requireRoles: (...roles: Array<AuthedUser['role']>) => import('express').RequestHandler;
}

/**
 * Controle de adiantamentos/compras que o dono faz pro barbeiro (ex: máquina
 * de corte), pagos de volta em parcelas mensais. Ainda não desconta
 * automaticamente de nenhuma comissão — é só um registro pra conferir na
 * hora do fechamento, evitando perder conta no caderno.
 */
export function createDebtsRouter({ pool, auth, requireRoles }: RouterDeps): Router {
  const router = Router();

  router.get('/debts', auth, async (req, res) => {
    const { barber_id } = req.query;
    const where = barber_id ? 'WHERE d.barber_id = ?' : '';
    const params = barber_id ? [barber_id] : [];
    const [debts] = await pool.query<RowDataPacket[]>(
      `SELECT d.*, b.name AS barber_name,
              (SELECT COUNT(*) FROM barber_debt_installments i WHERE i.debt_id = d.id AND i.status = 'pending') AS pending_count
         FROM barber_debts d
         JOIN barbers b ON b.id = d.barber_id
         ${where}
        ORDER BY d.created_at DESC`,
      params
    );
    res.json({ success: true, data: debts });
  });

  router.get('/debts/:id/installments', auth, async (req, res) => {
    const [installments] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM barber_debt_installments WHERE debt_id = ? ORDER BY installment_number',
      [req.params.id]
    );
    res.json({ success: true, data: installments });
  });

  router.post('/debts', auth, requireRoles('owner'), async (req, res) => {
    const { barber_id, description, total_cents, installments_count, first_due_date } = req.body;
    if (!barber_id || !description || !total_cents || !installments_count || !first_due_date) {
      return res.status(400).json({
        success: false,
        message: 'barber_id, description, total_cents, installments_count e first_due_date são obrigatórios.',
      });
    }
    if (installments_count < 1) {
      return res.status(400).json({ success: false, message: 'installments_count precisa ser pelo menos 1.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [debtResult] = await conn.execute<ResultSetHeader>(
        'INSERT INTO barber_debts (barber_id, description, total_cents, installments_count) VALUES (?, ?, ?, ?)',
        [barber_id, description, total_cents, installments_count]
      );
      const debtId = debtResult.insertId;

      const baseAmount = Math.floor(total_cents / installments_count);
      const remainder = total_cents - baseAmount * installments_count;

      const firstDue = new Date(`${first_due_date}T12:00:00`);
      for (let i = 0; i < installments_count; i++) {
        const dueDate = new Date(firstDue);
        dueDate.setMonth(dueDate.getMonth() + i);
        const amount = i === installments_count - 1 ? baseAmount + remainder : baseAmount;
        await conn.execute(
          `INSERT INTO barber_debt_installments (debt_id, installment_number, due_date, amount_cents)
           VALUES (?, ?, ?, ?)`,
          [debtId, i + 1, dueDate.toISOString().slice(0, 10), amount]
        );
      }

      await conn.commit();
      res.status(201).json({ success: true, data: { id: debtId } });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

  router.delete('/debts/:id', auth, requireRoles('owner'), async (req, res) => {
    await pool.execute('DELETE FROM barber_debts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  router.patch('/installments/:id/pay', auth, async (req, res) => {
    await pool.execute(
      "UPDATE barber_debt_installments SET status = 'paid', paid_at = NOW() WHERE id = ?",
      [req.params.id]
    );
    res.json({ success: true });
  });

  router.patch('/installments/:id/unpay', auth, async (req, res) => {
    await pool.execute(
      "UPDATE barber_debt_installments SET status = 'pending', paid_at = NULL WHERE id = ?",
      [req.params.id]
    );
    res.json({ success: true });
  });

  return router;
}

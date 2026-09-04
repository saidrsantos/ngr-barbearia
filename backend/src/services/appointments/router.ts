import { Router } from 'express';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { getAppointmentProvider } from './index';
import { AuthedUser } from '../../middleware/auth';

interface RouterDeps {
  pool: Pool;
  auth: import('express').RequestHandler;
  requireRoles: (...roles: Array<AuthedUser['role']>) => import('express').RequestHandler;
}

/**
 * CRUD do painel admin para o que a IA usa para montar o prompt (serviços,
 * promoções, horários, barbeiros) + listagem/gestão de agendamentos.
 * Segue o padrão de router-factory: recebe {pool, auth, requireRoles} e só é
 * montado em server.ts com app.use(...).
 */
export function createAppointmentsRouter({ pool, auth, requireRoles }: RouterDeps): Router {
  const router = Router();

  // ── Serviços ──────────────────────────────────────────────────────────
  router.get('/services', auth, async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM services ORDER BY active DESC, name'
    );
    res.json({ success: true, data: rows });
  });

  router.post('/services', auth, requireRoles('owner'), async (req, res) => {
    const { name, description, price_cents, duration_min } = req.body;
    if (!name || !price_cents) {
      return res.status(400).json({ success: false, message: 'name e price_cents são obrigatórios.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO services (name, description, price_cents, duration_min) VALUES (?, ?, ?, ?)',
      [name, description || null, price_cents, duration_min || 30]
    );
    res.status(201).json({ success: true, data: { id: (result as any).insertId } });
  });

  router.put('/services/:id', auth, requireRoles('owner'), async (req, res) => {
    const { name, description, price_cents, duration_min, active } = req.body;
    await pool.execute(
      `UPDATE services SET name = ?, description = ?, price_cents = ?, duration_min = ?, active = ?
       WHERE id = ?`,
      [name, description || null, price_cents, duration_min, active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  });

  router.delete('/services/:id', auth, requireRoles('owner'), async (req, res) => {
    await pool.execute('UPDATE services SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ── Promoções ─────────────────────────────────────────────────────────
  router.get('/promotions', auth, async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM promotions ORDER BY active DESC, created_at DESC'
    );
    res.json({ success: true, data: rows });
  });

  router.post('/promotions', auth, requireRoles('owner'), async (req, res) => {
    const { title, description, valid_from, valid_to } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'title e description são obrigatórios.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO promotions (title, description, valid_from, valid_to) VALUES (?, ?, ?, ?)',
      [title, description, valid_from || null, valid_to || null]
    );
    res.status(201).json({ success: true, data: { id: (result as any).insertId } });
  });

  router.put('/promotions/:id', auth, requireRoles('owner'), async (req, res) => {
    const { title, description, valid_from, valid_to, active } = req.body;
    await pool.execute(
      `UPDATE promotions SET title = ?, description = ?, valid_from = ?, valid_to = ?, active = ?
       WHERE id = ?`,
      [title, description, valid_from || null, valid_to || null, active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  });

  router.delete('/promotions/:id', auth, requireRoles('owner'), async (req, res) => {
    await pool.execute('UPDATE promotions SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ── Barbeiros ─────────────────────────────────────────────────────────
  router.get('/barbers', auth, async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM barbers ORDER BY name');
    res.json({ success: true, data: rows });
  });

  router.post('/barbers', auth, requireRoles('owner'), async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name é obrigatório.' });
    const [result] = await pool.execute('INSERT INTO barbers (name) VALUES (?)', [name]);
    res.status(201).json({ success: true, data: { id: (result as any).insertId } });
  });

  // ── Horário de funcionamento ──────────────────────────────────────────
  router.get('/business-hours', auth, async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM business_hours ORDER BY day_of_week, open_time'
    );
    res.json({ success: true, data: rows });
  });

  router.post('/business-hours', auth, requireRoles('owner'), async (req, res) => {
    const { day_of_week, open_time, close_time, barber_id } = req.body;
    if (day_of_week === undefined || !open_time || !close_time) {
      return res.status(400).json({
        success: false,
        message: 'day_of_week, open_time e close_time são obrigatórios.',
      });
    }
    const [result] = await pool.execute(
      'INSERT INTO business_hours (day_of_week, open_time, close_time, barber_id) VALUES (?, ?, ?, ?)',
      [day_of_week, open_time, close_time, barber_id || null]
    );
    res.status(201).json({ success: true, data: { id: (result as any).insertId } });
  });

  router.delete('/business-hours/:id', auth, requireRoles('owner'), async (req, res) => {
    await pool.execute('DELETE FROM business_hours WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ── Agendamentos ──────────────────────────────────────────────────────
  router.get('/appointments', auth, async (req, res) => {
    const { from, to, status } = req.query;
    const clauses: string[] = [];
    const params: any[] = [];
    if (from) {
      clauses.push('a.scheduled_at >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('a.scheduled_at <= ?');
      params.push(to);
    }
    if (status) {
      clauses.push('a.status = ?');
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.*, c.name AS customer_name, c.whatsapp_number, s.name AS service_name, b.name AS barber_name
         FROM appointments a
         JOIN customers c ON c.id = a.customer_id
         JOIN services s ON s.id = a.service_id
         LEFT JOIN barbers b ON b.id = a.barber_id
         ${where}
         ORDER BY a.scheduled_at`,
      params
    );
    res.json({ success: true, data: rows });
  });

  router.patch('/appointments/:id/confirm', auth, async (req, res) => {
    await getAppointmentProvider().confirmAppointment(Number(req.params.id));
    res.json({ success: true });
  });

  router.patch('/appointments/:id/cancel', auth, async (req, res) => {
    await getAppointmentProvider().cancelAppointment(Number(req.params.id));
    res.json({ success: true });
  });

  return router;
}

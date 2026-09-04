import { Router } from 'express';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { auth } from '../middleware/auth';
import { sendTextMessage } from '../services/whatsapp/client';
import { appendMessage } from '../services/whatsapp/conversation';

/**
 * API do painel para acompanhar as conversas da IA e permitir que um humano
 * assuma quando a conversa estiver marcada needs_human.
 */
export function createConversationsRouter(pool: Pool): Router {
  const router = Router();

  router.get('/', auth, async (req, res) => {
    const { status } = req.query;
    const where = status ? 'WHERE co.status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT co.id, co.status, co.last_message_at, c.name AS customer_name, c.whatsapp_number
         FROM conversations co
         JOIN customers c ON c.id = co.customer_id
         ${where}
        ORDER BY co.last_message_at DESC
        LIMIT 200`,
      params
    );
    res.json({ success: true, data: rows });
  });

  router.get('/:id', auth, async (req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT co.id, co.status, co.last_message_at, c.name AS customer_name, c.whatsapp_number
         FROM conversations co
         JOIN customers c ON c.id = co.customer_id
        WHERE co.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Conversa não encontrada.' });
    res.json({ success: true, data: rows[0] });
  });

  router.get('/:id/messages', auth, async (req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, direction, content, ai_generated, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  });

  router.post('/:id/reply', auth, async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'text é obrigatório.' });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.whatsapp_number FROM conversations co JOIN customers c ON c.id = co.customer_id WHERE co.id = ?`,
      [req.params.id]
    );
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversa não encontrada.' });

    await sendTextMessage(conversation.whatsapp_number, text);
    await appendMessage(Number(req.params.id), 'out', text, false);
    res.json({ success: true });
  });

  router.patch('/:id/resume-ai', auth, async (req, res) => {
    await pool.execute("UPDATE conversations SET status = 'browsing' WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  });

  return router;
}

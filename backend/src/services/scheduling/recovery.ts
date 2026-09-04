import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { sendTemplateMessage } from '../whatsapp/client';
import { WHATSAPP_TEMPLATE_RECOVERY, WHATSAPP_TEMPLATE_LANGUAGE, BUSINESS_NAME } from '../whatsapp/config';

interface StaleConversationRow extends RowDataPacket {
  id: number;
  whatsapp_number: string;
  name: string | null;
}

const ABANDONED_AFTER_HOURS = 2;

/**
 * Roda periodicamente (ver scheduler.ts). Cliente que perguntou algo mas não
 * chegou a agendar depois de ABANDONED_AFTER_HOURS recebe UM follow-up
 * (marca abandoned_followup_sent pra nunca mandar de novo pra essa conversa —
 * evita ficar insistindo e violar a política de opt-out da Meta).
 */
export async function sendRecoveryFollowUps(): Promise<number> {
  const [rows] = await pool.query<StaleConversationRow[]>(
    `SELECT co.id, c.whatsapp_number, c.name
       FROM conversations co
       JOIN customers c ON c.id = co.customer_id
      WHERE co.status = 'browsing'
        AND co.last_message_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND NOT EXISTS (
          SELECT 1 FROM appointments a WHERE a.conversation_id = co.id AND a.status != 'cancelled'
        )`,
    [ABANDONED_AFTER_HOURS]
  );

  for (const conv of rows) {
    try {
      await sendTemplateMessage(conv.whatsapp_number, WHATSAPP_TEMPLATE_RECOVERY, WHATSAPP_TEMPLATE_LANGUAGE, [
        conv.name || 'tudo bem',
        BUSINESS_NAME,
      ]);
      await pool.execute("UPDATE conversations SET status = 'abandoned_followup_sent' WHERE id = ?", [
        conv.id,
      ]);
    } catch (err) {
      console.error(`[recovery] falha ao enviar follow-up da conversa ${conv.id}:`, err);
    }
  }

  return rows.length;
}

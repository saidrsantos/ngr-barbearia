import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { sendTemplateMessage } from '../whatsapp/client';
import { WHATSAPP_TEMPLATE_REMINDER, WHATSAPP_TEMPLATE_LANGUAGE } from '../whatsapp/config';

interface DueAppointmentRow extends RowDataPacket {
  id: number;
  scheduled_at: Date;
  whatsapp_number: string;
  customer_name: string | null;
  service_name: string;
}

const REMINDER_WINDOW_HOURS = 24;

/**
 * Roda periodicamente (ver scheduler.ts). Qualquer agendamento que entrou na
 * janela de 24h e ainda não recebeu lembrete recebe um agora — idempotente
 * via reminder_sent_at, então rodar de novo antes do intervalo normal não
 * duplica envio.
 */
export async function sendDueReminders(): Promise<number> {
  const [rows] = await pool.query<DueAppointmentRow[]>(
    `SELECT a.id, a.scheduled_at, c.whatsapp_number, c.name AS customer_name, s.name AS service_name
       FROM appointments a
       JOIN customers c ON c.id = a.customer_id
       JOIN services s ON s.id = a.service_id
      WHERE a.status IN ('tentative', 'confirmed')
        AND a.reminder_sent_at IS NULL
        AND a.scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? HOUR)`,
    [REMINDER_WINDOW_HOURS]
  );

  for (const appt of rows) {
    const when = new Date(appt.scheduled_at).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    try {
      await sendTemplateMessage(appt.whatsapp_number, WHATSAPP_TEMPLATE_REMINDER, WHATSAPP_TEMPLATE_LANGUAGE, [
        appt.customer_name || 'cliente',
        appt.service_name,
        when,
      ]);
      await pool.execute('UPDATE appointments SET reminder_sent_at = NOW() WHERE id = ?', [appt.id]);
    } catch (err) {
      console.error(`[reminders] falha ao enviar lembrete do agendamento ${appt.id}:`, err);
    }
  }

  return rows.length;
}

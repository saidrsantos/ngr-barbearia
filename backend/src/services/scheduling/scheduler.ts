import cron from 'node-cron';
import { sendDueReminders } from './reminders';
import { sendRecoveryFollowUps } from './recovery';

/**
 * node-cron é suficiente aqui: sistema single-tenant, um único processo,
 * sem necessidade de coordenação distribuída. Roda a cada 15 minutos —
 * ambos os jobs são idempotentes (reminder_sent_at / status da conversa),
 * então uma execução atrasada ou repetida não duplica envio.
 */
export function startScheduler(): void {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const remindersSent = await sendDueReminders();
      const followUpsSent = await sendRecoveryFollowUps();
      if (remindersSent || followUpsSent) {
        console.log(`[scheduler] lembretes enviados: ${remindersSent}, follow-ups enviados: ${followUpsSent}`);
      }
    } catch (err) {
      console.error('[scheduler] erro rodando jobs periódicos:', err);
    }
  });
  console.log('[scheduler] cron de lembretes e recuperação iniciado (a cada 15 min)');
}

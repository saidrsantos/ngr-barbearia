import 'dotenv/config';
import { getOrCreateCustomer, getOrCreateOpenConversation, appendMessage } from '../src/services/whatsapp/conversation';
import { generateReply } from '../src/services/ai/orchestrator';

/**
 * Roda o mesmo caminho do webhook do WhatsApp (IA + AppointmentProvider) sem
 * precisar de credenciais reais do WhatsApp — útil enquanto a conta Meta
 * Business e o acesso ao App Barber não estão liberados. Requer apenas
 * banco de dados rodando e OPENAI_API_KEY configurada.
 *
 * Uso:
 *   npm run simulate -- 5511999999999 "Quanto custa um corte?"
 */
async function main() {
  const [phone, ...rest] = process.argv.slice(2);
  const text = rest.join(' ');
  if (!phone || !text) {
    console.error('Uso: npm run simulate -- <numero_whatsapp> "<mensagem>"');
    process.exit(1);
  }

  const customer = await getOrCreateCustomer(phone, 'Cliente de teste');
  const conversation = await getOrCreateOpenConversation(customer.id);

  console.log(`> ${text}`);
  await appendMessage(conversation.id, 'in', text, false);

  const { replyText, needsHuman } = await generateReply({
    customerId: customer.id,
    conversationId: conversation.id,
    whatsappNumber: customer.whatsapp_number,
    customerName: customer.name,
  });

  await appendMessage(conversation.id, 'out', replyText, true);
  console.log(`< ${replyText}`);
  if (needsHuman) console.log('  [conversa marcada para atendimento humano]');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { Router, Request } from 'express';
import crypto from 'crypto';
import { WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, OWNER_NOTIFICATION_WHATSAPP_NUMBER } from './config';
import { sendTextMessage } from './client';
import { getOrCreateCustomer, getOrCreateOpenConversation, appendMessage } from './conversation';
import { generateReply } from '../ai/orchestrator';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

function isValidSignature(req: RequestWithRawBody): boolean {
  if (!WHATSAPP_APP_SECRET) return true; // permite testar localmente sem app secret configurado
  const signature = req.header('X-Hub-Signature-256');
  if (!signature || !req.rawBody) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', WHATSAPP_APP_SECRET).update(req.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function createWhatsAppWebhookRouter(): Router {
  const router = Router();

  // Passo de verificação exigido pela Meta ao cadastrar a URL do webhook.
  router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  router.post('/webhook', async (req: RequestWithRawBody, res) => {
    // Responde 200 imediatamente é o esperado pela Meta; processamos antes de
    // responder aqui porque o volume de uma barbearia é baixo o suficiente
    // para não precisar de fila — revisar se o volume crescer muito.
    if (!isValidSignature(req)) {
      return res.sendStatus(401);
    }
    res.sendStatus(200);

    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      if (!message) return; // status update (entregue/lido) ou outro evento — ignora por ora

      const from: string = message.from;
      const profileName: string | null = value?.contacts?.[0]?.profile?.name || null;

      const customer = await getOrCreateCustomer(from, profileName);
      const conversation = await getOrCreateOpenConversation(customer.id);

      if (message.type !== 'text') {
        const notice = 'Recebi sua mensagem, mas por enquanto só consigo entender texto. Pode escrever, por favor?';
        await appendMessage(conversation.id, 'in', `[mensagem do tipo ${message.type}]`, false);
        await appendMessage(conversation.id, 'out', notice, false);
        await sendTextMessage(from, notice);
        return;
      }

      const text: string = message.text?.body || '';
      await appendMessage(conversation.id, 'in', text, false);

      if (conversation.status === 'needs_human') {
        // Um humano assume a partir daqui — ver painel admin / rota de resposta manual.
        return;
      }

      const { replyText, needsHuman } = await generateReply({
        customerId: customer.id,
        conversationId: conversation.id,
        whatsappNumber: customer.whatsapp_number,
        customerName: customer.name,
      });

      if (replyText) {
        await appendMessage(conversation.id, 'out', replyText, true);
        await sendTextMessage(from, replyText);
      }

      if (needsHuman && OWNER_NOTIFICATION_WHATSAPP_NUMBER) {
        // Melhor esforço — texto livre só chega se o número do dono estiver
        // dentro da janela de 24h com o número do WhatsApp Business. A lista
        // de conversas do painel é o canal confiável para isso.
        sendTextMessage(
          OWNER_NOTIFICATION_WHATSAPP_NUMBER,
          `Uma conversa precisa de atenção humana (cliente: ${customer.name || from}).`
        ).catch((err) => console.warn('[whatsapp] falha ao notificar o dono:', err.message));
      }
    } catch (err) {
      console.error('[whatsapp] erro processando webhook:', err);
    }
  });

  return router;
}

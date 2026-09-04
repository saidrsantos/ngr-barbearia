import { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION } from './config';

const GRAPH_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

async function callGraphAPI(body: Record<string, unknown>): Promise<void> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[whatsapp] WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados — mensagem não enviada:', body);
    return;
  }
  const res = await fetch(`${GRAPH_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`WhatsApp Graph API respondeu ${res.status}: ${errBody}`);
  }
}

/** Texto livre — só é aceito pela Meta dentro da janela de 24h de atendimento. */
export async function sendTextMessage(to: string, text: string): Promise<void> {
  await callGraphAPI({
    to,
    type: 'text',
    text: { body: text },
  });
}

/**
 * Mensagem por template pré-aprovado — necessária para qualquer mensagem
 * proativa fora da janela de 24h (lembrete, recuperação de cliente). Os
 * templates precisam ser criados e aprovados no Meta Business Manager antes
 * de usar aqui.
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[] = []
): Promise<void> {
  await callGraphAPI({
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: bodyParams.length
        ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
        : [],
    },
  });
}

// Único arquivo que lê variáveis de ambiente do WhatsApp Cloud API.
export const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
export const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
export const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
export const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
export const WHATSAPP_API_VERSION = 'v20.0';
export const OWNER_NOTIFICATION_WHATSAPP_NUMBER =
  process.env.OWNER_NOTIFICATION_WHATSAPP_NUMBER || '';
export const BUSINESS_NAME = process.env.BUSINESS_NAME || 'NGR Barbearia';

// Nomes dos templates pré-aprovados no Meta Business Manager (obrigatório
// para mensagens proativas fora da janela de 24h). Cadastrar lá antes de usar.
export const WHATSAPP_TEMPLATE_REMINDER = process.env.WHATSAPP_TEMPLATE_REMINDER || 'lembrete_agendamento';
export const WHATSAPP_TEMPLATE_RECOVERY = process.env.WHATSAPP_TEMPLATE_RECOVERY || 'recuperacao_cliente';
export const WHATSAPP_TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR';

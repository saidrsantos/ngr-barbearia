import OpenAI from 'openai';

// Único arquivo que lê variáveis de ambiente de IA — chave própria da NGR,
// isolada de qualquer outro sistema.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada no .env');
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

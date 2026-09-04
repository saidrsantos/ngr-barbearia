import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { getOpenAIClient, OPENAI_MODEL } from './config';
import { buildSystemPrompt } from './systemPrompt';
import { tools, createToolExecutor, ToolContext } from './tools';

interface MessageRow extends RowDataPacket {
  direction: 'in' | 'out';
  content: string;
}

export interface OrchestrateResult {
  replyText: string;
  needsHuman: boolean;
}

const MAX_TOOL_ROUNDS = 5;
const HISTORY_LIMIT = 20;

/**
 * Gera a próxima resposta da IA para uma conversa: monta o prompt de sistema
 * a partir do banco, carrega o histórico recente e deixa o modelo decidir
 * entre responder em texto ou acionar ferramentas (que sempre batem no
 * AppointmentProvider — a IA nunca inventa disponibilidade).
 */
export async function generateReply(ctx: ToolContext): Promise<OrchestrateResult> {
  const systemPrompt = await buildSystemPrompt();

  const [historyRows] = await pool.query<MessageRow[]>(
    'SELECT direction, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
    [ctx.conversationId, HISTORY_LIMIT]
  );
  const history: ChatCompletionMessageParam[] = historyRows.reverse().map((r) => ({
    role: r.direction === 'in' ? 'user' : 'assistant',
    content: r.content,
  }));

  const client = getOpenAIClient();
  const { execute } = createToolExecutor(ctx);
  let needsHuman = false;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      tools,
    });
    const message = completion.choices[0].message;
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { replyText: message.content || '', needsHuman };
    }

    for (const call of message.tool_calls) {
      if (call.type !== 'function') continue;
      const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      const result = await execute(call.function.name, args);
      if (call.function.name === 'encaminhar_para_humano') needsHuman = true;
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Excedeu o limite de idas-e-vindas com ferramentas sem chegar numa resposta final.
  needsHuman = true;
  return {
    replyText: 'Deixa eu confirmar isso com a equipe rapidinho e já te retorno por aqui!',
    needsHuman,
  };
}

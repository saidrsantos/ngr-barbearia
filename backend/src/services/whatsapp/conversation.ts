import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../db/pool';

export interface CustomerRecord extends RowDataPacket {
  id: number;
  whatsapp_number: string;
  name: string | null;
}

export interface ConversationRecord extends RowDataPacket {
  id: number;
  customer_id: number;
  status: 'browsing' | 'scheduling' | 'scheduled' | 'needs_human' | 'abandoned_followup_sent';
}

export async function getOrCreateCustomer(
  whatsappNumber: string,
  profileName: string | null
): Promise<CustomerRecord> {
  const [existing] = await pool.query<CustomerRecord[]>(
    'SELECT * FROM customers WHERE whatsapp_number = ?',
    [whatsappNumber]
  );
  if (existing[0]) {
    if (!existing[0].name && profileName) {
      await pool.execute('UPDATE customers SET name = ? WHERE id = ?', [profileName, existing[0].id]);
      existing[0].name = profileName;
    }
    return existing[0];
  }
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO customers (whatsapp_number, name) VALUES (?, ?)',
    [whatsappNumber, profileName]
  );
  return { id: result.insertId, whatsapp_number: whatsappNumber, name: profileName } as CustomerRecord;
}

/**
 * Reaproveita a conversa mais recente do cliente. Mantém tudo em uma única
 * conversa "viva" por cliente — suficiente para o MVP, evita fragmentar o
 * histórico que a IA usa como contexto.
 */
export async function getOrCreateOpenConversation(customerId: number): Promise<ConversationRecord> {
  const [existing] = await pool.query<ConversationRecord[]>(
    'SELECT * FROM conversations WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
    [customerId]
  );
  if (existing[0]) return existing[0];

  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO conversations (customer_id, status) VALUES (?, 'browsing')",
    [customerId]
  );
  return { id: result.insertId, customer_id: customerId, status: 'browsing' } as ConversationRecord;
}

export async function appendMessage(
  conversationId: number,
  direction: 'in' | 'out',
  content: string,
  aiGenerated: boolean
): Promise<void> {
  await pool.execute(
    'INSERT INTO messages (conversation_id, direction, content, ai_generated) VALUES (?, ?, ?, ?)',
    [conversationId, direction, content, aiGenerated]
  );
  await pool.execute('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [conversationId]);
}

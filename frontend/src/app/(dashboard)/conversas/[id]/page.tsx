'use client';

import { use, useEffect, useState, FormEvent, useCallback } from 'react';
import Link from 'next/link';
import { conversationsApi, Conversation, Message } from '@/lib/api';

export default function ConversaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const conversationId = parseInt(id, 10);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([conversationsApi.get(conversationId), conversationsApi.messages(conversationId)])
      .then(([convRes, msgRes]) => {
        setConversation(convRes.data.data);
        setMessages(msgRes.data.data);
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(load, [load]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await conversationsApi.reply(conversationId, reply.trim());
      setReply('');
      load();
    } finally {
      setSending(false);
    }
  }

  async function handleResumeAi() {
    await conversationsApi.resumeAi(conversationId);
    load();
  }

  if (loading || !conversation) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/conversas" className="mb-4 inline-block text-sm text-gray-500 underline">
        ← Voltar para conversas
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{conversation.customer_name || conversation.whatsapp_number}</h1>
          <p className="text-xs text-gray-400">{conversation.whatsapp_number}</p>
        </div>
        {conversation.status === 'needs_human' && (
          <button onClick={handleResumeAi} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-100">
            Devolver para a IA
          </button>
        )}
      </div>

      {conversation.status === 'needs_human' && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Esta conversa está marcada para atendimento humano — a IA não vai responder até você clicar em &quot;Devolver para a IA&quot;.
        </p>
      )}

      <div className="mb-4 space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.direction === 'out' ? (m.ai_generated ? 'bg-blue-100 text-blue-900' : 'bg-gray-900 text-white') : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p>{m.content}</p>
              <p className="mt-1 text-[10px] opacity-60">
                {new Date(m.created_at).toLocaleString('pt-BR')} {m.ai_generated && '· IA'}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-sm text-gray-400">Sem mensagens ainda.</p>}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Escrever manualmente para o cliente..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

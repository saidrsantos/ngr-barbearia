'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { conversationsApi, Conversation } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  browsing: 'Conversando',
  scheduling: 'Agendando',
  scheduled: 'Agendado',
  needs_human: 'Precisa de humano',
  abandoned_followup_sent: 'Follow-up enviado',
};

const STATUS_COLOR: Record<string, string> = {
  browsing: 'bg-gray-100 text-gray-700',
  scheduling: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-green-100 text-green-700',
  needs_human: 'bg-amber-100 text-amber-800',
  abandoned_followup_sent: 'bg-gray-100 text-gray-500',
};

export default function ConversasPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    conversationsApi
      .list(statusFilter || undefined)
      .then((res) => setConversations(res.data.data))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Conversas</h1>

      <div className="mb-4 flex gap-2">
        {['', 'needs_human', 'browsing', 'scheduled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s === '' ? 'Todas' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/conversas/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300"
            >
              <div>
                <p className="font-medium">{c.customer_name || c.whatsapp_number}</p>
                <p className="text-xs text-gray-400">{new Date(c.last_message_at).toLocaleString('pt-BR')}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[c.status] || ''}`}>
                {STATUS_LABEL[c.status] || c.status}
              </span>
            </Link>
          ))}
          {conversations.length === 0 && <p className="text-sm text-gray-400">Nenhuma conversa por aqui ainda.</p>}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { appointmentsApi, conversationsApi, Appointment, Conversation } from '@/lib/api';

export default function DashboardHomePage() {
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [needsHuman, setNeedsHuman] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString();
    Promise.all([
      appointmentsApi.list({ from: today, status: 'tentative' }),
      conversationsApi.list('needs_human'),
    ])
      .then(([apptRes, convRes]) => {
        setUpcoming(apptRes.data.data);
        setNeedsHuman(convRes.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Agendamentos pendentes de confirmação</p>
          <p className="mt-1 text-2xl font-semibold">{upcoming.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Conversas aguardando atendimento humano</p>
          <p className="mt-1 text-2xl font-semibold">{needsHuman.length}</p>
        </div>
      </div>

      {needsHuman.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-medium text-amber-900">Conversas que precisam de atenção</p>
          <ul className="space-y-1">
            {needsHuman.map((c) => (
              <li key={c.id}>
                <Link href={`/conversas/${c.id}`} className="text-sm text-amber-800 underline">
                  {c.customer_name || c.whatsapp_number}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

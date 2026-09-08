'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, MessageCircleWarning, Receipt, HandCoins } from 'lucide-react';
import { appointmentsApi, conversationsApi, payablesApi, debtsApi, Appointment, Conversation, Payable, Debt } from '@/lib/api';

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isDueSoon(payable: Payable): boolean {
  if (payable.status !== 'pending') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(payable.due_date + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  return diffDays <= 7;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string | number;
  tone: 'emerald' | 'amber' | 'red' | 'gray';
}) {
  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }[tone];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses}`}>
        <Icon size={18} />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

export default function DashboardHomePage() {
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [needsHuman, setNeedsHuman] = useState<Conversation[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString();
    Promise.all([
      appointmentsApi.list({ from: today, status: 'tentative' }),
      conversationsApi.list('needs_human'),
      payablesApi.list('pending'),
      debtsApi.list(),
    ])
      .then(([apptRes, convRes, payRes, debtRes]) => {
        setUpcoming(apptRes.data.data);
        setNeedsHuman(convRes.data.data);
        setPayables(payRes.data.data);
        setDebts(debtRes.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>;

  const dueSoonPayables = payables.filter(isDueSoon);
  const pendingDebtsTotal = debts.reduce((sum, d) => sum + (d.pending_count > 0 ? 1 : 0), 0);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarClock} label="Agendamentos pendentes" value={upcoming.length} tone="emerald" />
        <StatCard icon={MessageCircleWarning} label="Conversas p/ atenção humana" value={needsHuman.length} tone="amber" />
        <StatCard icon={Receipt} label="Contas vencendo em breve" value={dueSoonPayables.length} tone="red" />
        <StatCard icon={HandCoins} label="Barbeiros com dívida em aberto" value={pendingDebtsTotal} tone="gray" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {needsHuman.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-400">Conversas que precisam de atenção</p>
            <ul className="space-y-1">
              {needsHuman.map((c) => (
                <li key={c.id}>
                  <Link href={`/conversas/${c.id}`} className="text-sm text-amber-800 underline dark:text-amber-400">
                    {c.customer_name || c.whatsapp_number}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {dueSoonPayables.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="mb-2 text-sm font-medium text-red-900 dark:text-red-400">Contas vencendo em breve</p>
            <ul className="space-y-1">
              {dueSoonPayables.map((p) => (
                <li key={p.id}>
                  <Link href="/contas-a-pagar" className="text-sm text-red-800 underline dark:text-red-400">
                    {p.description} — {formatBRL(p.amount_cents)} ({new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')})
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

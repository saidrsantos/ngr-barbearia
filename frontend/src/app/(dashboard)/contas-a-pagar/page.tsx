'use client';

import { useEffect, useState, FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { payablesApi, Payable } from '@/lib/api';

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const DUE_SOON_DAYS = 7;

function dueStatus(payable: Payable): { label: string; className: string } {
  if (payable.status === 'paid') {
    return { label: 'Paga', className: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(payable.due_date + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return { label: 'Atrasada', className: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' };
  }
  if (diffDays <= DUE_SOON_DAYS) {
    return {
      label: diffDays === 0 ? 'Vence hoje' : `Vence em ${diffDays}d`,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400',
    };
  }
  return { label: 'Pendente', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
}

export default function ContasAPagarPage() {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    payablesApi
      .list()
      .then((res) => setPayables(res.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(amount.replace(',', '.')) * 100);
      await payablesApi.create({ description, amount_cents: amountCents, due_date: dueDate });
      setDescription('');
      setAmount('');
      setDueDate('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(payable: Payable) {
    if (payable.status === 'pending') {
      await payablesApi.pay(payable.id);
    } else {
      await payablesApi.unpay(payable.id);
    }
    load();
  }

  async function handleRemove(id: number) {
    await payablesApi.remove(id);
    load();
  }

  const dueSoonCount = payables.filter((p) => {
    if (p.status !== 'pending') return false;
    const s = dueStatus(p);
    return s.label !== 'Pendente';
  }).length;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Contas a pagar</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Aluguel, fornecedores, contas — o que a barbearia deve pagar. Contas atrasadas ou perto do vencimento (
        {DUE_SOON_DAYS} dias) ficam destacadas.
      </p>

      {dueSoonCount > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          <AlertTriangle size={16} />
          {dueSoonCount} conta{dueSoonCount > 1 ? 's' : ''} vencendo em breve ou atrasada{dueSoonCount > 1 ? 's' : ''}.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-5"
      >
        <input
          placeholder="Descrição (ex: Aluguel de setembro)"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:col-span-2"
        />
        <input
          placeholder="Valor (R$)"
          required
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <input
          type="date"
          required
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {saving ? 'Salvando...' : 'Adicionar conta'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Descrição</th>
                <th className="px-4 py-2">Valor</th>
                <th className="px-4 py-2">Vencimento</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {payables.map((p) => {
                const status = dueStatus(p);
                return (
                  <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{p.description}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatBRL(p.amount_cents)}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggle(p)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => handleRemove(p.id)} className="text-xs text-red-600 underline dark:text-red-400">
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {payables.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                    Nenhuma conta cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

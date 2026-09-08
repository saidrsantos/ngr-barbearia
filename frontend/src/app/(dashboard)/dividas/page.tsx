'use client';

import { useEffect, useState, FormEvent } from 'react';
import { debtsApi, barbersApi, Debt, DebtInstallment, Barber } from '@/lib/api';

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function InstallmentsList({ debtId }: { debtId: number }) {
  const [installments, setInstallments] = useState<DebtInstallment[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    debtsApi
      .installments(debtId)
      .then((res) => setInstallments(res.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [debtId]);

  async function toggle(installment: DebtInstallment) {
    if (installment.status === 'pending') {
      await debtsApi.payInstallment(installment.id);
    } else {
      await debtsApi.unpayInstallment(installment.id);
    }
    load();
  }

  if (loading) return <p className="px-4 py-3 text-xs text-gray-400">Carregando parcelas...</p>;

  return (
    <div className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50">
      {installments.map((inst) => (
        <div key={inst.id} className="flex items-center justify-between px-4 py-2 text-sm">
          <div>
            <span className="font-medium">Parcela {inst.installment_number}</span>{' '}
            <span className="text-gray-500">— vence {new Date(inst.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{formatBRL(inst.amount_cents)}</span>
            <button
              onClick={() => toggle(inst)}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                inst.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {inst.status === 'paid' ? 'Pago' : 'Pendente'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DividasPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [barberId, setBarberId] = useState('');
  const [description, setDescription] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState('1');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([debtsApi.list(), barbersApi.list()])
      .then(([debtsRes, barbersRes]) => {
        setDebts(debtsRes.data.data);
        setBarbers(barbersRes.data.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const totalCents = Math.round(parseFloat(totalValue.replace(',', '.')) * 100);
      await debtsApi.create({
        barber_id: parseInt(barberId, 10),
        description,
        total_cents: totalCents,
        installments_count: parseInt(installmentsCount, 10),
        first_due_date: firstDueDate,
      });
      setBarberId('');
      setDescription('');
      setTotalValue('');
      setInstallmentsCount('1');
      setFirstDueDate('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: number) {
    await debtsApi.remove(id);
    if (expandedId === id) setExpandedId(null);
    load();
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Dívidas dos barbeiros</h1>
      <p className="mb-6 text-sm text-gray-500">
        Compras/adiantamentos que você faz pro barbeiro (ex: máquina de corte), pagos de volta em parcelas — pra não perder conta na hora do fechamento.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-5"
      >
        <select
          required
          value={barberId}
          onChange={(e) => setBarberId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Barbeiro</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Descrição (ex: Máquina de corte)"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          placeholder="Valor total (R$)"
          required
          inputMode="decimal"
          value={totalValue}
          onChange={(e) => setTotalValue(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Parcelas"
          required
          type="number"
          min={1}
          value={installmentsCount}
          onChange={(e) => setInstallmentsCount(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="text-xs text-gray-500 sm:col-span-2">
          Vencimento da 1ª parcela
          <input
            type="date"
            required
            value={firstDueDate}
            onChange={(e) => setFirstDueDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="self-end rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 sm:col-span-3"
        >
          {saving ? 'Salvando...' : 'Registrar dívida'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {debts.map((debt) => (
            <div key={debt.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button
                onClick={() => setExpandedId(expandedId === debt.id ? null : debt.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="font-medium">
                    {debt.barber_name} — {debt.description}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatBRL(debt.total_cents)} em {debt.installments_count}x
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {debt.pending_count > 0 ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                      {debt.pending_count} pendente{debt.pending_count > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Quitado</span>
                  )}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(debt.id);
                    }}
                    className="text-xs text-red-600 underline"
                  >
                    Excluir
                  </span>
                </div>
              </button>
              {expandedId === debt.id && <InstallmentsList debtId={debt.id} />}
            </div>
          ))}
          {debts.length === 0 && <p className="text-sm text-gray-400">Nenhuma dívida registrada ainda.</p>}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { appointmentsApi, Appointment } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  tentative: 'Tentativo',
  confirmed: 'Confirmado',
  reminded: 'Lembrado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

export default function AgendamentosPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    appointmentsApi
      .list(statusFilter ? { status: statusFilter } : undefined)
      .then((res) => setAppointments(res.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  async function handleConfirm(id: number) {
    await appointmentsApi.confirm(id);
    load();
  }

  async function handleCancel(id: number) {
    await appointmentsApi.cancel(id);
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Agendamentos</h1>

      <div className="mb-4 flex gap-2">
        {['', 'tentative', 'confirmed', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s === '' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Data/hora</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Serviço</th>
                <th className="px-4 py-2">Barbeiro</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{new Date(a.scheduled_at).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2">
                    <p>{a.customer_name || '—'}</p>
                    <p className="text-xs text-gray-400">{a.whatsapp_number}</p>
                  </td>
                  <td className="px-4 py-2">{a.service_name}</td>
                  <td className="px-4 py-2">{a.barber_name || '—'}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[a.status] || a.status}</td>
                  <td className="px-4 py-2 text-right">
                    {a.status === 'tentative' && (
                      <button onClick={() => handleConfirm(a.id)} className="mr-3 text-xs text-green-700 underline">
                        Confirmar
                      </button>
                    )}
                    {a.status !== 'cancelled' && a.status !== 'completed' && (
                      <button onClick={() => handleCancel(a.id)} className="text-xs text-red-600 underline">
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Nenhum agendamento por aqui ainda.
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

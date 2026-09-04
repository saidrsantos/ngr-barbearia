'use client';

import { useEffect, useState, FormEvent } from 'react';
import { businessHoursApi, barbersApi, BusinessHour, Barber } from '@/lib/api';

const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function HorariosPage() {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('19:00');
  const [barberId, setBarberId] = useState('');
  const [saving, setSaving] = useState(false);

  const [newBarberName, setNewBarberName] = useState('');

  function load() {
    setLoading(true);
    Promise.all([businessHoursApi.list(), barbersApi.list()])
      .then(([hRes, bRes]) => {
        setHours(hRes.data.data);
        setBarbers(bRes.data.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAddHour(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await businessHoursApi.create({
        day_of_week: parseInt(dayOfWeek, 10),
        open_time: openTime,
        close_time: closeTime,
        barber_id: barberId ? parseInt(barberId, 10) : null,
      });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveHour(id: number) {
    await businessHoursApi.remove(id);
    load();
  }

  async function handleAddBarber(e: FormEvent) {
    e.preventDefault();
    if (!newBarberName.trim()) return;
    await barbersApi.create({ name: newBarberName.trim() });
    setNewBarberName('');
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Horário de funcionamento</h1>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-3 text-sm font-medium">Barbeiros</p>
        <form onSubmit={handleAddBarber} className="mb-3 flex gap-2">
          <input
            placeholder="Nome do barbeiro"
            value={newBarberName}
            onChange={(e) => setNewBarberName(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Adicionar
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {barbers.map((b) => (
            <span key={b.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
              {b.name}
            </span>
          ))}
          {barbers.length === 0 && <p className="text-xs text-gray-400">Nenhum barbeiro cadastrado — os horários abaixo valem pra barbearia toda.</p>}
        </div>
      </div>

      <form onSubmit={handleAddHour} className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-5">
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          {DAYS.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <select value={barberId} onChange={(e) => setBarberId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">Barbearia toda</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Adicionar horário'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Dia</th>
                <th className="px-4 py-2">Abre</th>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Barbeiro</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{DAYS[h.day_of_week]}</td>
                  <td className="px-4 py-2">{h.open_time}</td>
                  <td className="px-4 py-2">{h.close_time}</td>
                  <td className="px-4 py-2">{barbers.find((b) => b.id === h.barber_id)?.name || 'Barbearia toda'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleRemoveHour(h.id)} className="text-xs text-gray-500 underline">
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {hours.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Nenhum horário cadastrado ainda — a IA não vai conseguir oferecer horários até isso ser preenchido.
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

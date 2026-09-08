'use client';

import { useEffect, useState, FormEvent } from 'react';
import { businessHoursApi, barbersApi, BusinessHour, Barber } from '@/lib/api';

const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const inputClass =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-emerald-500';

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

  async function updateBarberAppbarberCode(barber: Barber, value: string) {
    const code = value ? parseInt(value, 10) : null;
    await barbersApi.update(barber.id, { ...barber, appbarber_code: code });
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Horário de funcionamento</h1>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Barbeiros</p>
        <form onSubmit={handleAddBarber} className="mb-3 flex gap-2">
          <input
            placeholder="Nome do barbeiro"
            value={newBarberName}
            onChange={(e) => setNewBarberName(e.target.value)}
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Adicionar
          </button>
        </form>
        <div className="space-y-1">
          {barbers.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{b.name}</span>
              <label className="text-xs text-gray-400 dark:text-gray-500">
                Código App Barber:{' '}
                <input
                  type="number"
                  defaultValue={b.appbarber_code ?? ''}
                  placeholder="—"
                  onBlur={(e) => {
                    if (e.target.value !== String(b.appbarber_code ?? '')) updateBarberAppbarberCode(b, e.target.value);
                  }}
                  className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
            </div>
          ))}
          {barbers.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Nenhum barbeiro cadastrado — os horários abaixo valem pra barbearia toda.
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={handleAddHour}
        className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-5"
      >
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={inputClass}>
          {DAYS.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className={inputClass} />
        <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className={inputClass} />
        <select value={barberId} onChange={(e) => setBarberId(e.target.value)} className={inputClass}>
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
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {saving ? 'Salvando...' : 'Adicionar horário'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
                <tr key={h.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{DAYS[h.day_of_week]}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{h.open_time}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{h.close_time}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {barbers.find((b) => b.id === h.barber_id)?.name || 'Barbearia toda'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleRemoveHour(h.id)} className="text-xs text-gray-500 underline dark:text-gray-400">
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {hours.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
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

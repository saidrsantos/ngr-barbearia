'use client';

import { useEffect, useState, FormEvent } from 'react';
import { servicesApi, Service } from '@/lib/api';

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const inputClass =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-emerald-500';

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [appbarberCode, setAppbarberCode] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    servicesApi
      .list()
      .then((res) => setServices(res.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(price.replace(',', '.')) * 100);
      await servicesApi.create({
        name,
        description: description || null,
        price_cents: priceCents,
        duration_min: parseInt(duration, 10),
        appbarber_code: appbarberCode ? parseInt(appbarberCode, 10) : null,
      });
      setName('');
      setDescription('');
      setPrice('');
      setDuration('30');
      setAppbarberCode('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: Service) {
    if (service.active) {
      await servicesApi.remove(service.id);
    } else {
      await servicesApi.update(service.id, { ...service, active: true });
    }
    load();
  }

  async function updateAppbarberCode(service: Service, value: string) {
    const code = value ? parseInt(value, 10) : null;
    await servicesApi.update(service.id, { ...service, appbarber_code: code });
    load();
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Serviços</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        O &quot;Código App Barber&quot; liga esse serviço ao serviço correspondente lá no App Barber — preencha quando a
        agenda estiver usando a integração real (em vez da agenda interna).
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-6"
      >
        <input
          placeholder="Nome do serviço"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          placeholder="Preço (R$)"
          required
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Duração (min)"
          required
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Código App Barber (opcional)"
          type="number"
          value={appbarberCode}
          onChange={(e) => setAppbarberCode(e.target.value)}
          className={`${inputClass} sm:col-span-2`}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:col-span-2"
        >
          {saving ? 'Salvando...' : 'Adicionar serviço'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Preço</th>
                <th className="px-4 py-2">Duração</th>
                <th className="px-4 py-2">Código App Barber</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-500 dark:text-gray-400">{s.description}</p>}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatBRL(s.price_cents)}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{s.duration_min} min</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      defaultValue={s.appbarber_code ?? ''}
                      placeholder="—"
                      onBlur={(e) => {
                        if (e.target.value !== String(s.appbarber_code ?? '')) updateAppbarberCode(s, e.target.value);
                      }}
                      className="w-24 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <span className={s.active ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => toggleActive(s)} className="text-xs text-gray-500 underline dark:text-gray-400">
                      {s.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                    Nenhum serviço cadastrado ainda.
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

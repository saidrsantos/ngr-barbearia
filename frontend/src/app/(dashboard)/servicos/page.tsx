'use client';

import { useEffect, useState, FormEvent } from 'react';
import { servicesApi, Service } from '@/lib/api';

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
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
      });
      setName('');
      setDescription('');
      setPrice('');
      setDuration('30');
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

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Serviços</h1>

      <form onSubmit={handleSubmit} className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-5">
        <input
          placeholder="Nome do serviço"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          placeholder="Preço (R$)"
          required
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Duração (min)"
          required
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 sm:col-span-2"
        >
          {saving ? 'Salvando...' : 'Adicionar serviço'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Preço</th>
                <th className="px-4 py-2">Duração</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <p className="font-medium">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
                  </td>
                  <td className="px-4 py-2">{formatBRL(s.price_cents)}</td>
                  <td className="px-4 py-2">{s.duration_min} min</td>
                  <td className="px-4 py-2">
                    <span className={s.active ? 'text-green-700' : 'text-gray-400'}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => toggleActive(s)} className="text-xs text-gray-500 underline">
                      {s.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
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

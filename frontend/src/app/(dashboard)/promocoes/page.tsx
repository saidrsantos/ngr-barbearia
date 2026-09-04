'use client';

import { useEffect, useState, FormEvent } from 'react';
import { promotionsApi, Promotion } from '@/lib/api';

export default function PromocoesPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    promotionsApi
      .list()
      .then((res) => setPromotions(res.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await promotionsApi.create({
        title,
        description,
        valid_from: validFrom || null,
        valid_to: validTo || null,
      });
      setTitle('');
      setDescription('');
      setValidFrom('');
      setValidTo('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: Promotion) {
    if (promo.active) {
      await promotionsApi.remove(promo.id);
    } else {
      await promotionsApi.update(promo.id, { ...promo, active: true });
    }
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Promoções</h1>
      <p className="mb-4 text-sm text-gray-500">
        Promoções ativas e dentro do período de validade entram automaticamente no que a IA conta pro cliente no WhatsApp.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-4">
        <input
          placeholder="Título"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          type="date"
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={validTo}
          onChange={(e) => setValidTo(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Descrição — o que vale, condições etc."
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-4"
          rows={2}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 sm:col-span-4"
        >
          {saving ? 'Salvando...' : 'Adicionar promoção'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {promotions.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-gray-600">{p.description}</p>
                  {(p.valid_from || p.valid_to) && (
                    <p className="mt-1 text-xs text-gray-400">
                      Válida {p.valid_from ? `de ${p.valid_from}` : ''} {p.valid_to ? `até ${p.valid_to}` : ''}
                    </p>
                  )}
                </div>
                <button onClick={() => toggleActive(p)} className="shrink-0 text-xs text-gray-500 underline">
                  {p.active ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          ))}
          {promotions.length === 0 && <p className="text-sm text-gray-400">Nenhuma promoção cadastrada ainda.</p>}
        </div>
      )}
    </div>
  );
}

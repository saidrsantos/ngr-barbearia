'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/conversas', label: 'Conversas' },
  { href: '/agendamentos', label: 'Agendamentos' },
  { href: '/servicos', label: 'Serviços' },
  { href: '/promocoes', label: 'Promoções' },
  { href: '/horarios', label: 'Horários' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-4">
        <p className="text-sm font-semibold">NGR Barbearia</p>
        <p className="text-xs text-gray-500">{user?.name}</p>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="m-2 rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
      >
        Sair
      </button>
    </aside>
  );
}

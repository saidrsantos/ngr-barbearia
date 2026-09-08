'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageCircle,
  Calendar,
  Scissors,
  Tag,
  Clock,
  HandCoins,
  Receipt,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conversas', label: 'Conversas', icon: MessageCircle },
  { href: '/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/servicos', label: 'Serviços', icon: Scissors },
  { href: '/promocoes', label: 'Promoções', icon: Tag },
  { href: '/horarios', label: 'Horários', icon: Clock },
  { href: '/dividas', label: 'Dívidas', icon: HandCoins },
  { href: '/contas-a-pagar', label: 'Contas a pagar', icon: Receipt },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-800">
        <Image src="/logo.png" alt="NGR Barbearia" width={36} height={36} className="rounded-full ring-1 ring-gray-200 dark:ring-gray-700" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">NGR Barbearia</p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.name}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
              }`}
            >
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-gray-200 p-3 dark:border-gray-800">
        <button
          onClick={logout}
          className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <LogOut size={15} />
          Sair
        </button>
        <ThemeToggle />
      </div>
    </aside>
  );
}

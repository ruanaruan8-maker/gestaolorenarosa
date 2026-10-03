
import { useMemo } from 'react';

import {
  Users,
  MessageCircle,
  Clock,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

import type {
  ClientWithMeta,
  ClientFilter,
} from '@/lib/types';

interface DashboardProps {
  clients: ClientWithMeta[];

  settings: unknown;

  onNavigate: (
    view:
      | 'clients'
      | 'messages'
      | 'import'
      | 'settings'
  ) => void;

  onSelectBucket: (
    bucket: ClientFilter
  ) => void;
}

function getDaysSincePurchase(
  dateValue: string | null | undefined
): number {
  if (!dateValue) {
    return 0;
  }

  const dateString = String(dateValue).slice(0, 10);

  const parts = dateString.split('-');

  if (parts.length !== 3) {
    return 0;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return 0;
  }

  const purchaseDate = new Date(
    year,
    month - 1,
    day
  );

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const difference =
    today.getTime() -
    purchaseDate.getTime();

  const days = Math.floor(
    difference /
      (1000 * 60 * 60 * 24)
  );

  return Math.max(0, days);
}

export function Dashboard({
  clients,
  onNavigate,
  onSelectBucket,
}: DashboardProps) {
  const stats = useMemo(() => {
    const buckets = {
      green: 0,
      yellow: 0,
      orange: 0,
      rose: 0,
      red: 0,
    };

    clients.forEach((client) => {
      const days =
        getDaysSincePurchase(
          client.data_ultima_compra
        );

      if (days <= 9) {
        buckets.green++;
        return;
      }

      if (days <= 30) {
        buckets.yellow++;
        return;
      }

      if (days <= 60) {
        buckets.orange++;
        return;
      }

      if (days <= 90) {
        buckets.rose++;
        return;
      }

      buckets.red++;
    });

    return {
      total: clients.length,
      buckets,
    };
  }, [clients]);

  const cards = [
    {
      label: 'Total',
      value: stats.total,
      icon: Users,
      color: 'text-stone-700',
      bg: 'bg-stone-100',
      action: () =>
        onSelectBucket('all'),
    },

    {
      label: 'Até 9 dias',
      value: stats.buckets.green,
      icon: Clock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      action: () =>
        onSelectBucket('new'),
    },

    {
      label: '10 a 30 dias',
      value: stats.buckets.yellow,
      icon: MessageCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      action: () =>
        onSelectBucket('10_30'),
    },

    {
      label: '31 a 60 dias',
      value: stats.buckets.orange,
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      action: () =>
        onSelectBucket('31_60'),
    },

    {
      label: '61 a 90 dias',
      value: stats.buckets.rose,
      icon: Clock,
      color: 'text-rose-500',
      bg: 'bg-rose-50',
      action: () =>
        onSelectBucket('61_90'),
    },

    {
      label: '91+ dias',
      value: stats.buckets.red,
      icon: Clock,
      color: 'text-red-600',
      bg: 'bg-red-50',
      action: () =>
        onSelectBucket('90_plus'),
    },
  ];

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}

      <div>
        <h2 className="text-2xl font-bold text-stone-800">
          Painel de Gestão
        </h2>

        <p className="text-stone-400 text-sm mt-1">
          Lorena Rosa — Gestão de Clientes
        </p>
      </div>

      {/* =====================================================
          CARDS
          Sempre 3 colunas — computador e celular
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-3
          gap-3
          max-w-5xl
        "
      >
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.label}
              type="button"
              onClick={card.action}
              className="
                group
                bg-white
                rounded-xl
                border
                border-stone-200
                p-3
                sm:p-4
                text-left
                hover:shadow-md
                hover:border-stone-300
                transition-all
                duration-200
                min-w-0
              "
            >
              {/* Ícone */}

              <div
                className={`
                  w-8
                  h-8
                  sm:w-10
                  sm:h-10
                  rounded-lg
                  ${card.bg}
                  flex
                  items-center
                  justify-center
                  mb-2
                  sm:mb-3
                `}
              >
                <Icon
                  className={`
                    w-4
                    h-4
                    sm:w-5
                    sm:h-5
                    ${card.color}
                  `}
                />
              </div>

              {/* Número */}

              <p
                className="
                  text-xl
                  sm:text-2xl
                  font-bold
                  text-stone-800
                  tabular-nums
                  truncate
                "
              >
                {card.value}
              </p>

              {/* Nome */}

              <p
                className="
                  text-[10px]
                  sm:text-xs
                  text-stone-400
                  mt-1
                  leading-tight
                  min-h-[24px]
                "
              >
                {card.label}
              </p>

              {/* Link */}

              <div
                className="
                  flex
                  items-center
                  gap-0.5
                  mt-2
                  text-[10px]
                  sm:text-xs
                  text-stone-300
                  group-hover:text-stone-500
                  transition-colors
                  whitespace-nowrap
                "
              >
                Ver

                <ArrowRight
                  className="
                    w-3
                    h-3
                    group-hover:translate-x-0.5
                    transition-transform
                  "
                />
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

import type {
  Client,
  ClientWithMeta,
  PeriodBucket,
} from './types';

export function daysSince(
  dateStr: string | null
): number {
  if (!dateStr) return 0;

  const date = new Date(dateStr);
  const now = new Date();

  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const todayOnly = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const diff = Math.floor(
    (todayOnly.getTime() - dateOnly.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return Math.max(0, diff);
}

export function getPeriodBucket(
  days: number
): PeriodBucket {
  if (days <= 9) return 'green';
  if (days <= 30) return 'yellow';
  if (days <= 60) return 'orange';
  return 'red';
}

export function enrichClient(
  client: Client
): ClientWithMeta {
  const days = daysSince(
    client.data_ultima_compra
  );

  return {
    ...client,
    days_since_purchase: days,
    period_bucket: getPeriodBucket(days),
  };
}

export function enrichClients(
  clients: Client[]
): ClientWithMeta[] {
  return clients.map(enrichClient);
}

export const PERIOD_CONFIG: Record<
  PeriodBucket,
  {
    label: string;
    range: string;
    color: string;
    bgColor: string;
    borderColor: string;
    dotColor: string;
    textColor: string;
  }
> = {
  green: {
    label: 'Clientes novas',
    range: '0–9 dias',
    color: 'emerald',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-700',
  },

  yellow: {
    label: '30 dias',
    range: '10–30 dias',
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-700',
  },

  orange: {
    label: '60 dias',
    range: '31–60 dias',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    dotColor: 'bg-orange-500',
    textColor: 'text-orange-700',
  },

  red: {
    label: '90+ dias',
    range: '61+ dias',
    color: 'rose',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    dotColor: 'bg-rose-500',
    textColor: 'text-rose-700',
  },
};

export function formatDate(
  dateStr: string | null
): string {
  if (!dateStr) return '—';

  const d = new Date(dateStr);

  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(
  dateStr: string | null
): string {
  if (!dateStr) return '—';

  const d = new Date(dateStr);

  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPhone(
  phone: string
): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length >= 11) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7, 11);

    return `(${ddd}) ${part1}-${part2}`;
  }

  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 6);
    const part2 = digits.slice(6, 10);

    return `(${ddd}) ${part1}-${part2}`;
  }

  return phone;
}

export function normalizePhone(
  phone: string
): string {
  return phone.replace(/\D/g, '');
}

export function buildWhatsAppUrl(
  phone: string,
  message: string
): string {
  let digits = phone.replace(/\D/g, '');

  if (
    digits.length === 10 ||
    digits.length === 11
  ) {
    digits = '55' + digits;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(
    message
  )}`;
}

export function fillTemplate(
  template: string,
  name: string
): string {
  return template.replace(
    /\{nome\}/g,
    name.split(' ')[0] || name
  );
}

export function classNames(
  ...classes: (
    | string
    | false
    | undefined
    | null
  )[]
): string {
  return classes.filter(Boolean).join(' ');
}


import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Filter,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { SentMessage } from '@/lib/types';

import {
  formatDateTime,
  formatPhone,
  classNames,
} from '@/lib/utils';

interface MessageHistoryProps {
  settings?: unknown;
}

const PERIOD_LABELS: Record<string, string> = {
  '10_dias': '10 dias',
  '30_dias': '30 dias',
  '60_dias': '60 dias',
  '90_mais': '90+ dias',
};

const WHATSAPP_LABELS: Record<string, string> = {
  whatsapp1: 'Viviane',
  whatsapp2: 'Mickaeli',
};

export function MessageHistory({
  settings,
}: MessageHistoryProps) {
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<
    'all' | 'whatsapp1' | 'whatsapp2'
  >('all');
  const [page, setPage] = useState(0);

  const pageSize = 25;

  const loadMessages = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('mensagens_enviadas')
        .select(`
          id,
          cliente_id,
          periodo,
          mensagem,
          whatsapp_id,
          data_envio,
          clientes (
            nome,
            telefone
          )
        `)
        .order('data_envio', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Erro ao carregar histórico:',
          error
        );
        setMessages([]);
        return;
      }

      setMessages(
        (data || []) as unknown as SentMessage[]
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const filtered = useMemo(() => {
    let result = [...messages];

    if (accountFilter !== 'all') {
      result = result.filter(
        (message) =>
          message.whatsapp_id === accountFilter
      );
    }

    if (search.trim()) {
      const query = search
        .toLowerCase()
        .trim();

      const phoneQuery =
        query.replace(/\D/g, '');

      result = result.filter((message) => {
        const clientData =
          (
            message as SentMessage & {
              clientes?: {
                nome?: string;
                telefone?: string;
              } | null;
            }
          ).clientes;

        const name =
          clientData?.nome?.toLowerCase() || '';

        const phone =
          clientData?.telefone?.replace(
            /\D/g,
            ''
          ) || '';

        const text =
          message.mensagem?.toLowerCase() || '';

        return (
          name.includes(query) ||
          (
            phoneQuery.length > 0 &&
            phone.includes(phoneQuery)
          ) ||
          text.includes(query)
        );
      });
    }

    return result;
  }, [
    messages,
    accountFilter,
    search,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length / pageSize
    )
  );

  const safePage = Math.min(
    page,
    totalPages - 1
  );

  const pageData = filtered.slice(
    safePage * pageSize,
    (safePage + 1) * pageSize
  );

  const accountStats = useMemo(() => {
    return {
      total: messages.length,

      wa1: messages.filter(
        (message) =>
          message.whatsapp_id ===
          'whatsapp1'
      ).length,

      wa2: messages.filter(
        (message) =>
          message.whatsapp_id ===
          'whatsapp2'
      ).length,
    };
  }, [messages]);

  function getClientData(
    message: SentMessage
  ) {
    return (
      message as SentMessage & {
        clientes?: {
          nome?: string;
          telefone?: string;
        } | null;
      }
    ).clientes;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-stone-800">
          Histórico de Mensagens
        </h2>

        <p className="text-stone-400 text-sm mt-1">
          Registro de todos os contatos enviados pelo WhatsApp
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="w-4 h-4 text-stone-400" />

            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
              Total
            </span>
          </div>

          <p className="text-2xl font-bold text-stone-800 tabular-nums">
            {accountStats.total}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />

            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
              Viviane
            </span>
          </div>

          <p className="text-2xl font-bold text-stone-800 tabular-nums">
            {accountStats.wa1}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />

            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
              Mickaeli
            </span>
          </div>

          <p className="text-2xl font-bold text-stone-800 tabular-nums">
            {accountStats.wa2}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />

          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Buscar por cliente, telefone ou mensagem..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-400" />

          <button
            type="button"
            onClick={() => {
              setAccountFilter('all');
              setPage(0);
            }}
            className={classNames(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              accountFilter === 'all'
                ? 'bg-stone-800 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            )}
          >
            Todos
          </button>

          <button
            type="button"
            onClick={() => {
              setAccountFilter('whatsapp1');
              setPage(0);
            }}
            className={classNames(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              accountFilter === 'whatsapp1'
                ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            )}
          >
            Viviane
          </button>

          <button
            type="button"
            onClick={() => {
              setAccountFilter('whatsapp2');
              setPage(0);
            }}
            className={classNames(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              accountFilter === 'whatsapp2'
                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            )}
          >
            Mickaeli
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="inline-block w-8 h-8 border-3 border-stone-200 border-t-rose-500 rounded-full animate-spin" />
        </div>
      ) : pageData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-stone-100 mb-4">
            <Inbox className="w-7 h-7 text-stone-300" />
          </div>

          <p className="text-stone-500 font-medium">
            Nenhuma mensagem registrada
          </p>

          <p className="text-sm text-stone-400 mt-1">
            As mensagens enviadas aparecerão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageData.map((message) => {
            const client =
              getClientData(message);

            const isWA1 =
              message.whatsapp_id ===
              'whatsapp1';

            const label =
              WHATSAPP_LABELS[
                message.whatsapp_id
              ] ||
              message.whatsapp_id;

            const periodLabel =
              PERIOD_LABELS[
                message.periodo
              ] ||
              message.periodo;

            return (
              <div
                key={message.id}
                className="bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={classNames(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        isWA1
                          ? 'bg-emerald-50'
                          : 'bg-blue-50'
                      )}
                    >
                      <MessageCircle
                        className={classNames(
                          'w-5 h-5',
                          isWA1
                            ? 'text-emerald-600'
                            : 'text-blue-600'
                        )}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-800 text-sm truncate">
                        {client?.nome ||
                          'Cliente'}
                      </p>

                      <p className="text-xs text-stone-400 mt-0.5">
                        {client?.telefone
                          ? formatPhone(
                              client.telefone
                            )
                          : 'Telefone não informado'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span
                      className={classNames(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        isWA1
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-blue-50 text-blue-600'
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />

                      {label}
                    </span>

                    <p className="text-xs text-stone-400 mt-1.5 flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3" />

                      {formatDateTime(
                        message.data_envio
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 text-xs font-medium">
                    {periodLabel}
                  </span>
                </div>

                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-sm text-stone-600 whitespace-pre-wrap line-clamp-3">
                    {message.mensagem}
                  </p>
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-stone-400">
                Página {safePage + 1} de{' '}
                {totalPages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage(
                      Math.max(
                        0,
                        safePage - 1
                      )
                    )
                  }
                  disabled={
                    safePage === 0
                  }
                  className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPage(
                      Math.min(
                        totalPages - 1,
                        safePage + 1
                      )
                    )
                  }
                  disabled={
                    safePage >=
                    totalPages - 1
                  }
                  className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
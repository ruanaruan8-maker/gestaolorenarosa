
import { useMemo, useState, useEffect } from 'react';
import {
  Search,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';

import type {
  ClientWithMeta,
  ClientFilter,
} from '@/lib/types';

import {
  classNames,
  formatPhone,
  formatDate,
  buildWhatsAppUrl,
} from '@/lib/utils';

import { supabase } from '@/lib/supabase';

interface ClientListProps {
  clients: ClientWithMeta[];
  settings?: unknown;
  templates?: unknown[];
  initialBucket: ClientFilter;
  onClientsChanged: () => void;
}

type SortBy = 'period' | 'name' | 'date';

type MessagePeriod =
  | '10_dias'
  | '30_dias'
  | '60_dias'
  | '90_mais';

function getDaysSincePurchase(
  dateValue: string | null | undefined
): number {
  if (!dateValue) {
    return 0;
  }

  const dateString = String(dateValue).slice(0, 10);

  const [year, month, day] = dateString
    .split('-')
    .map(Number);

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

  return Math.max(
    0,
    Math.floor(
      difference /
        (1000 * 60 * 60 * 24)
    )
  );
}

const FILTER_LABELS: Record<
  Exclude<ClientFilter, 'all'>,
  string
> = {
  new: 'Clientes novas',
  '10_30': '10 a 30 dias',
  '31_60': '31 a 60 dias',
  '61_90': '61 a 90 dias',
  '90_plus': '91+ dias',
};

const FILTER_STYLES: Record<
  Exclude<ClientFilter, 'all'>,
  string
> = {
  new: 'bg-emerald-50 text-emerald-700',
  '10_30': 'bg-amber-50 text-amber-700',
  '31_60': 'bg-orange-50 text-orange-700',
  '61_90': 'bg-rose-50 text-rose-700',
  '90_plus': 'bg-red-50 text-red-700',
};

function getClientFilter(
  days: number
): Exclude<ClientFilter, 'all'> {
  if (days <= 9) return 'new';
  if (days <= 30) return '10_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';

  return '90_plus';
}

function getMessagePeriod(
  days: number
): MessagePeriod | null {
  if (days >= 91) return '90_mais';
  if (days >= 61) return '60_dias';
  if (days >= 31) return '30_dias';
  if (days >= 10) return '10_dias';

  return null;
}

const PERIOD_LABELS: Record<
  MessagePeriod,
  string
> = {
  '10_dias': '10 dias',
  '30_dias': '31 a 60 dias',
  '60_dias': '61 a 90 dias',
  '90_mais': '91+ dias',
};

const MESSAGE_TEMPLATES: Record<
  MessagePeriod,
  string
> = {
  '10_dias':
    'Oi {nome}! Tudo bem?\n\n' +
    'Passando para saber se está tudo certinho com sua última compra na Lorena Rosa. Foi um prazer atender você! 💕\n\n' +
    'Quando precisar, estamos por aqui.\n\n' +
    '📲 Instagram: @lorenarosaaa\n' +
    'https://instagram.com/lorenarosaaa',

  '30_dias':
    'Oi {nome}! Tudo bem? 💕\n\n' +
    'Já faz um tempinho desde sua última visita à Lorena Rosa, e resolvemos passar para saber como você está.\n\n' +
    'Quando quiser dar uma olhadinha por aqui, será um prazer receber você novamente! 😊\n\n' +
    '📲 Instagram: @lorenarosaaa\n' +
    'https://instagram.com/lorenarosaaa',

  '60_dias':
    'Oi {nome}! Como você está? 💕\n\n' +
    'Sentimos sua falta por aqui! Passando para deixar um carinho e dizer que a Lorena Rosa continua à disposição sempre que você precisar. 😊\n\n' +
    'Enquanto isso, você pode acompanhar a gente pelo Instagram:\n\n' +
    '📲 @lorenarosaaa\n' +
    'https://instagram.com/lorenarosaaa',

  '90_mais':
    'Oi {nome}! Tudo bem? 💕\n\n' +
    'Faz um tempinho que não falamos e lembramos de você por aqui.\n\n' +
    'Queríamos deixar nosso carinho e dizer que será um prazer ter você novamente na Lorena Rosa! 😊\n\n' +
    'Enquanto isso, acompanhe as novidades pelo nosso Instagram:\n\n' +
    '📲 @lorenarosaaa\n' +
    'https://instagram.com/lorenarosaaa',
};

export function ClientList({
  clients,
  initialBucket,
  onClientsChanged,
}: ClientListProps) {
  const [search, setSearch] = useState('');

  const [clientFilter, setClientFilter] =
    useState<ClientFilter>(initialBucket);

  const [sortBy, setSortBy] =
    useState<SortBy>('period');

  const [page, setPage] = useState(0);

  const [showMessageModal, setShowMessageModal] =
    useState<ClientWithMeta | null>(null);

  const [messageText, setMessageText] =
    useState('');

  const [whatsappId, setWhatsappId] =
    useState<'whatsapp1' | 'whatsapp2'>(
      'whatsapp1'
    );

  const [sending, setSending] =
    useState(false);

  const pageSize = 20;

  useEffect(() => {
    setClientFilter(initialBucket);
    setPage(0);
  }, [initialBucket]);

  const filtered = useMemo(() => {
    let result = [...clients];

    if (clientFilter !== 'all') {
      result = result.filter((client) => {
        const days =
          getDaysSincePurchase(
            client.data_ultima_compra
          );

        return (
          getClientFilter(days) ===
          clientFilter
        );
      });
    }

    if (search.trim()) {
      const q = search
        .toLowerCase()
        .trim();

      const phoneQuery =
        q.replace(/\D/g, '');

      result = result.filter((client) => {
        const name =
          client.nome.toLowerCase();

        const phone =
          client.telefone.replace(
            /\D/g,
            ''
          );

        return (
          name.includes(q) ||
          (
            phoneQuery.length > 0 &&
            phone.includes(phoneQuery)
          )
        );
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.nome.localeCompare(
          b.nome,
          'pt-BR'
        );
      }

      if (sortBy === 'date') {
        return (
          String(
            b.data_ultima_compra || ''
          ).localeCompare(
            String(
              a.data_ultima_compra || ''
            )
          )
        );
      }

      const daysA =
        getDaysSincePurchase(
          a.data_ultima_compra
        );

      const daysB =
        getDaysSincePurchase(
          b.data_ultima_compra
        );

      return daysA - daysB;
    });

    return result;
  }, [
    clients,
    clientFilter,
    search,
    sortBy,
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

  const counts = useMemo(() => {
    const result = {
      all: clients.length,
      new: 0,
      '10_30': 0,
      '31_60': 0,
      '61_90': 0,
      '90_plus': 0,
    };

    clients.forEach((client) => {
      const days =
        getDaysSincePurchase(
          client.data_ultima_compra
        );

      const filter =
        getClientFilter(days);

      result[filter]++;
    });

    return result;
  }, [clients]);

  function selectFilter(
    filter: ClientFilter
  ) {
    setClientFilter(filter);
    setPage(0);
  }

  function openMessage(
    client: ClientWithMeta
  ) {
    const days =
      getDaysSincePurchase(
        client.data_ultima_compra
      );

    const period =
      getMessagePeriod(days);

    if (!period) {
      return;
    }

    const firstName =
      client.nome.trim().split(/\s+/)[0] ||
      client.nome;

    const message =
      MESSAGE_TEMPLATES[period].replace(
        '{nome}',
        firstName
      );

    setMessageText(message);
    setWhatsappId('whatsapp1');
    setShowMessageModal(client);
  }

  async function handleSendWhatsApp() {
    if (
      !showMessageModal ||
      sending
    ) {
      return;
    }

    const client =
      showMessageModal;

    const days =
      getDaysSincePurchase(
        client.data_ultima_compra
      );

    const period =
      getMessagePeriod(days);

    if (!period) {
      alert(
        'Esta cliente ainda não atingiu o período para mensagem.'
      );
      return;
    }

    if (!messageText.trim()) {
      alert(
        'Digite uma mensagem antes de continuar.'
      );
      return;
    }

    setSending(true);

    try {
      /*
       * REGRA PRINCIPAL:
       * cliente + período só pode ser enviado uma vez,
       * independentemente de ser Viviane ou Mickaeli.
       */
      const {
        data: existingMessages,
        error: checkError,
      } = await supabase
        .from('mensagens_enviadas')
        .select('id')
        .eq(
          'cliente_id',
          client.id
        )
        .eq(
          'periodo',
          period
        )
        .limit(1);

      if (checkError) {
        console.error(
          'Erro ao verificar mensagem:',
          checkError
        );

        alert(
          'Não foi possível verificar se esta cliente já recebeu esta mensagem.'
        );

        return;
      }

      if (
        existingMessages &&
        existingMessages.length > 0
      ) {
        alert(
          'Esta cliente já recebeu a mensagem deste período.'
        );

        setShowMessageModal(null);
        return;
      }

      /*
       * DATA DO DIA NO HORÁRIO DE RECIFE
       */
      const today =
        new Intl.DateTimeFormat(
          'en-CA',
          {
            timeZone:
              'America/Recife',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }
        ).format(new Date());

      /*
       * LIMITE DIÁRIO POR CONTA
       */
      const {
        data: dailyData,
        error: dailyError,
      } = await supabase
        .from(
          'whatsapp_envios_diarios'
        )
        .select('quantidade')
        .eq(
          'data',
          today
        )
        .eq(
          'whatsapp_id',
          whatsappId
        )
        .maybeSingle();

      if (dailyError) {
        console.error(
          'Erro ao verificar limite diário:',
          dailyError
        );

        alert(
          'Não foi possível verificar o limite diário do WhatsApp.'
        );

        return;
      }

      const currentCount =
        Number(
          dailyData?.quantidade || 0
        );

      if (currentCount >= 30) {
        const nomeWhatsApp =
          whatsappId === 'whatsapp1'
            ? 'Viviane'
            : 'Mickaeli';

        alert(
          `A conta ${nomeWhatsApp} já atingiu o limite de 30 mensagens hoje.`
        );

        return;
      }

      /*
       * ABRE O WHATSAPP
       */
      const url =
        buildWhatsAppUrl(
          client.telefone,
          messageText
        );

      window.open(
        url,
        '_blank'
      );

      /*
       * REGISTRA O ENVIO.
       *
       * Se houver uma restrição UNIQUE no banco para
       * cliente_id + periodo, o banco também impede
       * duplicidade em caso de dois envios simultâneos.
       */
      const {
        error: insertError,
      } = await supabase
        .from('mensagens_enviadas')
        .insert({
          cliente_id:
            client.id,
          periodo:
            period,
          mensagem:
            messageText,
          whatsapp_id:
            whatsappId,
        });

      if (insertError) {
        console.error(
          'Erro ao registrar mensagem:',
          insertError
        );

        /*
         * Código 23505 = conflito de registro único.
         * Isso significa que outro usuário/dispositivo
         * registrou o mesmo cliente + período primeiro.
         */
        if (
          insertError.code === '23505'
        ) {
          alert(
            'Esta cliente acabou de receber a mensagem deste período por outro atendimento.'
          );
        } else {
          alert(
            'O WhatsApp foi aberto, mas não foi possível registrar o contato no sistema.'
          );
        }

        return;
      }

      /*
       * ATUALIZA O CONTADOR DIÁRIO
       */
      if (dailyData) {
        const {
          error: updateDailyError,
        } = await supabase
          .from(
            'whatsapp_envios_diarios'
          )
          .update({
            quantidade:
              currentCount + 1,
          })
          .eq(
            'data',
            today
          )
          .eq(
            'whatsapp_id',
            whatsappId
          );

        if (updateDailyError) {
          console.error(
            'Erro ao atualizar contador diário:',
            updateDailyError
          );
        }
      } else {
        const {
          error: insertDailyError,
        } = await supabase
          .from(
            'whatsapp_envios_diarios'
          )
          .insert({
            data: today,
            whatsapp_id:
              whatsappId,
            quantidade: 1,
          });

        if (insertDailyError) {
          console.error(
            'Erro ao criar contador diário:',
            insertDailyError
          );
        }
      }

      setShowMessageModal(null);

      /*
       * Recarrega os clientes para manter
       * dashboard/lista atualizados.
       */
      onClientsChanged();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">

      <div>
        <h2 className="text-2xl font-bold text-stone-800">
          Clientes
        </h2>

        <p className="text-stone-400 text-sm mt-1">
          {filtered.length} cliente(s) encontrado(s)
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4">

        <div className="flex gap-3 flex-wrap">

          <div className="relative flex-1 min-w-[200px]">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(
                  e.target.value
                );
                setPage(0);
              }}
              placeholder="Buscar por nome ou telefone..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
            />

          </div>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as SortBy
              )
            }
            className="px-4 py-2.5 text-sm border border-stone-200 rounded-xl bg-white"
          >
            <option value="period">
              Ordenar por: Período
            </option>

            <option value="name">
              Ordenar por: Nome
            </option>

            <option value="date">
              Ordenar por: Data da compra
            </option>
          </select>

        </div>

        <div className="flex gap-2 flex-wrap items-center">

          <Filter className="w-4 h-4 text-stone-400" />

          <button
            type="button"
            onClick={() =>
              selectFilter('all')
            }
            className={classNames(
              'px-3 py-1.5 rounded-lg text-sm font-medium',
              clientFilter === 'all'
                ? 'bg-stone-800 text-white'
                : 'bg-stone-100 text-stone-600'
            )}
          >
            Todos ({counts.all})
          </button>

          {(
            [
              'new',
              '10_30',
              '31_60',
              '61_90',
              '90_plus',
            ] as const
          ).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() =>
                selectFilter(filter)
              }
              className={classNames(
                'px-3 py-1.5 rounded-lg text-sm font-medium',
                FILTER_STYLES[filter],
                clientFilter === filter &&
                  'ring-2 ring-offset-1 ring-stone-300'
              )}
            >
              {FILTER_LABELS[filter]} (
              {counts[filter]})
            </button>
          ))}

        </div>
      </div>

      <div className="space-y-3">

        {pageData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">

            <Search className="w-10 h-10 mx-auto text-stone-300" />

            <p className="mt-3 text-stone-500">
              Nenhuma cliente encontrada.
            </p>

          </div>
        ) : (
          pageData.map((client) => {
            const days =
              getDaysSincePurchase(
                client.data_ultima_compra
              );

            const period =
              getMessagePeriod(days);

            const filter =
              getClientFilter(days);

            return (
              <div
                key={client.id}
                className="bg-white rounded-2xl border border-stone-200 p-4"
              >

                <div className="flex items-center justify-between gap-4">

                  <div className="min-w-0">

                    <div className="flex items-center gap-2">

                      <div
                        className={classNames(
                          'w-2.5 h-2.5 rounded-full flex-shrink-0',
                          filter === 'new'
                            ? 'bg-emerald-500'
                            : filter === '10_30'
                            ? 'bg-amber-500'
                            : filter === '31_60'
                            ? 'bg-orange-500'
                            : filter === '61_90'
                            ? 'bg-rose-500'
                            : 'bg-red-500'
                        )}
                      />

                      <h3 className="font-semibold text-stone-800 truncate">
                        {client.nome}
                      </h3>

                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-stone-500">

                      <span>
                        {formatPhone(
                          client.telefone
                        )}
                      </span>

                      <span>
                        Última compra:{' '}
                        {formatDate(
                          client.data_ultima_compra
                        )}
                      </span>

                      <span>
                        {days} dias
                      </span>

                      <span>
                        {client.quantidade_compras}{' '}
                        compra(s)
                      </span>

                    </div>

                  </div>

                  {period ? (
                    <button
                      type="button"
                      onClick={() =>
                        openMessage(client)
                      }
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="w-4 h-4" />
                      ENVIAR
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 bg-stone-100 text-stone-400">
                      <MessageCircle className="w-4 h-4" />
                      AGUARDANDO
                    </div>
                  )}

                </div>

              </div>
            );
          })
        )}

      </div>

      <div className="flex items-center justify-between bg-white rounded-2xl border border-stone-200 px-4 py-3">

        <p className="text-sm text-stone-500">
          Página {safePage + 1} de {totalPages}
        </p>

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.max(
                  0,
                  current - 1
                )
              )
            }
            disabled={
              safePage === 0
            }
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(
                  totalPages - 1,
                  current + 1
                )
              )
            }
            disabled={
              safePage >=
              totalPages - 1
            }
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

        </div>

      </div>

      {showMessageModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">

          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">

              <div>
                <h3 className="text-lg font-bold text-stone-800">
                  Enviar mensagem
                </h3>

                <p className="text-sm text-stone-500 mt-1">
                  {showMessageModal.nome}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowMessageModal(null)
                }
                className="p-2 rounded-xl hover:bg-stone-100"
              >
                <X className="w-5 h-5 text-stone-500" />
              </button>

            </div>

            <div className="p-6 space-y-5">

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  WhatsApp
                </label>

                <div className="grid grid-cols-2 gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      setWhatsappId(
                        'whatsapp1'
                      )
                    }
                    className={classNames(
                      'px-4 py-3 rounded-xl border text-sm font-semibold',
                      whatsappId ===
                        'whatsapp1'
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-stone-200 text-stone-600'
                    )}
                  >
                    Viviane
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setWhatsappId(
                        'whatsapp2'
                      )
                    }
                    className={classNames(
                      'px-4 py-3 rounded-xl border text-sm font-semibold',
                      whatsappId ===
                        'whatsapp2'
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-stone-200 text-stone-600'
                    )}
                  >
                    Mickaeli
                  </button>

                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Mensagem
                </label>

                <textarea
                  value={messageText}
                  onChange={(e) =>
                    setMessageText(
                      e.target.value
                    )
                  }
                  rows={6}
                  className="w-full px-4 py-3 border border-stone-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
                />
              </div>

              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setShowMessageModal(null)
                  }
                  className="flex-1 px-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-semibold hover:bg-stone-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={
                    handleSendWhatsApp
                  }
                  disabled={sending}
                  className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {sending
                    ? 'Abrindo...'
                    : 'Abrir WhatsApp'}
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
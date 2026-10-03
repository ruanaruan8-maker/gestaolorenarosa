```tsx
import { useState } from 'react';
import {
  ChevronLeft,
  Phone,
  MessageCircle,
  Calendar,
  Clock,
  FileText,
  Save,
  X,
  Edit3,
  StickyNote,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import type {
  ClientWithMeta,
  Client,
  AppSettings,
  MessageTemplate,
  SentMessage,
} from '@/lib/types';

import {
  PERIOD_CONFIG,
  classNames,
  formatPhone,
  formatDate,
  formatDateTime,
  fillTemplate,
  buildWhatsAppUrl,
} from '@/lib/utils';

import { supabase } from '@/lib/supabase';

interface ClientDetailProps {
  client: ClientWithMeta;
  settings: AppSettings | null;
  templates: MessageTemplate[];
  onBack: () => void;
  onClientsChanged: () => void;
  onClientUpdated: (client: Client) => void;
}

type HistoryMessage = SentMessage & {
  clientes?: {
    nome: string;
    telefone: string;
  } | null;
};

const PERIOD_LABELS: Record<string, string> = {
  '10_dias': '10 dias',
  '30_dias': '30 dias',
  '60_dias': '60 dias',
  '90_mais': '90+ dias',
};

function getMessagePeriod(days: number): string | null {
  if (days >= 10 && days <= 30) return '10_dias';
  if (days >= 31 && days <= 60) return '30_dias';
  if (days >= 61 && days <= 90) return '60_dias';
  if (days >= 91) return '90_mais';
  return null;
}

export function ClientDetail({
  client,
  settings,
  templates,
  onBack,
  onClientsChanged,
  onClientUpdated,
}: ClientDetailProps) {
  const [editing, setEditing] = useState(false);

  const [editName, setEditName] = useState(client.nome);
  const [editPhone, setEditPhone] = useState(client.telefone);
  const [editPurchaseDate, setEditPurchaseDate] = useState(
    client.data_ultima_compra
      ? client.data_ultima_compra.substring(0, 10)
      : ''
  );
  const [editNotes, setEditNotes] = useState(client.observacao || '');

  const [history, setHistory] = useState<HistoryMessage[] | null>(null);

  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');

  const [whatsappAccount, setWhatsappAccount] = useState<
    'whatsapp1' | 'whatsapp2'
  >('whatsapp1');

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const cfg = PERIOD_CONFIG[client.period_bucket];

  const loadHistory = async () => {
    if (history !== null) return;

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
      .eq('cliente_id', client.id)
      .order('data_envio', { ascending: false });

    if (error) {
      console.error('Erro ao carregar histórico:', error);
      setHistory([]);
      return;
    }

    setHistory((data || []) as HistoryMessage[]);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');

    const { data, error } = await supabase
      .from('clientes')
      .update({
        nome: editName.trim(),
        telefone: editPhone.trim(),
        data_ultima_compra: editPurchaseDate || null,
        observacao: editNotes.trim() || null,
      })
      .eq('id', client.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      setSaveMsg('Não foi possível atualizar o cadastro.');
      setSaving(false);
      return;
    }

    if (data) {
      const updatedClient: Client = data as Client;

      onClientUpdated(updatedClient);
      onClientsChanged();

      setSaveMsg('Cadastro atualizado com sucesso.');
      setEditing(false);

      setTimeout(() => {
        setSaveMsg('');
      }, 3000);
    }

    setSaving(false);
  };

  const handleOpenMessage = () => {
    const template = templates.find(
      (t) => t.period_bucket === client.period_bucket
    );

    if (template) {
      setMessageText(fillTemplate(template.content, client.nome));
    } else {
      setMessageText(
        `Oi ${client.nome.split(' ')[0] || client.nome}! Tudo bem?`
      );
    }

    setShowMessageModal(true);
  };

  const handleSendWhatsApp = async () => {
    const period = getMessagePeriod(client.days_since_purchase);

    if (!period) {
      setShowMessageModal(false);
      return;
    }

    const { data: alreadySent, error: checkError } = await supabase
      .from('mensagens_enviadas')
      .select('id')
      .eq('cliente_id', client.id)
      .eq('periodo', period)
      .limit(1);

    if (checkError) {
      console.error('Erro ao verificar mensagem:', checkError);
      return;
    }

    if (alreadySent && alreadySent.length > 0) {
      alert(
        'Esta mensagem já foi registrada para esta cliente neste período.'
      );
      setShowMessageModal(false);
      return;
    }

    const today = new Date();

    const dateString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Recife',
    }).format(today);

    const { data: dailyData, error: dailyError } = await supabase
      .from('whatsapp_envios_diarios')
      .select('quantidade')
      .eq('data', dateString)
      .eq('whatsapp_id', whatsappAccount)
      .maybeSingle();

    if (dailyError) {
      console.error('Erro ao verificar limite diário:', dailyError);
      return;
    }

    const quantidadeHoje = dailyData?.quantidade || 0;

    if (quantidadeHoje >= 30) {
      alert(
        `${whatsappAccount === 'whatsapp1' ? 'Viviane' : 'Mickaeli'} já atingiu o limite de 30 mensagens hoje.`
      );
      return;
    }

    const url = buildWhatsAppUrl(client.telefone, messageText);

    window.open(url, '_blank');

    const { error: insertError } = await supabase
      .from('mensagens_enviadas')
      .insert({
        cliente_id: client.id,
        periodo: period,
        mensagem: messageText,
        whatsapp_id: whatsappAccount,
      });

    if (insertError) {
      console.error('Erro ao registrar mensagem:', insertError);
      return;
    }

    if (dailyData) {
      await supabase
        .from('whatsapp_envios_diarios')
        .update({
          quantidade: quantidadeHoje + 1,
        })
        .eq('data', dateString)
        .eq('whatsapp_id', whatsappAccount);
    } else {
      await supabase
        .from('whatsapp_envios_diarios')
        .insert({
          data: dateString,
          whatsapp_id: whatsappAccount,
          quantidade: 1,
        });
    }

    setHistory(null);
    setShowMessageModal(false);

    await loadHistory();

    onClientsChanged();
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para lista
      </button>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {/* HEADER */}
        <div
          className={classNames(
            'p-6 border-b border-stone-100',
            cfg.bgColor
          )}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                <span className="text-xl font-bold text-stone-700">
                  {client.nome.charAt(0).toUpperCase()}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-stone-800">
                  {client.nome}
                </h2>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span
                    className={classNames(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/80',
                      cfg.textColor
                    )}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`}
                    />
                    {cfg.label} • {cfg.range}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(!editing)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-stone-700 rounded-xl hover:shadow-sm transition-all text-sm font-medium border border-stone-200"
              >
                <Edit3 className="w-4 h-4" />
                {editing ? 'Cancelar' : 'Editar'}
              </button>

              <button
                onClick={handleOpenMessage}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all text-sm font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6">
          {saveMsg && (
            <div
              className={classNames(
                'rounded-xl p-3 flex items-center gap-2 text-sm',
                saveMsg.includes('sucesso')
                  ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                  : 'bg-rose-50 border border-rose-100 text-rose-700'
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              {saveMsg}
            </div>
          )}

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1.5 block">
                    Nome
                  </label>

                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1.5 block">
                    Telefone
                  </label>

                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">
                  Data da última compra
                </label>

                <input
                  type="date"
                  value={editPurchaseDate}
                  onChange={(e) => setEditPurchaseDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">
                  Observações
                </label>

                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-white rounded-xl hover:bg-stone-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>

                <button
                  onClick={() => {
                    setEditing(false);
                    setEditName(client.nome);
                    setEditPhone(client.telefone);
                    setEditPurchaseDate(
                      client.data_ultima_compra
                        ? client.data_ultima_compra.substring(0, 10)
                        : ''
                    );
                    setEditNotes(client.observacao || '');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors text-sm font-medium"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard
                  icon={Phone}
                  label="Telefone"
                  value={formatPhone(client.telefone)}
                />

                <InfoCard
                  icon={Calendar}
                  label="Última compra"
                  value={formatDate(client.data_ultima_compra)}
                />

                <InfoCard
                  icon={Clock}
                  label="Dias desde a compra"
                  value={`${client.days_since_purchase} dias`}
                />

                <InfoCard
                  icon={FileText}
                  label="Quantidade de compras"
                  value={`${client.quantidade_compras}`}
                />
              </div>

              {client.observacao && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <StickyNote className="w-4 h-4 text-stone-400" />
                    <h3 className="text-sm font-semibold text-stone-700">
                      Observações
                    </h3>
                  </div>

                  <div className="bg-stone-50 rounded-xl p-4 text-sm text-stone-600 whitespace-pre-wrap">
                    {client.observacao}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-stone-400" />
                    <h3 className="text-sm font-semibold text-stone-700">
                      Histórico de Mensagens
                    </h3>
                  </div>

                  {history !== null && history.length > 0 && (
                    <span className="text-xs text-stone-400">
                      {history.length} mensagem(s)
                    </span>
                  )}
                </div>

                {history === null ? (
                  <button
                    onClick={loadHistory}
                    className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                  >
                    Carregar histórico
                  </button>
                ) : history.length === 0 ? (
                  <div className="bg-stone-50 rounded-xl p-6 text-center">
                    <AlertCircle className="w-6 h-6 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm text-stone-400">
                      Nenhuma mensagem enviada ainda.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((msg) => {
                      const sender =
                        msg.whatsapp_id === 'whatsapp1'
                          ? settings?.whatsapp1_label || 'Viviane'
                          : settings?.whatsapp2_label || 'Mickaeli';

                      return (
                        <div
                          key={msg.id}
                          className="bg-stone-50 rounded-xl p-4"
                        >
                          <div className="flex items-center justify-between mb-2 gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-stone-600">
                                {sender}
                              </span>

                              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-500">
                                {PERIOD_LABELS[msg.periodo] || msg.periodo}
                              </span>
                            </div>

                            <span className="text-xs text-stone-400">
                              {formatDateTime(msg.data_envio)}
                            </span>
                          </div>

                          <p className="text-sm text-stone-600 whitespace-pre-wrap">
                            {msg.mensagem}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MESSAGE MODAL */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                </div>

                <div>
                  <h3 className="font-semibold text-stone-800">
                    Enviar WhatsApp
                  </h3>

                  <p className="text-xs text-stone-400">
                    {client.nome} • {formatPhone(client.telefone)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowMessageModal(false)}
                className="p-2 text-stone-400 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-stone-700 mb-2 block">
                  Conta do WhatsApp
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setWhatsappAccount('whatsapp1')}
                    className={classNames(
                      'p-3 rounded-xl border-2 text-left transition-all',
                      whatsappAccount === 'whatsapp1'
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-stone-200 hover:border-stone-300'
                    )}
                  >
                    <p className="text-sm font-medium text-stone-800">
                      {settings?.whatsapp1_label || 'Viviane'}
                    </p>

                    <p className="text-xs text-stone-400 mt-0.5">
                      {settings?.whatsapp1_phone || '—'}
                    </p>
                  </button>

                  <button
                    onClick={() => setWhatsappAccount('whatsapp2')}
                    className={classNames(
                      'p-3 rounded-xl border-2 text-left transition-all',
                      whatsappAccount === 'whatsapp2'
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-stone-200 hover:border-stone-300'
                    )}
                  >
                    <p className="text-sm font-medium text-stone-800">
                      {settings?.whatsapp2_label || 'Mickaeli'}
                    </p>

                    <p className="text-xs text-stone-400 mt-0.5">
                      {settings?.whatsapp2_phone || '—'}
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 gap-3">
                  <label className="text-sm font-medium text-stone-700">
                    Mensagem
                  </label>

                  <div className="flex gap-1 flex-wrap justify-end">
                    {templates
                      .filter(
                        (t) =>
                          t.period_bucket === client.period_bucket
                      )
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() =>
                            setMessageText(
                              fillTemplate(t.content, client.nome)
                            )
                          }
                          className="text-xs px-2 py-1 bg-stone-100 text-stone-600 rounded-md hover:bg-stone-200 transition-colors flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          {t.name}
                        </button>
                      ))}
                  </div>
                </div>

                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  Ao clicar em abrir WhatsApp, a conversa será aberta com a
                  mensagem pronta. O contato será registrado no sistema.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-stone-100 bg-stone-50/50">
              <button
                onClick={() => setShowMessageModal(false)}
                className="flex-1 px-4 py-2.5 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>

              <button
                onClick={handleSendWhatsApp}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-stone-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-stone-400" />
        <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
          {label}
        </span>
      </div>

      <p className="text-sm font-medium text-stone-800">{value}</p>
    </div>
  );
}
```

**Importante:** esse arquivo agora está alinhado com as tabelas que já definimos:

* `clientes`
* `mensagens_enviadas`
* `whatsapp_envios_diarios`

E mantém:

* limite de **30 por WhatsApp/dia**;
* bloqueio de duplicidade por **cliente + período**, independentemente de quem enviou;
* Viviane = `whatsapp1`;
* Mickaeli = `whatsapp2`;
* histórico real das mensagens;
* edição de nome, telefone, data e observação.


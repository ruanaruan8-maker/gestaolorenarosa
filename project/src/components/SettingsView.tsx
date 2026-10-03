import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon, MessageCircle, Save, Plus, Trash2, FileText,
  Check, X, Edit3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AppSettings, MessageTemplate, PeriodBucket } from '@/lib/types';
import { PERIOD_CONFIG, classNames } from '@/lib/utils';

interface SettingsViewProps {
  onSettingsChanged: () => void;
}

export function SettingsView({ onSettingsChanged }: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Settings form state
  const [storeName, setStoreName] = useState('');
  const [wa1Label, setWa1Label] = useState('');
  const [wa1Phone, setWa1Phone] = useState('');
  const [wa2Label, setWa2Label] = useState('');
  const [wa2Phone, setWa2Phone] = useState('');

  // Template editing
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateBucket, setTemplateBucket] = useState<PeriodBucket>('green');
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [setRes, tplRes] = await Promise.all([
      supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('message_templates').select('*').order('period_bucket', { ascending: true }),
    ]);
    const s = setRes.data as AppSettings | null;
    setSettings(s);
    if (s) {
      setStoreName(s.store_name);
      setWa1Label(s.whatsapp1_label);
      setWa1Phone(s.whatsapp1_phone || '');
      setWa2Label(s.whatsapp2_label);
      setWa2Phone(s.whatsapp2_phone || '');
    }
    setTemplates(tplRes.data as MessageTemplate[] || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await supabase
      .from('app_settings')
      .update({
        store_name: storeName,
        whatsapp1_label: wa1Label,
        whatsapp1_phone: wa1Phone,
        whatsapp2_label: wa2Label,
        whatsapp2_phone: wa2Phone,
      })
      .eq('id', 1);
    setSavingSettings(false);
    setSettingsSaved(true);
    onSettingsChanged();
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleSaveTemplate = async (id: string) => {
    await supabase
      .from('message_templates')
      .update({ name: templateName, content: templateContent, period_bucket: templateBucket })
      .eq('id', id);
    setEditingTemplate(null);
    loadData();
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim() || !templateContent.trim()) return;
    await supabase.from('message_templates').insert({
      name: templateName,
      content: templateContent,
      period_bucket: templateBucket,
    });
    setShowNewTemplate(false);
    setTemplateName('');
    setTemplateContent('');
    loadData();
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from('message_templates').delete().eq('id', id);
    loadData();
  };

  const startEdit = (t: MessageTemplate) => {
    setEditingTemplate(t.id);
    setTemplateName(t.name);
    setTemplateContent(t.content);
    setTemplateBucket(t.period_bucket);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-stone-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Configurações</h2>
        <p className="text-stone-400 text-sm mt-1">Ajuste as contas de WhatsApp e os modelos de mensagem</p>
      </div>

      {/* Store settings */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <SettingsIcon className="w-5 h-5 text-stone-700" />
          <h3 className="font-semibold text-stone-800">Dados da Loja</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-700 mb-1.5 block">Nome da loja</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all"
            />
          </div>
        </div>
      </div>

      {/* WhatsApp accounts */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-stone-800">Contas de WhatsApp</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-stone-700">Conta 1</span>
            </div>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Nome</label>
              <input
                type="text"
                value={wa1Label}
                onChange={(e) => setWa1Label(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Telefone</label>
              <input
                type="text"
                value={wa1Phone}
                onChange={(e) => setWa1Phone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-all"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm font-medium text-stone-700">Conta 2</span>
            </div>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Nome</label>
              <input
                type="text"
                value={wa2Label}
                onChange={(e) => setWa2Label(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Telefone</label>
              <input
                type="text"
                value={wa2Phone}
                onChange={(e) => setWa2Phone(e.target.value)}
                placeholder="(11) 88888-8888"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-white rounded-xl hover:bg-stone-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {savingSettings ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando...</>
            ) : (
              <><Save className="w-4 h-4" /> Salvar configurações</>
            )}
          </button>
          {settingsSaved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Salvo!
            </span>
          )}
        </div>
      </div>

      {/* Message templates */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-stone-700" />
            <h3 className="font-semibold text-stone-800">Modelos de Mensagem</h3>
          </div>
          <button
            onClick={() => {
              setShowNewTemplate(true);
              setTemplateName('');
              setTemplateContent('');
              setTemplateBucket('green');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo modelo
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700">
            Use <code className="bg-amber-100 px-1 py-0.5 rounded">{'{nome}'}</code> no texto da mensagem para incluir automaticamente o primeiro nome da cliente.
          </p>
        </div>

        {showNewTemplate && (
          <div className="border-2 border-rose-200 rounded-xl p-4 mb-4 space-y-3 bg-rose-50/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Nome do modelo</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex: Pós-venda especial"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
              <div>
                <label className="text-xs text-stone-400 mb-1 block">Período</label>
                <select
                  value={templateBucket}
                  onChange={(e) => setTemplateBucket(e.target.value as PeriodBucket)}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white"
                >
                  {(['green', 'yellow', 'orange', 'red'] as PeriodBucket[]).map((b) => (
                    <option key={b} value={b}>{PERIOD_CONFIG[b].label} ({PERIOD_CONFIG[b].range})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Mensagem</label>
              <textarea
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                rows={3}
                placeholder="Oi {nome}! Tudo bem? ..."
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors"
              >
                Criar modelo
              </button>
              <button
                onClick={() => setShowNewTemplate(false)}
                className="px-4 py-2 bg-stone-100 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {templates.map((tpl) => {
            const cfg = PERIOD_CONFIG[tpl.period_bucket];
            const isEditing = editingTemplate === tpl.id;
            return (
              <div key={tpl.id} className={classNames(
                'rounded-xl border p-4 transition-all',
                isEditing ? 'border-rose-200 bg-rose-50/30' : 'border-stone-200'
              )}>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                      <select
                        value={templateBucket}
                        onChange={(e) => setTemplateBucket(e.target.value as PeriodBucket)}
                        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white"
                      >
                        {(['green', 'yellow', 'orange', 'red'] as PeriodBucket[]).map((b) => (
                          <option key={b} value={b}>{PERIOD_CONFIG[b].label}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={templateContent}
                      onChange={(e) => setTemplateContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveTemplate(tpl.id)}
                        className="px-3 py-1.5 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingTemplate(null)}
                        className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-stone-800 text-sm">{tpl.name}</span>
                        <span className={classNames('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bgColor, cfg.textColor)}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEdit(tpl)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-stone-500 whitespace-pre-wrap line-clamp-2">{tpl.content}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Monitor,
  Trash2,
  Plus,
  ChevronLeft,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';

interface Device {
  id: string;
  nome: string;
  token: string;
  ativo: boolean;
  criado_em: string;
  ultimo_acesso_em: string | null;
}

interface DeviceManagementProps {
  onBack: () => void;
}

export function DeviceManagement({
  onBack,
}: DeviceManagementProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [nome, setNome] = useState('');
  const [token, setToken] = useState('');

  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('dispositivos_gestao')
      .select('*')
      .order('criado_em', { ascending: false });

    console.log('RESULTADO dispositivos_gestao:', {
      data,
      error,
    });

    if (error) {
      console.error('ERRO REAL AO CARREGAR:', error);

      setMessage(
        'Erro ao carregar: ' +
          error.message +
          (error.details ? ' | ' + error.details : '') +
          (error.hint ? ' | ' + error.hint : '')
      );

      setDevices([]);
    } else {
      setDevices((data || []) as Device[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const toggleDevice = async (device: Device) => {
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('dispositivos_gestao')
      .update({
        ativo: !device.ativo,
      })
      .eq('id', device.id);

    if (error) {
      console.error('ERRO AO ALTERAR DISPOSITIVO:', error);
      setMessage(
        'Não foi possível alterar o dispositivo: ' +
          error.message
      );
    } else {
      await loadDevices();
    }

    setSaving(false);
  };

  const deleteDevice = async (device: Device) => {
    const confirmed = window.confirm(
      `Excluir o dispositivo "${device.nome}"?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage('');

    console.log('TENTANDO EXCLUIR DISPOSITIVO:', {
      id: device.id,
      nome: device.nome,
    });

    const { data, error } = await supabase
      .from('dispositivos_gestao')
      .delete()
      .eq('id', device.id)
      .select();

    console.log('RESULTADO DA EXCLUSÃO:', {
      data,
      error,
    });

    if (error) {
      console.error('ERRO AO EXCLUIR:', error);

      setMessage(
        'Não foi possível excluir: ' +
          error.message +
          (error.details ? ' | ' + error.details : '') +
          (error.hint ? ' | ' + error.hint : '')
      );

      setSaving(false);
      return;
    }

    if (!data || data.length === 0) {
      console.error(
        'NENHUM DISPOSITIVO FOI EXCLUÍDO. Verifique as políticas RLS da tabela dispositivos_gestao.'
      );

      setMessage(
        'O dispositivo não foi excluído. O banco não permitiu a exclusão.'
      );

      setSaving(false);
      return;
    }

    setDevices((current) =>
      current.filter((item) => item.id !== device.id)
    );

    setMessage(
      `Dispositivo "${device.nome}" excluído com sucesso.`
    );

    setSaving(false);
  };

  const addDevice = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!nome.trim()) {
      setMessage('Informe o nome do dispositivo.');
      return;
    }

    if (!token.trim()) {
      setMessage('Informe o token do dispositivo.');
      return;
    }

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('dispositivos_gestao')
      .insert({
        nome: nome.trim(),
        token: token.trim(),
        ativo: true,
      });

    if (error) {
      console.error('ERRO AO CADASTRAR:', error);

      setMessage(
        'Não foi possível cadastrar: ' +
          error.message
      );

      setSaving(false);
      return;
    }

    setNome('');
    setToken('');
    setShowAdd(false);

    await loadDevices();

    setSaving(false);
    setMessage('Dispositivo cadastrado e liberado.');
  };

  const generateToken = () => {
    setToken(crypto.randomUUID());
  };

  const copyToken = async (deviceToken: string) => {
    await navigator.clipboard.writeText(deviceToken);

    setCopied(deviceToken);

    setTimeout(() => {
      setCopied(null);
    }, 2000);
  };

  const activeCount = devices.filter(
    (device) => device.ativo
  ).length;

  const inactiveCount =
    devices.length - activeCount;

  return (
    <div className="min-h-screen bg-stone-50">

      <header className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 rounded-xl hover:bg-stone-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-stone-600" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-rose-500" />

                  <h1 className="text-lg font-bold text-stone-800">
                    Painel de Liberação
                  </h1>
                </div>

                <p className="text-xs text-stone-500 mt-0.5">
                  Gestão de dispositivos autorizados
                </p>
              </div>
            </div>

            <button
              onClick={loadDevices}
              disabled={loading}
              className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 text-stone-600 ${
                  loading ? 'animate-spin' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">

          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-stone-600" />
              </div>

              <div>
                <p className="text-xs text-stone-500">
                  Dispositivos
                </p>

                <p className="text-xl font-bold text-stone-800">
                  {devices.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>

              <div>
                <p className="text-xs text-stone-500">
                  Liberados
                </p>

                <p className="text-xl font-bold text-emerald-600">
                  {activeCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                <ShieldOff className="w-5 h-5 text-stone-500" />
              </div>

              <div>
                <p className="text-xs text-stone-500">
                  Bloqueados
                </p>

                <p className="text-xl font-bold text-stone-700">
                  {inactiveCount}
                </p>
              </div>
            </div>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">

          <div>
            <h2 className="text-base font-bold text-stone-800">
              Dispositivos
            </h2>

            <p className="text-sm text-stone-500">
              Libere ou bloqueie o acesso ao sistema.
            </p>
          </div>

          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar dispositivo
          </button>

        </div>

        {showAdd && (
          <form
            onSubmit={addDevice}
            className="bg-white border border-stone-200 rounded-2xl p-5 mb-5"
          >
            <h3 className="font-semibold text-stone-800">
              Novo dispositivo
            </h3>

            <p className="text-sm text-stone-500 mt-1 mb-4">
              Cadastre o nome e o token do dispositivo.
            </p>

            <div className="grid md:grid-cols-2 gap-4">

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Nome
                </label>

                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Mickaeli"
                  className="w-full px-3.5 py-3 rounded-xl border border-stone-200 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Token
                </label>

                <div className="flex gap-2">

                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="UUID do dispositivo"
                    className="flex-1 min-w-0 px-3.5 py-3 rounded-xl border border-stone-200 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 font-mono text-xs"
                  />

                  <button
                    type="button"
                    onClick={generateToken}
                    className="px-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-medium"
                  >
                    Gerar
                  </button>

                </div>
              </div>

            </div>

            <div className="flex gap-2 mt-4">

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Cadastrar e liberar'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setNome('');
                  setToken('');
                }}
                className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50"
              >
                Cancelar
              </button>

            </div>
          </form>
        )}

        {message && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-stone-100 border border-stone-200 text-sm text-stone-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <div className="w-8 h-8 mx-auto border-4 border-stone-200 border-t-rose-500 rounded-full animate-spin" />

            <p className="text-sm text-stone-500 mt-4">
              Carregando dispositivos...
            </p>
          </div>
        ) : devices.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">

            <Smartphone className="w-10 h-10 mx-auto text-stone-300" />

            <h3 className="mt-4 font-semibold text-stone-700">
              Nenhum dispositivo
            </h3>

            <p className="text-sm text-stone-500 mt-1">
              Cadastre o primeiro dispositivo para começar.
            </p>

          </div>
        ) : (
          <div className="space-y-3">

            {devices.map((device) => (

              <div
                key={device.id}
                className="bg-white border border-stone-200 rounded-2xl p-4 md:p-5"
              >

                <div className="flex flex-col md:flex-row md:items-center gap-4">

                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      device.ativo
                        ? 'bg-emerald-50'
                        : 'bg-stone-100'
                    }`}
                  >
                    {device.nome
                      .toLowerCase()
                      .includes('pc') ? (
                      <Monitor
                        className={`w-6 h-6 ${
                          device.ativo
                            ? 'text-emerald-600'
                            : 'text-stone-400'
                        }`}
                      />
                    ) : (
                      <Smartphone
                        className={`w-6 h-6 ${
                          device.ativo
                            ? 'text-emerald-600'
                            : 'text-stone-400'
                        }`}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="font-bold text-stone-800">
                        {device.nome}
                      </h3>

                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                          device.ativo
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {device.ativo
                          ? 'LIBERADO'
                          : 'BLOQUEADO'}
                      </span>

                    </div>

                    <div className="mt-2">

                      <p className="text-[11px] text-stone-400 uppercase tracking-wide">
                        Token
                      </p>

                      <div className="flex items-center gap-2 mt-0.5">

                        <p className="text-xs text-stone-500 font-mono truncate">
                          {device.token}
                        </p>

                        <button
                          onClick={() =>
                            copyToken(device.token)
                          }
                          className="shrink-0 p-1.5 rounded-lg hover:bg-stone-100"
                          title="Copiar token"
                        >
                          {copied === device.token ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-stone-400" />
                          )}
                        </button>

                      </div>

                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">

                      <span>
                        Criado:{' '}
                        {formatDateTime(device.criado_em)}
                      </span>

                      {device.ultimo_acesso_em && (
                        <span>
                          Último acesso:{' '}
                          {formatDateTime(
                            device.ultimo_acesso_em
                          )}
                        </span>
                      )}

                    </div>

                  </div>

                  <div className="flex items-center gap-2 md:shrink-0">

                    <button
                      onClick={() =>
                        toggleDevice(device)
                      }
                      disabled={saving}
                      className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        device.ativo
                          ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          : 'bg-emerald-500 text-white hover:bg-emerald-600'
                      }`}
                    >
                      {device.ativo
                        ? 'Bloquear'
                        : 'Liberar'}
                    </button>

                    <button
                      onClick={() =>
                        deleteDevice(device)
                      }
                      disabled={saving}
                      className="p-2.5 rounded-xl border border-stone-200 text-stone-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  </div>

                </div>

              </div>

            ))}

          </div>
        )}

      </main>
    </div>
  );
}

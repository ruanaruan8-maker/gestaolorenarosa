
import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

import { verificarDispositivo } from '@/lib/device';
import { supabase } from '@/lib/supabase';

interface DeviceGateProps {
  onAuthorized: () => void;
  onAdminAccess: () => void;
}

export function DeviceGate({
  onAuthorized,
  onAdminAccess,
}: DeviceGateProps) {
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [reason, setReason] = useState<string | null>(null);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminError, setAdminError] = useState('');

  const checkDevice = useCallback(async () => {
    setChecking(true);

    try {
      const result = await verificarDispositivo();

      console.log('🔐 Resultado final da verificação:', result);

      setToken(result.token);
      setDeviceName(result.nome);
      setReason(result.motivo);

      if (result.autorizado === true) {
        console.log('✅ Liberando acesso ao sistema');

        setAuthorized(true);
        setLoading(false);
        setChecking(false);

        onAuthorized();

        return;
      }

      setAuthorized(false);
    } catch (error) {
      console.error('Erro ao verificar dispositivo:', error);

      setAuthorized(false);
      setReason('erro_verificacao');
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, [onAuthorized]);

  useEffect(() => {
    checkDevice();
  }, [checkDevice]);

  useEffect(() => {
    if (authorized || showAdminLogin) {
      return;
    }

    const interval = setInterval(() => {
      checkDevice();
    }, 5000);

    return () => clearInterval(interval);
  }, [authorized, showAdminLogin, checkDevice]);

  const handleAdminLogin = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!adminPassword.trim()) {
      setAdminError('Digite a senha de administrador.');
      return;
    }

    setAdminChecking(true);
    setAdminError('');

    try {
      const { data, error } = await supabase.rpc(
        'verificar_senha_admin',
        {
          p_senha: adminPassword,
        }
      );

      if (error) {
        console.error(
          'Erro ao verificar senha administrativa:',
          error
        );

        setAdminError(
          'Não foi possível verificar a senha.'
        );

        return;
      }

      if (data === true) {
        setAdminPassword('');
        setShowPassword(false);
        setAdminError('');
        setShowAdminLogin(false);

        onAdminAccess();
      } else {
        setAdminError('Senha incorreta.');
      }
    } catch (error) {
      console.error(
        'Erro inesperado ao verificar senha:',
        error
      );

      setAdminError(
        'Ocorreu um erro ao verificar a senha.'
      );
    } finally {
      setAdminChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-5 border-4 border-stone-200 border-t-rose-500 rounded-full animate-spin" />

          <h1 className="text-lg font-semibold text-stone-800">
            Verificando dispositivo
          </h1>

          <p className="mt-2 text-sm text-stone-500">
            Aguarde enquanto verificamos o acesso.
          </p>
        </div>
      </div>
    );
  }

  if (authorized) {
    return null;
  }

  const notRegistered =
    reason === 'dispositivo_nao_cadastrado';

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">

          <div className="px-6 pt-8 pb-6 text-center border-b border-stone-100">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center">
              {notRegistered ? (
                <ShieldAlert className="w-8 h-8 text-rose-500" />
              ) : (
                <Smartphone className="w-8 h-8 text-stone-500" />
              )}
            </div>

            <h1 className="mt-5 text-xl font-bold text-stone-800">
              Acesso ao sistema
            </h1>

            <p className="mt-2 text-sm text-stone-500 leading-relaxed">
              Este dispositivo precisa estar liberado no painel de
              administração para acessar a Gestão de Clientes.
            </p>
          </div>

          <div className="p-6">

            {!showAdminLogin ? (
              <>
                <div
                  className={`rounded-2xl p-4 border ${
                    notRegistered
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {notRegistered ? (
                        <ShieldAlert className="w-5 h-5 text-amber-600" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-stone-500" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-stone-800">
                        {notRegistered
                          ? 'Dispositivo não autorizado'
                          : 'Aguardando liberação'}
                      </p>

                      <p className="mt-1 text-sm text-stone-600">
                        {notRegistered
                          ? 'Este dispositivo ainda não foi cadastrado no painel.'
                          : 'A liberação ainda não foi concluída.'}
                      </p>
                    </div>
                  </div>
                </div>

                {deviceName && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                      Dispositivo
                    </p>

                    <p className="mt-1 text-sm font-semibold text-stone-700">
                      {deviceName}
                    </p>
                  </div>
                )}

                <div className="mt-5">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Código do dispositivo
                  </p>

                  <div className="mt-2 bg-stone-100 rounded-xl p-3">
                    <p className="text-xs text-stone-600 break-all font-mono">
                      {token}
                    </p>
                  </div>

                  <p className="mt-2 text-xs text-stone-400 leading-relaxed">
                    Este código identifica este dispositivo no painel de
                    administração.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={checkDevice}
                  disabled={checking}
                  className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-800 disabled:opacity-60 transition-colors"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${
                      checking ? 'animate-spin' : ''
                    }`}
                  />

                  {checking
                    ? 'Verificando...'
                    : 'Verificar novamente'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLogin(true);
                    setAdminError('');
                    setAdminPassword('');
                  }}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium text-sm hover:bg-stone-50 transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  Painel de administração
                </button>
              </>
            ) : (
              <form onSubmit={handleAdminLogin}>

                <div className="text-center mb-6">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-stone-100 flex items-center justify-center">
                    <Lock className="w-7 h-7 text-stone-600" />
                  </div>

                  <h2 className="mt-4 text-lg font-bold text-stone-800">
                    Acesso administrativo
                  </h2>

                  <p className="mt-1 text-sm text-stone-500">
                    Digite a senha para gerenciar os dispositivos.
                  </p>
                </div>

                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Senha
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(event) => {
                      setAdminPassword(event.target.value);
                      setAdminError('');
                    }}
                    autoFocus
                    placeholder="Digite a senha"
                    className="w-full px-3.5 py-3 pr-11 rounded-xl border border-stone-200 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    aria-label={
                      showPassword
                        ? 'Ocultar senha'
                        : 'Mostrar senha'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {adminError && (
                  <div className="mt-3 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                    {adminError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={adminChecking}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-800 disabled:opacity-60 transition-colors"
                >
                  <Lock className="w-4 h-4" />

                  {adminChecking
                    ? 'Verificando...'
                    : 'Entrar no painel'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLogin(false);
                    setAdminPassword('');
                    setAdminError('');
                    setShowPassword(false);
                  }}
                  className="w-full mt-3 px-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium text-sm hover:bg-stone-50 transition-colors"
                >
                  Voltar
                </button>

              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-stone-400 mt-5">
          Gestão de Clientes • Lorena Rosa
        </p>
      </div>
    </div>
  );
}
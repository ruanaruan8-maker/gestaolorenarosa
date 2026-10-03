import { supabase } from './supabase';

const TOKEN_KEY = 'gestao_dispositivo_token';

export interface DeviceVerification {
  autorizado: boolean;
  motivo: string | null;
  token: string;
  nome: string | null;
}

function obterToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }

  return token;
}

export async function verificarDispositivo(): Promise<DeviceVerification> {
  const token = obterToken();

  const { data, error } = await supabase.rpc(
    'verificar_dispositivo_gestao',
    {
      p_token: token,
    }
  );

  if (error) {
    console.error(
      'Erro ao verificar dispositivo:',
      error
    );

    return {
      autorizado: false,
      motivo: 'erro_verificacao',
      token,
      nome: null,
    };
  }

  let nome: string | null = null;

  if (data?.autorizado === true) {
  console.log('✅ DISPOSITIVO AUTORIZADO PELO BANCO:', data);

    const { data: dispositivo } = await supabase
      .from('dispositivos_gestao')
      .select('nome')
      .eq('token', token)
      .eq('ativo', true)
      .maybeSingle();

    nome = dispositivo?.nome ?? null;
  }

  return {
    autorizado: data?.autorizado === true,
    motivo: data?.motivo ?? null,
    token,
    nome,
  };
}

export function limparTokenDispositivo(): void {
  localStorage.removeItem(TOKEN_KEY);
}
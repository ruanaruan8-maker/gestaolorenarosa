
export type PeriodBucket = 'green' | 'yellow' | 'orange' | 'red';

export type ClientFilter =
  | 'all'
  | 'new'
  | '10_30'
  | '31_60'
  | '61_90'
  | '90_plus';

export interface Client {
  id: string;
  nome: string;
  telefone: string;
  data_ultima_compra: string | null;
  quantidade_compras: number;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface SentMessage {
  id: string;
  cliente_id: string;
  periodo: string;
  mensagem: string;
  whatsapp_id: string;
  data_envio: string;
}

export interface ClientWithMeta extends Client {
  days_since_purchase: number;
  period_bucket: PeriodBucket;
}

export interface AppSettings {
  id: number;
  store_name: string;
  whatsapp1_label: string;
  whatsapp1_phone: string | null;
  whatsapp2_label: string;
  whatsapp2_phone: string | null;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  period_bucket: PeriodBucket;
}

/*
# Lorena Rosa - Gestão de Clientes Schema

## Overview
Creates the complete database schema for the customer relationship management system.
The app imports sales data from Phibo (external POS), organizes clients by time-since-purchase,
and helps staff send WhatsApp follow-up messages with tracking.

## Tables

### 1. clients
Stores all customer records imported from Phibo or manually created.
- id (uuid, pk)
- name (text, not null) — customer name
- phone (text, not null) — WhatsApp phone number, used for deduplication on import
- purchase_date (date, not null) — date of last purchase from Phibo
- last_message_date (timestamptz) — when a message was last sent to this client
- message_status (text, default 'pending') — 'pending', 'sent', 'responded', 'no_response'
- notes (text) — staff observations about the client
- created_at (timestamptz)
- updated_at (timestamptz)

### 2. sent_messages
Records every message sent through the system via WhatsApp.
- id (uuid, pk)
- client_id (uuid, fk → clients.id ON DELETE CASCADE)
- client_name (text) — denormalized for history queries
- phone (text) — denormalized phone at time of sending
- message_text (text, not null) — the message content that was sent
- whatsapp_account (int, default 1) — which WhatsApp account (1 or 2) was used
- sent_at (timestamptz, default now())

### 3. message_templates
Pre-configured message templates per period bucket, editable by staff.
- id (uuid, pk)
- name (text, not null)
- content (text, not null) — message body, supports {nome} placeholder
- period_bucket (text, not null) — 'green', 'yellow', 'orange', 'red'
- created_at (timestamptz)

### 4. devices
Authorized devices that can access the system.
- id (uuid, pk)
- fingerprint (text, unique) — browser/device fingerprint hash
- device_name (text) — human-friendly label
- status (text, default 'pending') — 'pending', 'authorized', 'blocked'
- created_at (timestamptz)
- last_seen_at (timestamptz)

### 5. app_settings
Single-row key-value store for app-wide configuration.
- id (int, pk, always 1)
- admin_pin (text) — PIN to access admin/device management
- whatsapp1_label (text, default 'WhatsApp 1')
- whatsapp1_phone (text) — phone number for WA account 1
- whatsapp2_label (text, default 'WhatsApp 2')
- whatsapp2_phone (text) — phone number for WA account 2
- store_name (text, default 'Lorena Rosa')
- created_at (timestamptz)
- updated_at (timestamptz)

## Security
- RLS enabled on all tables.
- All tables use TO anon, authenticated with USING (true) / WITH CHECK (true)
  because this is a single-tenant app with no user sign-in. The device authorization
  mechanism at the app level controls access to the interface.
- devices table is also fully accessible to anon so the app can check authorization status
  and register itself; the admin_pin in app_settings gates the management UI.

## Notes
1. Phone numbers are stored as text to preserve formatting (country codes, etc.)
2. The period bucket (green/yellow/orange/red) is computed in the frontend based on
   days since purchase_date, not stored — it stays accurate as time passes.
3. Default message templates are seeded for each period bucket.
4. A default app_settings row is seeded with a default admin PIN.
*/

-- ============================================================
-- clients
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  purchase_date date NOT NULL,
  last_message_date timestamptz,
  message_status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_purchase_date ON clients(purchase_date);
CREATE INDEX IF NOT EXISTS idx_clients_message_status ON clients(message_status);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_clients" ON clients;
CREATE POLICY "anon_select_clients" ON clients FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_clients" ON clients;
CREATE POLICY "anon_insert_clients" ON clients FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_clients" ON clients;
CREATE POLICY "anon_update_clients" ON clients FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_clients" ON clients;
CREATE POLICY "anon_delete_clients" ON clients FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- sent_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS sent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  phone text NOT NULL,
  message_text text NOT NULL,
  whatsapp_account int NOT NULL DEFAULT 1,
  sent_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sent_messages_client_id ON sent_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_sent_at ON sent_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_sent_messages_whatsapp_account ON sent_messages(whatsapp_account);

ALTER TABLE sent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sent_messages" ON sent_messages;
CREATE POLICY "anon_select_sent_messages" ON sent_messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sent_messages" ON sent_messages;
CREATE POLICY "anon_insert_sent_messages" ON sent_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sent_messages" ON sent_messages;
CREATE POLICY "anon_update_sent_messages" ON sent_messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sent_messages" ON sent_messages;
CREATE POLICY "anon_delete_sent_messages" ON sent_messages FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- message_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  period_bucket text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_period_bucket ON message_templates(period_bucket);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_message_templates" ON message_templates;
CREATE POLICY "anon_select_message_templates" ON message_templates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_message_templates" ON message_templates;
CREATE POLICY "anon_insert_message_templates" ON message_templates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_message_templates" ON message_templates;
CREATE POLICY "anon_update_message_templates" ON message_templates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_message_templates" ON message_templates;
CREATE POLICY "anon_delete_message_templates" ON message_templates FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- devices
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text UNIQUE NOT NULL,
  device_name text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_devices" ON devices;
CREATE POLICY "anon_select_devices" ON devices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
CREATE POLICY "anon_insert_devices" ON devices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_devices" ON devices;
CREATE POLICY "anon_update_devices" ON devices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_devices" ON devices;
CREATE POLICY "anon_delete_devices" ON devices FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- app_settings (single-row)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1,
  admin_pin text NOT NULL DEFAULT '1234',
  whatsapp1_label text NOT NULL DEFAULT 'WhatsApp 1',
  whatsapp1_phone text DEFAULT '',
  whatsapp2_label text NOT NULL DEFAULT 'WhatsApp 2',
  whatsapp2_phone text DEFAULT '',
  store_name text NOT NULL DEFAULT 'Lorena Rosa',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Seed default message templates
-- ============================================================
INSERT INTO message_templates (name, content, period_bucket) VALUES
  ('Pós-venda (10 dias)', 'Oi {nome}! Tudo bem? Aqui é da Lorena Rosa. Passando para saber se você gostou da sua compra e se está tudo certinho. Qualquer coisa, estamos à disposição! 💕', 'green'),
  ('Relacionamento (30 dias)', 'Oi {nome}! Tudo bem? Faz um tempinho que você não aparece por aqui. Já temos novidades lindas chegando! Passa aqui na loja ou chama a gente no WhatsApp. Beijos! 💖', 'yellow'),
  ('Reativação (60 dias)', 'Oi {nome}! Senti sua falta! Já faz um tempinho desde sua última visita. Preparamos algo especial para você. Que tal voltar para conferir as novidades? Te espero! 🌹', 'orange'),
  ('Reconquista (90+ dias)', 'Oi {nome}! Faz bastante tempo que não nos vemos, mas não esquecemos de você! Voltamos com peças lindas e um mimo especial para você. Vamos retomar o contato? 💐', 'red')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed default app_settings row
-- ============================================================
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================
-- updated_at trigger for clients
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

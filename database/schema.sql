-- =====================================================
-- NGR Barbearia — Schema MySQL (MVP: Fase 0 + Fase 1)
-- Single-tenant (um banco por barbearia, sem tenant_id).
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('owner','staff') NOT NULL DEFAULT 'staff',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configurações livres usadas para montar o prompt da IA (endereço, formas de
-- pagamento, mensagem de boas-vindas etc.) — editável pelo painel sem redeploy.
CREATE TABLE IF NOT EXISTS business_settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO business_settings (setting_key, setting_value) VALUES
  ('business_name', 'NGR Barbearia'),
  ('address', 'Preencher endereço no painel admin'),
  ('payment_methods', 'Dinheiro, PIX e cartão'),
  ('welcome_message', 'Olá! Seja bem-vindo à NGR Barbearia. Como posso te ajudar?');

CREATE TABLE IF NOT EXISTS barbers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  price_cents  INT NOT NULL,
  duration_min INT NOT NULL DEFAULT 30,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  valid_from  DATE NULL,
  valid_to    DATE NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Horário de funcionamento. barber_id NULL = vale para a barbearia toda.
CREATE TABLE IF NOT EXISTS business_hours (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  day_of_week TINYINT NOT NULL, -- 0=domingo ... 6=sábado
  open_time   TIME NOT NULL,
  close_time  TIME NOT NULL,
  barber_id   INT NULL,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  whatsapp_number VARCHAR(20) NOT NULL UNIQUE, -- formato E.164 sem "+", ex: 5511999999999
  name           VARCHAR(100) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT NOT NULL,
  status          ENUM('browsing','scheduling','scheduled','needs_human','abandoned_followup_sent')
                  NOT NULL DEFAULT 'browsing',
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  direction       ENUM('in','out') NOT NULL,
  content         TEXT NOT NULL,
  ai_generated    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  customer_id      INT NOT NULL,
  service_id       INT NOT NULL,
  barber_id        INT NULL,
  conversation_id  INT NULL,
  scheduled_at     DATETIME NOT NULL,
  status           ENUM('tentative','confirmed','reminded','completed','cancelled','no_show')
                   NOT NULL DEFAULT 'tentative',
  provider         ENUM('internal','appbarber') NOT NULL DEFAULT 'internal',
  external_id      VARCHAR(100) NULL, -- id no App Barber, quando existir
  reminder_sent_at TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (barber_id) REFERENCES barbers(id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status        ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_conversations_status       ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation       ON messages(conversation_id);

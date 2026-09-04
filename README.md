# NGR Barbearia — Sistema de Atendimento

Sistema próprio da NGR Barbearia (independente do Sistema Lotus). Fase 1 do MVP: WhatsApp com
IA + agendamento (agenda interna até o acesso à API do App Barber ser liberado) + lembretes +
recuperação de cliente.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16 + React + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Banco de dados | MySQL |
| IA | OpenAI (function calling) |
| WhatsApp | Meta Cloud API (oficial) |

## Estrutura

```
ngr-barbearia/
├── backend/            # API (Express) — WhatsApp, IA, agendamento, lembretes
│   ├── src/
│   │   ├── services/
│   │   │   ├── whatsapp/      # webhook Meta Cloud API + envio de mensagens
│   │   │   ├── ai/            # orquestração OpenAI (function calling)
│   │   │   ├── appointments/  # AppointmentProvider (interno / App Barber)
│   │   │   └── scheduling/    # cron de lembretes e recuperação de cliente
│   │   └── routes/            # API do painel admin
│   └── scripts/                # simulate-conversation.ts, create-owner.ts
├── frontend/            # Painel admin (Next.js)
└── database/
    └── schema.sql
```

## Rodando localmente

### 1. Banco de dados (MySQL)

```bash
mysql -u root -p -e "CREATE DATABASE ngr_barbearia"
mysql -u root -p ngr_barbearia < database/schema.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# preencher DB_*, JWT_SECRET, OPENAI_API_KEY, WHATSAPP_* no .env
npm run dev
```

Cria o primeiro usuário do painel (não há tela de cadastro):

```bash
npm run create-owner -- "Seu Nome" seu@email.com suaSenha123
```

Testa a IA sem precisar de credenciais reais do WhatsApp:

```bash
npm run simulate -- 5511999999999 "Quanto custa um corte?"
```

### 3. Frontend (painel admin)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Acesse `http://localhost:3000`.

## Provider de agendamento

Todo agendamento passa pela interface `AppointmentProvider`
(`backend/src/services/appointments/types.ts`). Enquanto o acesso à API do App Barber não é
liberado, `APPOINTMENT_PROVIDER=internal` usa uma agenda própria (`business_hours` +
`appointments`). Quando o acesso for concedido, implementar `AppBarberProvider` e trocar para
`APPOINTMENT_PROVIDER=appbarber` — nenhum outro código (IA, lembretes, painel) precisa mudar.

## Configurando o WhatsApp Cloud API

1. Criar app no [Meta for Developers](https://developers.facebook.com/) com o produto WhatsApp.
2. Configurar o webhook apontando para `https://SEU_DOMINIO/webhook`, usando o mesmo valor de
   `WHATSAPP_VERIFY_TOKEN` do `.env`.
3. Cadastrar e aprovar os templates de mensagem proativa (`WHATSAPP_TEMPLATE_REMINDER`,
   `WHATSAPP_TEMPLATE_RECOVERY`) no Meta Business Manager — mensagem livre só funciona dentro da
   janela de 24h de atendimento.

## Testes

```bash
cd backend
npm test
```

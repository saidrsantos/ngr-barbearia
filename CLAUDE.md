# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Orientação para o Claude Code ao trabalhar neste repositório.

## Visão geral

**NGR Barbearia** — sistema próprio de atendimento (WhatsApp + IA + agendamento), separado do
Sistema Lotus (projeto de outra pessoa — não misturar código, banco, ou credenciais dos dois).
Textos de UI em português (pt-BR). Single-tenant: um banco por barbearia, sem `tenant_id`.

MVP Fase 1: WhatsApp com IA respondendo o cliente, consultando disponibilidade e agendando.
O acesso à API do App Barber foi liberado (setembro/2026) e o `AppBarberProvider` já tem
implementação real — ver seção "A abstração mais importante" abaixo para como a troca entre
agenda interna e App Barber funciona.

## Rodando o sistema

```bash
# Terminal 1 — Backend (porta 8001, requer MySQL)
cd backend
npm install
cp .env.example .env   # preencher DB_*, JWT_SECRET, OPENAI_API_KEY, WHATSAPP_*
npm run dev             # node --require ts-node/register/transpile-only src/server.ts

# Terminal 2 — Frontend (porta 3000)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Banco (primeira vez):

```bash
mysql -u root -p -e "CREATE DATABASE ngr_barbearia"
mysql -u root -p ngr_barbearia < database/schema.sql
```

`backend/src/server.ts` carrega `.env` via dotenv e recusa iniciar sem `JWT_SECRET`. Usa
`ts-node/register/transpile-only` — sem build step no dev (`npm run build` só é necessário pra
deploy: compila com `tsc` pra `dist/`, rodado depois com `npm start`).

Sem tela de cadastro no painel — o primeiro usuário nasce via script:

```bash
cd backend && npm run create-owner -- "Seu Nome" seu@email.com suaSenha123
```

Testar a IA sem credenciais reais do WhatsApp:

```bash
cd backend && npm run simulate -- 5511999999999 "Quanto custa um corte?"
```

### Testes

```bash
cd backend && npm test
```

Node `node:test` nativo, sem framework externo (mesmo padrão do Sistema Lotus) — roda todo
`src/**/*.test.ts`. Hoje só existe `services/appointments/availabilityMath.test.ts` (lógica pura
de cálculo de slots). Nada que dependa de MySQL/OpenAI/WhatsApp/App Barber real está coberto por
teste automatizado ainda. Não há suíte de testes no frontend.

### Lint (frontend)

```bash
cd frontend && npm run lint    # next lint, config em .eslintrc.json (extends next/core-web-vitals)
```

Sem lint configurado no backend.

## Arquitetura

```
backend/src/
├── server.ts                # monta tudo, garante o owner via env, inicia o cron scheduler
├── bootstrap/ensureOwner.ts # cria/atualiza o owner a partir de BOOTSTRAP_OWNER_* no boot
├── db/pool.ts                # pool MySQL (mysql2/promise)
├── middleware/auth.ts        # JWT — auth() e requireRoles('owner'|'staff')
├── services/
│   ├── appointments/
│   │   ├── types.ts             # interface AppointmentProvider (o contrato central)
│   │   ├── availabilityMath.ts  # lógica pura de cálculo de slots (testada)
│   │   ├── InternalCalendarProvider.ts  # implementação própria (busca DB + chama availabilityMath)
│   │   ├── AppBarberProvider.ts         # implementação real contra a API do App Barber
│   │   ├── appbarberConfig.ts           # lê APPBARBER_API_KEY/APPBARBER_ESTABLISHMENT_CODE/base URL
│   │   ├── index.ts             # getAppointmentProvider() lê APPOINTMENT_PROVIDER do .env
│   │   └── router.ts            # CRUD admin: services, promotions, barbers, business-hours, appointments
│   ├── ai/
│   │   ├── config.ts        # único lugar que lê OPENAI_API_KEY/OPENAI_MODEL
│   │   ├── systemPrompt.ts  # monta o prompt a partir do banco (serviços/promoções/horários/settings)
│   │   ├── tools.ts         # function-calling tools — sempre chamam getAppointmentProvider(), nunca inventam dado
│   │   └── orchestrator.ts  # generateReply(): histórico + loop de tool-calling (máx 5 rounds)
│   ├── whatsapp/
│   │   ├── config.ts        # único lugar que lê variáveis do WhatsApp Cloud API
│   │   ├── client.ts        # sendTextMessage / sendTemplateMessage via Graph API
│   │   ├── conversation.ts  # getOrCreateCustomer / getOrCreateOpenConversation / appendMessage
│   │   └── webhookRouter.ts # GET (verificação) + POST (recebe mensagem, valida assinatura, chama a IA)
│   ├── scheduling/
│   │   ├── reminders.ts     # lembrete 24h antes (idempotente via reminder_sent_at)
│   │   ├── recovery.ts      # follow-up único pra quem não agendou (idempotente via status da conversa)
│   │   └── scheduler.ts     # node-cron, roda os dois jobs a cada 15 min
│   ├── debts/router.ts      # adiantamentos que o dono faz pro barbeiro, pagos em parcelas mensais
│   └── payables/router.ts   # contas a pagar da barbearia (aluguel, fornecedor...) — sem parcelamento
└── routes/
    ├── auth.ts              # login/me
    └── conversations.ts     # lista, mensagens, resposta manual, devolver pra IA
```

Segue o padrão de **router-factory** (mesmo usado no Sistema Lotus):
`createXRouter({ pool, auth, requireRoles })`, montado em `server.ts` com `app.use(...)`. Novo
módulo de rota = nova pasta em `services/<nome>/router.ts` seguindo esse contrato.

`barber_debts` (dívida do barbeiro com a barbearia) e `payables` (conta da barbearia com
terceiros) são conceitos distintos — não confundir os dois routers.

`server.ts` responde `200` em `GET /` (health check simples, sem `/api/v1`) antes mesmo do
`ensureOwnerFromEnv()` terminar — algumas hospedagens (ex.: Hostinger) reiniciam o processo se a
raiz não responder rápido no boot. Não remover essa rota nem inverter a ordem
`ensureOwnerFromEnv().finally(() => app.listen(...))` sem entender esse motivo.

## A abstração mais importante: `AppointmentProvider`

Nenhum código de IA, lembrete ou painel deve chamar o App Barber (ou a agenda interna)
diretamente — tudo passa por `getAppointmentProvider()` (`services/appointments/index.ts`), que
escolhe a implementação via `APPOINTMENT_PROVIDER` (`internal` | `appbarber`). Essa abstração
existia porque o acesso à API do App Barber demorou a ser liberado; agora que
`AppBarberProvider.ts` tem implementação real, ela continua sendo o único lugar que fala com a
API externa — não adicionar chamadas diretas ao App Barber em nenhum outro arquivo.

Pontos importantes do `AppBarberProvider`:
- Mapeamento via `services.appbarber_code` / `barbers.appbarber_code` (preenchidos no painel) —
  serviço ou barbeiro sem esse código fica de fora da agenda quando `appbarber` está ativo.
- A API de parceiros do App Barber **não tem endpoint de cancelamento de agendamento** (só de
  "comanda", que é outra coisa) — `cancelAppointment()` só atualiza o status local; a equipe
  precisa cancelar manualmente dentro do App Barber também.
- `InternalCalendarProvider` continua existindo e funcional — é o fallback caso
  `APPOINTMENT_PROVIDER=internal`, usando `business_hours` + `appointments` do próprio banco.

## IA (`services/ai/`)

Regra de ouro, reforçada no próprio system prompt: a IA nunca inventa preço, promoção, horário
ou disponibilidade — sempre chama uma tool (`listar_servicos_precos`,
`buscar_horarios_disponiveis`, `criar_agendamento`, `confirmar_agendamento`,
`encaminhar_para_humano`), todas implementadas em `tools.ts` contra o `AppointmentProvider`
ou o banco. `encaminhar_para_humano` marca `conversations.status = 'needs_human'` — a partir daí
o `webhookRouter` para de chamar a IA pra essa conversa até alguém clicar "Devolver para a IA"
no painel (`PATCH /conversations/:id/resume-ai`).

## WhatsApp (`services/whatsapp/`)

Meta Cloud API oficial. Mensagem livre (texto solto) só é aceita dentro da janela de 24h de
atendimento — lembrete e recuperação de cliente (mensagens proativas) **precisam** de Message
Templates pré-aprovados no Meta Business Manager (`WHATSAPP_TEMPLATE_REMINDER`,
`WHATSAPP_TEMPLATE_RECOVERY` no `.env`). `webhookRouter.ts` valida `X-Hub-Signature-256` contra
`req.rawBody` (capturado no `express.json({ verify })` em `server.ts` — não trocar o parser sem
manter isso).

## Deploy / bootstrap sem SSH

`bootstrap/ensureOwner.ts` cria (ou faz upsert de senha em) o usuário owner a partir de
`BOOTSTRAP_OWNER_NAME`/`BOOTSTRAP_OWNER_EMAIL`/`BOOTSTRAP_OWNER_PASSWORD`, rodando a cada boot do
servidor — existe porque hospedagens compartilhadas (ex.: Hostinger) não dão acesso a
terminal/SSH pra rodar `npm run create-owner` manualmente. É seguro deixar essas variáveis
setadas em produção (é um upsert idempotente por e-mail).

## Scripts (`backend/scripts/`)

- `create-owner.ts` (`npm run create-owner -- "Nome" email senha`) — caminho manual (dev local /
  hospedagem com SSH) pra criar o primeiro usuário do painel.
- `simulate-conversation.ts` (`npm run simulate -- <telefone> "<mensagem>"`) — roda o mesmo
  caminho do webhook sem precisar de credenciais reais do WhatsApp.

## Frontend (`frontend/`)

Next.js 14 (App Router, Pages Router não usado) + React 18 + TypeScript + Tailwind CSS.
**Já foi Next 16/React 19 e voltou para Next 14** (ver commit "Corrige deploy em producao:
bootstrap de owner + downgrade Next 16 para 14") — `params`/`searchParams` são objetos simples
(não `Promise`), sem precisar de `use()` do React pra desembrulhar. Sem Radix/react-hook-form/
zod — forms simples com `useState` mesmo, pra não inflar dependência num painel pequeno.

Lint via `.eslintrc.json` (`next/core-web-vitals`), sem overrides customizados.

Tema claro/escuro via `next-themes` (`components/layout/ThemeToggle.tsx`).

Rotas: `(auth)/login` (pública) e `(dashboard)/*` (protegidas por `context/AuthContext.tsx` —
redireciona pra `/login` se não houver usuário): `agendamentos`, `conversas/[id]`, `servicos`,
`promocoes`, `horarios`, `dividas` (barber_debts), `contas-a-pagar` (payables).

`frontend/AGENTS.md` é gerado automaticamente pelo `next dev` (bloco `nextjs-agent-rules`) — não
é orientação do projeto, é o próprio Next.js avisando sobre mudanças de API entre versões; é
recriado a cada `next dev` mesmo se removido do diff.

## O que falta pro MVP completo (não implementado ainda)

- **Prioridade 2 — Tráfego pago**: leitura da Meta Marketing API + atribuição de conversa/
  agendamento a anúncio via `ctwa_clid`.
- **Prioridade 3 — Conciliação financeira**: fechamento diário automático — falta saber qual
  adquirente/maquininha a barbearia usa antes de desenhar a integração.
- Prioridades 4-6 (conteúdo, estoque, comissão) e dashboard financeiro final.

Ver o plano salvo em `.claude/plans/` (sessão que criou este projeto) para o raciocínio completo
por trás dessas decisões.

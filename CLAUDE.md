# CLAUDE.md

Orientação para o Claude Code ao trabalhar neste repositório.

## Visão geral

**NGR Barbearia** — sistema próprio de atendimento (WhatsApp + IA + agendamento), separado do
Sistema Lotus (projeto de outra pessoa — não misturar código, banco, ou credenciais dos dois).
Textos de UI em português (pt-BR). Single-tenant: um banco por barbearia, sem `tenant_id`.

Este é o MVP Fase 1 (ver `visão final` no fim deste arquivo para o que vem depois): WhatsApp
com IA respondendo o cliente, consultando disponibilidade e agendando — hoje numa agenda
interna, migrando para o App Barber assim que o acesso à API for concedido.

## Rodando o sistema

```bash
# Terminal 1 — Backend (porta 8001, requer MySQL)
cd backend
node --require ts-node/register/transpile-only src/server.ts   # ou: npm run dev

# Terminal 2 — Frontend (porta 3000)
cd frontend
npm run dev
```

`backend/src/server.ts` carrega `.env` via dotenv e recusa iniciar sem `JWT_SECRET`. Usa
`ts-node/register/transpile-only` — sem build step no dev.

Testes: `cd backend && npm test` (Node `node:test`, sem framework externo — mesmo padrão do
Sistema Lotus). Só cobrem lógica pura (`availabilityMath.ts`) — nada que dependa de MySQL/OpenAI
real está coberto por teste automatizado ainda.

## Arquitetura

```
backend/src/
├── server.ts              # monta tudo, inicia o cron scheduler
├── db/pool.ts              # pool MySQL (mysql2/promise)
├── middleware/auth.ts       # JWT — auth() e requireRoles('owner'|'staff')
├── services/
│   ├── appointments/
│   │   ├── types.ts             # interface AppointmentProvider (o contrato central)
│   │   ├── availabilityMath.ts  # lógica pura de cálculo de slots (testada)
│   │   ├── InternalCalendarProvider.ts  # implementação ativa hoje (busca DB + chama availabilityMath)
│   │   ├── AppBarberProvider.ts         # esqueleto — implementar quando a API chegar
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
│   └── scheduling/
│       ├── reminders.ts     # lembrete 24h antes (idempotente via reminder_sent_at)
│       ├── recovery.ts      # follow-up único pra quem não agendou (idempotente via status da conversa)
│       └── scheduler.ts     # node-cron, roda os dois jobs a cada 15 min
└── routes/
    ├── auth.ts              # login/me
    └── conversations.ts     # lista, mensagens, resposta manual, devolver pra IA
```

Segue o padrão de **router-factory** (mesmo usado no Sistema Lotus):
`createXRouter({ pool, auth, requireRoles })`, montado em `server.ts` com `app.use(...)`. Novo
módulo de rota = nova pasta em `services/<nome>/router.ts` seguindo esse contrato.

## A abstração mais importante: `AppointmentProvider`

Nenhum código de IA, lembrete ou painel deve chamar o App Barber (ou a agenda interna)
diretamente — tudo passa por `getAppointmentProvider()` (`services/appointments/index.ts`), que
escolhe a implementação via `APPOINTMENT_PROVIDER` (`internal` | `appbarber`). Isso existe
porque o acesso à API do App Barber ainda não foi liberado (usuário solicitou por e-mail) — o
MVP não podia ficar bloqueado esperando. Quando a API chegar, implementar
`AppBarberProvider.ts` (mesma assinatura, já com os métodos esqueleto) e trocar a env var —
nada mais deve precisar mudar. Não adicionar chamadas diretas ao App Barber em nenhum outro
arquivo.

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

## Scripts (`backend/scripts/`)

- `create-owner.ts` (`npm run create-owner -- "Nome" email senha`) — não há tela de cadastro no
  painel; o primeiro usuário sempre nasce por aqui.
- `simulate-conversation.ts` (`npm run simulate -- <telefone> "<mensagem>"`) — roda o mesmo
  caminho do webhook sem precisar de credenciais reais do WhatsApp. Útil enquanto a conta Meta
  Business e o App Barber não estão liberados.

## Frontend (`frontend/`)

Next.js 16 (App Router, Turbopack, React 19.2) — **diferente do Next 14 do Sistema Lotus**,
`params`/`searchParams` são `Promise` mesmo em client components (usar `use()` do React pra
desembrulhar, ver `app/(dashboard)/conversas/[id]/page.tsx`). Sem Radix/react-hook-form/zod —
forms simples com `useState` mesmo, pra não inflar dependência num painel pequeno.

`react-hooks/set-state-in-effect` está rebaixada pra `warn` no `eslint.config.mjs`: o padrão
"setLoading(true) + fetch no useEffect" é o normal aqui (painel 100% client-rendered, sem React
Compiler), não um bug.

Rotas: `(auth)/login` (pública) e `(dashboard)/*` (protegidas por `AuthContext` — redireciona
pra `/login` se não houver usuário).

## O que falta pro MVP completo (não implementado ainda)

- **Prioridade 2 — Tráfego pago**: leitura da Meta Marketing API + atribuição de conversa/
  agendamento a anúncio via `ctwa_clid`.
- **Prioridade 3 — Conciliação financeira**: fechamento diário automático — falta saber qual
  adquirente/maquininha a barbearia usa antes de desenhar a integração.
- Prioridades 4-6 (conteúdo, estoque, comissão) e dashboard financeiro final.

Ver o plano salvo em `.claude/plans/` (sessão que criou este projeto) para o raciocínio completo
por trás dessas decisões.

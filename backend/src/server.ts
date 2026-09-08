import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool';
import { auth, requireRoles } from './middleware/auth';
import { createAuthRouter } from './routes/auth';
import { createConversationsRouter } from './routes/conversations';
import { createAppointmentsRouter } from './services/appointments';
import { createWhatsAppWebhookRouter } from './services/whatsapp/webhookRouter';
import { startScheduler } from './services/scheduling/scheduler';
import { ensureOwnerFromEnv } from './bootstrap/ensureOwner';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não definido no .env — servidor não pode iniciar.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8001;

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
// Captura o corpo bruto em req.rawBody — necessário para validar a
// assinatura X-Hub-Signature-256 do webhook do WhatsApp.
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

// Rota de saúde na raiz — hospedagens costumam checar "/" pra saber se o
// processo está vivo antes de considerar o deploy saudável; sem isso, uma
// plataforma que espera 200 em "/" pode ficar reiniciando o processo (o que
// já aconteceu aqui: reinícios a cada 1-3 min, sem o app nunca terminar de
// subir de verdade).
app.get('/', (_req, res) => res.status(200).send('NGR Barbearia API'));
app.get('/api/v1/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

app.use('/api/v1/auth', createAuthRouter(pool));
app.use('/api/v1/conversations', createConversationsRouter(pool));
app.use('/api/v1', createAppointmentsRouter({ pool, auth, requireRoles }));
// WhatsApp Cloud API chama estas rotas diretamente (fora do prefixo /api/v1 —
// a URL do webhook é fixa no Meta Business Manager).
app.use(createWhatsAppWebhookRouter());

// Roda antes de começar a aceitar conexões — em algumas hospedagens o
// processo é reiniciado poucos segundos depois do boot se "/" não responder
// rápido, o que já cortou esse passo no meio antes (nenhum log de bootstrap
// chegava a aparecer). Rodar primeiro e só then ligar o listener evita a corrida.
ensureOwnerFromEnv()
  .catch((err) => console.error('[bootstrap] falha ao garantir owner:', err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`[server] NGR Barbearia API rodando na porta ${PORT}`);
      startScheduler();
    });
  });

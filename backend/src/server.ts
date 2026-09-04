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

app.get('/api/v1/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

app.use('/api/v1/auth', createAuthRouter(pool));
app.use('/api/v1/conversations', createConversationsRouter(pool));
app.use('/api/v1', createAppointmentsRouter({ pool, auth, requireRoles }));
// WhatsApp Cloud API chama estas rotas diretamente (fora do prefixo /api/v1 —
// a URL do webhook é fixa no Meta Business Manager).
app.use(createWhatsAppWebhookRouter());

app.listen(PORT, () => {
  console.log(`[server] NGR Barbearia API rodando na porta ${PORT}`);
  startScheduler();
});

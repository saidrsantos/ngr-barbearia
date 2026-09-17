import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool';
import { auth, requireRoles } from './middleware/auth';
import { createAuthRouter } from './routes/auth';
import { createConversationsRouter } from './routes/conversations';
import { createAppointmentsRouter } from './services/appointments';
import { createDebtsRouter } from './services/debts/router';
import { createPayablesRouter } from './services/payables/router';
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

// Rota temporária — busca o catálogo de serviços e profissionais direto na
// API do App Barber, só pra pegar os service_code/employee_code e preencher
// no painel. Remover a rota depois de usar.
app.get('/api/v1/appbarber-catalogo', auth, async (_req, res) => {
  const apiKey = process.env.APPBARBER_API_KEY;
  const establishmentCode = process.env.APPBARBER_ESTABLISHMENT_CODE;
  if (!apiKey || !establishmentCode) {
    return res.status(400).json({ success: false, message: 'APPBARBER_API_KEY/APPBARBER_ESTABLISHMENT_CODE não configurados.' });
  }
  try {
    const headers = {
      'X-API-Key': apiKey,
      'User-Agent': 'Mozilla/5.0 (compatible; NGRBarbeariaBackend/1.0)',
      Accept: 'application/json',
    };
    const [servicesRes, professionalsRes] = await Promise.all([
      fetch(`https://api.appbarber.com/v1/services?establishment_code=${establishmentCode}`, { headers }),
      fetch(`https://api.appbarber.com/v1/professional-list?establishment_code=${establishmentCode}`, { headers }),
    ]);
    const servicesText = await servicesRes.text();
    const professionalsText = await professionalsRes.text();
    if (!servicesRes.ok || !professionalsRes.ok) {
      return res.status(502).json({
        success: false,
        message: 'API do App Barber respondeu com erro.',
        debug: {
          services_status: servicesRes.status,
          services_body: servicesText.slice(0, 500),
          professionals_status: professionalsRes.status,
          professionals_body: professionalsText.slice(0, 500),
        },
      });
    }
    res.json({ success: true, data: { services: JSON.parse(servicesText), professionals: JSON.parse(professionalsText) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Falha ao consultar API do App Barber.', debug: err instanceof Error ? err.message : String(err) });
  }
});

app.use('/api/v1/auth', createAuthRouter(pool));
app.use('/api/v1/conversations', createConversationsRouter(pool));
app.use('/api/v1', createAppointmentsRouter({ pool, auth, requireRoles }));
app.use('/api/v1', createDebtsRouter({ pool, auth, requireRoles }));
app.use('/api/v1', createPayablesRouter({ pool, auth, requireRoles }));
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

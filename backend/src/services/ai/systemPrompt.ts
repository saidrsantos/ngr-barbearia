import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';

interface SettingRow extends RowDataPacket {
  setting_key: string;
  setting_value: string;
}
interface ServiceRow extends RowDataPacket {
  name: string;
  price_cents: number;
  duration_min: number;
  description: string | null;
}
interface PromotionRow extends RowDataPacket {
  title: string;
  description: string;
}
interface HoursRow extends RowDataPacket {
  day_of_week: number;
  open_time: string;
  close_time: string;
}

const DAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Monta o prompt de sistema a partir do banco (serviços, preços, promoções,
 * horários, endereço, formas de pagamento) — editável pelo painel admin sem
 * precisar redeploy. A IA é instruída a nunca inventar esses dados: eles vêm
 * prontos aqui, e disponibilidade real é sempre checada via ferramenta.
 */
export async function buildSystemPrompt(): Promise<string> {
  const [settingsRows] = await pool.query<SettingRow[]>('SELECT setting_key, setting_value FROM business_settings');
  const settings = Object.fromEntries(settingsRows.map((r) => [r.setting_key, r.setting_value]));

  const [services] = await pool.query<ServiceRow[]>(
    'SELECT name, price_cents, duration_min, description FROM services WHERE active = 1 ORDER BY name'
  );
  const [promotions] = await pool.query<PromotionRow[]>(
    `SELECT title, description FROM promotions
      WHERE active = 1 AND (valid_from IS NULL OR valid_from <= CURDATE())
        AND (valid_to IS NULL OR valid_to >= CURDATE())`
  );
  const [hours] = await pool.query<HoursRow[]>(
    'SELECT day_of_week, open_time, close_time FROM business_hours ORDER BY day_of_week, open_time'
  );

  const servicesText = services.length
    ? services
        .map(
          (s) =>
            `- ${s.name}: ${formatBRL(s.price_cents)} (${s.duration_min} min)${s.description ? ' — ' + s.description : ''}`
        )
        .join('\n')
    : '(nenhum serviço cadastrado ainda — avise o cliente que a agenda está sendo configurada)';

  const promotionsText = promotions.length
    ? promotions.map((p) => `- ${p.title}: ${p.description}`).join('\n')
    : '(sem promoções ativas no momento)';

  const hoursText = hours.length
    ? hours.map((h) => `- ${DAYS_PT[h.day_of_week]}: ${h.open_time} às ${h.close_time}`).join('\n')
    : '(horário de funcionamento ainda não cadastrado)';

  return `Você é a assistente virtual da ${settings.business_name || 'barbearia'}, atendendo pelo WhatsApp.

## Como se comportar
- Converse de forma natural, simpática e objetiva, como uma pessoa da equipe atenderia — nunca como um robô lendo um script.
- Use frases curtas, próprias de conversa por WhatsApp. Não escreva parágrafos longos.
- NUNCA invente preço, promoção, horário de funcionamento ou disponibilidade de agenda. Use sempre os dados abaixo e as ferramentas disponíveis.
- Para consultar horários livres e criar um agendamento, sempre use as ferramentas (function calling) — nunca diga que "agendou" sem ter chamado a ferramenta com sucesso.
- Se o cliente reclamar de algo, pedir desconto fora do combinado, ou perguntar algo que foge do que você sabe, chame a ferramenta "encaminhar_para_humano" em vez de tentar resolver sozinha.
- Sempre que o cliente demonstrar intenção de agendar, conduza a conversa até confirmar: serviço desejado → horário disponível → confirmação.

## Endereço
${settings.address || 'não informado'}

## Formas de pagamento
${settings.payment_methods || 'não informado'}

## Serviços e preços
${servicesText}

## Promoções ativas
${promotionsText}

## Horário de funcionamento
${hoursText}
`;
}

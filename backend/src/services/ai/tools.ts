import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import { getAppointmentProvider } from '../appointments';
import { Slot } from '../appointments/types';

export interface ToolContext {
  customerId: number;
  conversationId: number;
  whatsappNumber: string;
  customerName: string | null;
}

interface ServiceRow extends RowDataPacket {
  id: number;
  name: string;
  price_cents: number;
  duration_min: number;
}

interface BarberRow extends RowDataPacket {
  id: number;
  name: string;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function findServiceByName(name: string): Promise<ServiceRow | null> {
  const [rows] = await pool.query<ServiceRow[]>(
    'SELECT id, name, price_cents, duration_min FROM services WHERE active = 1 AND name LIKE ? LIMIT 1',
    [`%${name}%`]
  );
  return rows[0] || null;
}

async function findBarberByName(name: string): Promise<BarberRow | null> {
  const [rows] = await pool.query<BarberRow[]>(
    'SELECT id, name FROM barbers WHERE active = 1 AND name LIKE ? LIMIT 1',
    [`%${name}%`]
  );
  return rows[0] || null;
}

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'listar_servicos_precos',
      description: 'Lista todos os serviços ativos, com preço e duração exatos.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_horarios_disponiveis',
      description: 'Busca horários realmente disponíveis para um serviço nos próximos dias. Sempre use antes de propor um horário ao cliente. Se o cliente disser que tem preferência por um barbeiro específico, passe "barbeiro_nome" para filtrar só a agenda dele — não pergunte a preferência se o cliente não demonstrar uma.',
      parameters: {
        type: 'object',
        properties: {
          nome_servico: { type: 'string', description: 'Nome do serviço (como aparece em listar_servicos_precos).' },
          dias_a_frente: { type: 'integer', description: 'Quantos dias a partir de hoje considerar na busca. Padrão 7.' },
          barbeiro_nome: { type: 'string', description: 'Nome do barbeiro, apenas se o cliente tiver preferência. Omitir para buscar entre todos os barbeiros e oferecer o horário mais próximo disponível.' },
        },
        required: ['nome_servico'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_agendamento',
      description: 'Cria um agendamento tentativo para o cliente atual em um horário retornado por buscar_horarios_disponiveis.',
      parameters: {
        type: 'object',
        properties: {
          nome_servico: { type: 'string' },
          horario_iso: { type: 'string', description: 'Data/hora ISO 8601 exata de um slot retornado por buscar_horarios_disponiveis.' },
          barbeiro_id: { type: 'integer', description: 'ID do barbeiro do slot escolhido, se o slot tiver um. Omitir se não houver.' },
        },
        required: ['nome_servico', 'horario_iso'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirmar_agendamento',
      description: 'Confirma definitivamente um agendamento tentativo, depois que o cliente confirmar por mensagem.',
      parameters: {
        type: 'object',
        properties: { agendamento_id: { type: 'integer' } },
        required: ['agendamento_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'encaminhar_para_humano',
      description: 'Marca a conversa para ser assumida por uma pessoa da equipe (reclamação, negociação, ou qualquer pedido fora do que você pode resolver com os dados e ferramentas disponíveis).',
      parameters: {
        type: 'object',
        properties: { motivo: { type: 'string' } },
        required: ['motivo'],
      },
    },
  },
];

export function createToolExecutor(ctx: ToolContext) {
  async function execute(name: string, args: Record<string, any>): Promise<unknown> {
    switch (name) {
      case 'listar_servicos_precos': {
        const [rows] = await pool.query<ServiceRow[]>(
          'SELECT id, name, price_cents, duration_min FROM services WHERE active = 1 ORDER BY name'
        );
        return rows.map((r) => ({
          nome: r.name,
          preco: formatBRL(r.price_cents),
          duracao_min: r.duration_min,
        }));
      }

      case 'buscar_horarios_disponiveis': {
        const service = await findServiceByName(args.nome_servico);
        if (!service) return { erro: 'Serviço não encontrado. Use listar_servicos_precos primeiro.' };

        let barberId: number | undefined;
        if (args.barbeiro_nome) {
          const barber = await findBarberByName(args.barbeiro_nome);
          if (!barber) return { erro: 'Barbeiro não encontrado com esse nome. Confirme o nome com o cliente ou busque sem esse filtro.' };
          barberId = barber.id;
        }

        const diasAFrente = Math.min(Math.max(Number(args.dias_a_frente) || 7, 1), 14);
        const from = new Date();
        const to = new Date(from.getTime() + diasAFrente * 24 * 60 * 60 * 1000);

        const slots = await getAppointmentProvider().listAvailability(service.id, { from, to });
        const filtered = barberId === undefined ? slots : slots.filter((s) => s.barberId === barberId);
        const top = filtered.slice(0, 20);
        return {
          servico: service.name,
          horarios: top.map((s: Slot) => ({
            horario_iso: s.start.toISOString(),
            barbeiro_id: s.barberId,
          })),
        };
      }

      case 'criar_agendamento': {
        const service = await findServiceByName(args.nome_servico);
        if (!service) return { erro: 'Serviço não encontrado.' };
        const start = new Date(args.horario_iso);
        if (Number.isNaN(start.getTime())) return { erro: 'horario_iso inválido.' };
        const end = new Date(start.getTime() + service.duration_min * 60000);
        const barberId = args.barbeiro_id ?? null;

        const result = await getAppointmentProvider().createAppointment(
          { id: ctx.customerId, whatsappNumber: ctx.whatsappNumber, name: ctx.customerName },
          service.id,
          { start, end, barberId },
          ctx.conversationId
        );
        await pool.execute("UPDATE conversations SET status = 'scheduled' WHERE id = ?", [
          ctx.conversationId,
        ]);
        return {
          agendamento_id: result.appointmentId,
          status: result.status,
          servico: service.name,
          horario: start.toLocaleString('pt-BR'),
        };
      }

      case 'confirmar_agendamento': {
        await getAppointmentProvider().confirmAppointment(Number(args.agendamento_id));
        return { ok: true };
      }

      case 'encaminhar_para_humano': {
        await pool.execute("UPDATE conversations SET status = 'needs_human' WHERE id = ?", [
          ctx.conversationId,
        ]);
        return { ok: true };
      }

      default:
        return { erro: `Ferramenta desconhecida: ${name}` };
    }
  }

  return { execute };
}

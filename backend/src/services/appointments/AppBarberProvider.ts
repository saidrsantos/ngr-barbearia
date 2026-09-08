import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../db/pool';
import {
  AppointmentProvider,
  Slot,
  DateRange,
  CustomerRef,
  CreateAppointmentResult,
} from './types';
import { APPBARBER_API_KEY, APPBARBER_ESTABLISHMENT_CODE, APPBARBER_BASE_URL } from './appbarberConfig';

interface ServiceRow extends RowDataPacket {
  id: number;
  appbarber_code: number | null;
  duration_min: number;
}

interface BarberRow extends RowDataPacket {
  id: number;
  appbarber_code: number | null;
}

interface AppointmentRow extends RowDataPacket {
  id: number;
  external_id: string | null;
}

interface AppBarberAvailabilityItem {
  employee_code: number;
  available: Array<{ scheduling_time: string }>;
}

interface AppBarberApiEnvelope<T> {
  correlationId: string;
  data: T;
}

async function callAppBarber<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!APPBARBER_API_KEY || !APPBARBER_ESTABLISHMENT_CODE) {
    throw new Error(
      'APPBARBER_API_KEY/APPBARBER_ESTABLISHMENT_CODE não configurados — sem acesso à API do App Barber ainda.'
    );
  }
  const res = await fetch(`${APPBARBER_BASE_URL}${path}`, {
    ...options,
    headers: {
      'X-API-Key': APPBARBER_API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`App Barber API respondeu ${res.status} em ${path}: ${body}`);
  }
  const envelope = (await res.json()) as AppBarberApiEnvelope<T>;
  return envelope.data;
}

/**
 * Implementação real contra a API oficial do App Barber
 * (https://api-docs-appbarber.calm-breeze-b4e7.workers.dev/), liberada em
 * setembro/2026. Usa APPBARBER_API_KEY + APPBARBER_ESTABLISHMENT_CODE.
 *
 * Mapeamento: nossos `services`/`barbers` locais precisam ter o campo
 * `appbarber_code` preenchido (no painel) apontando pro service_code /
 * employee_code correspondente no App Barber — é assim que traduzimos entre
 * os dois sistemas. Serviço/barbeiro sem esse código fica de fora da agenda
 * quando este provider está ativo.
 *
 * Limitação conhecida: a API de parceiros não expõe endpoint de cancelamento
 * de agendamento (só de "comanda", que é outra coisa) — cancelAppointment()
 * só atualiza nosso status local; a equipe precisa cancelar manualmente
 * dentro do próprio App Barber também.
 */
export class AppBarberProvider implements AppointmentProvider {
  async listAvailability(serviceId: number, range: DateRange): Promise<Slot[]> {
    const [[service]] = await pool.query<ServiceRow[]>(
      'SELECT id, appbarber_code, duration_min FROM services WHERE id = ? AND active = 1',
      [serviceId]
    );
    if (!service || !service.appbarber_code) return [];

    const [barberRows] = await pool.query<BarberRow[]>(
      'SELECT id, appbarber_code FROM barbers WHERE active = 1 AND appbarber_code IS NOT NULL'
    );
    const barberByCode = new Map(barberRows.map((b) => [b.appbarber_code, b.id]));

    const slots: Slot[] = [];
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (
      let day = new Date(range.from);
      day.getTime() <= range.to.getTime();
      day = new Date(day.getTime() + oneDayMs)
    ) {
      const dateStr = day.toISOString().slice(0, 10);
      const data = await callAppBarber<AppBarberAvailabilityItem[]>(
        `/v1/availability?establishment_code=${APPBARBER_ESTABLISHMENT_CODE}&start_date=${dateStr}&service_code=${service.appbarber_code}`
      );

      for (const item of data) {
        const barberId = barberByCode.get(item.employee_code);
        if (!barberId) continue; // profissional ainda não mapeado no painel
        for (const slot of item.available) {
          const [h, m] = slot.scheduling_time.split(':').map(Number);
          const start = new Date(day);
          start.setHours(h, m, 0, 0);
          if (start <= new Date()) continue;
          const end = new Date(start.getTime() + service.duration_min * 60000);
          slots.push({ start, end, barberId });
        }
      }
    }

    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  async createAppointment(
    customer: CustomerRef,
    serviceId: number,
    slot: Slot,
    conversationId: number | null
  ): Promise<CreateAppointmentResult> {
    const [[service]] = await pool.query<ServiceRow[]>(
      'SELECT id, appbarber_code, duration_min FROM services WHERE id = ?',
      [serviceId]
    );
    if (!service?.appbarber_code) {
      throw new Error(`Serviço ${serviceId} não tem appbarber_code configurado.`);
    }
    const [[barber]] = slot.barberId
      ? await pool.query<BarberRow[]>('SELECT id, appbarber_code FROM barbers WHERE id = ?', [slot.barberId])
      : [[undefined as unknown as BarberRow]];
    if (!barber?.appbarber_code) {
      throw new Error(`Barbeiro ${slot.barberId} não tem appbarber_code configurado.`);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${slot.start.getFullYear()}-${pad(slot.start.getMonth() + 1)}-${pad(slot.start.getDate())} ${pad(
      slot.start.getHours()
    )}:${pad(slot.start.getMinutes())}`;

    const data = await callAppBarber<{ appointment_code: number }>('/v1/appointments', {
      method: 'POST',
      body: JSON.stringify({
        customer_phone: Number(customer.whatsappNumber),
        customer_name: customer.name || 'Cliente WhatsApp',
        establishment_code: Number(APPBARBER_ESTABLISHMENT_CODE),
        start_date: startDate,
        professionals: [{ professional_code: barber.appbarber_code }],
        services: [{ service_code: service.appbarber_code, duration: service.duration_min }],
      }),
    });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO appointments
         (customer_id, service_id, barber_id, conversation_id, scheduled_at, status, provider, external_id)
       VALUES (?, ?, ?, ?, ?, 'tentative', 'appbarber', ?)`,
      [customer.id, serviceId, slot.barberId, conversationId, slot.start, String(data.appointment_code)]
    );

    return { appointmentId: result.insertId, externalId: String(data.appointment_code), status: 'tentative' };
  }

  async confirmAppointment(appointmentId: number): Promise<void> {
    const [[appt]] = await pool.query<AppointmentRow[]>(
      'SELECT id, external_id FROM appointments WHERE id = ?',
      [appointmentId]
    );
    if (!appt?.external_id) throw new Error(`Agendamento ${appointmentId} sem external_id do App Barber.`);

    await callAppBarber(`/v1/appointments/${appt.external_id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ establishment_code: Number(APPBARBER_ESTABLISHMENT_CODE), status_type: 1 }),
    });
    await pool.execute("UPDATE appointments SET status = 'confirmed' WHERE id = ?", [appointmentId]);
  }

  async cancelAppointment(appointmentId: number): Promise<void> {
    // A API de parceiros do App Barber não expõe cancelamento de agendamento
    // (só de comanda, que é outra coisa) — só atualizamos nosso status local.
    // A equipe precisa cancelar manualmente dentro do App Barber também.
    console.warn(
      `[appbarber] cancelAppointment(${appointmentId}): API não suporta cancelar agendamento — ` +
        'cancele manualmente dentro do App Barber também.'
    );
    await pool.execute("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [appointmentId]);
  }
}

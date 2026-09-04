import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../db/pool';
import {
  AppointmentProvider,
  Slot,
  DateRange,
  CustomerRef,
  CreateAppointmentResult,
} from './types';
import { computeAvailableSlots } from './availabilityMath';

interface ServiceRow extends RowDataPacket {
  id: number;
  duration_min: number;
}

interface BusinessHourRow extends RowDataPacket {
  day_of_week: number;
  open_time: string;
  close_time: string;
  barber_id: number | null;
}

interface BarberRow extends RowDataPacket {
  id: number;
}

interface BusyAppointmentRow extends RowDataPacket {
  scheduled_at: Date;
  barber_id: number | null;
  duration_min: number;
}

/**
 * Agenda interna (MVP), usada enquanto o acesso à API do App Barber não é
 * liberado. Busca os dados no banco e delega o cálculo de disponibilidade
 * para computeAvailableSlots (lógica pura, testada isoladamente). Quando o
 * App Barber liberar a API, o AppBarberProvider assume sem mudar quem chama
 * esta interface.
 */
export class InternalCalendarProvider implements AppointmentProvider {
  async listAvailability(serviceId: number, range: DateRange): Promise<Slot[]> {
    const [[service]] = await pool.query<ServiceRow[]>(
      'SELECT id, duration_min FROM services WHERE id = ? AND active = 1',
      [serviceId]
    );
    if (!service) return [];

    const [hours] = await pool.query<BusinessHourRow[]>(
      'SELECT day_of_week, open_time, close_time, barber_id FROM business_hours'
    );
    if (hours.length === 0) return [];

    const [barberRows] = await pool.query<BarberRow[]>(
      'SELECT id FROM barbers WHERE active = 1'
    );
    const activeBarberIds: Array<number | null> =
      barberRows.length > 0 ? barberRows.map((b) => b.id) : [null];

    const [busyRows] = await pool.query<BusyAppointmentRow[]>(
      `SELECT a.scheduled_at, a.barber_id, s.duration_min
         FROM appointments a
         JOIN services s ON s.id = a.service_id
        WHERE a.status != 'cancelled'
          AND a.scheduled_at BETWEEN ? AND ?`,
      [range.from, range.to]
    );

    return computeAvailableSlots({
      durationMin: service.duration_min,
      businessHours: hours.map((h) => ({
        dayOfWeek: h.day_of_week,
        openTime: h.open_time,
        closeTime: h.close_time,
        barberId: h.barber_id,
      })),
      activeBarberIds,
      busyAppointments: busyRows.map((b) => ({
        scheduledAt: new Date(b.scheduled_at),
        barberId: b.barber_id,
        durationMin: b.duration_min,
      })),
      range,
      now: new Date(),
    });
  }

  async createAppointment(
    customer: CustomerRef,
    serviceId: number,
    slot: Slot,
    conversationId: number | null
  ): Promise<CreateAppointmentResult> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO appointments
         (customer_id, service_id, barber_id, conversation_id, scheduled_at, status, provider)
       VALUES (?, ?, ?, ?, ?, 'tentative', 'internal')`,
      [customer.id, serviceId, slot.barberId, conversationId, slot.start]
    );
    return { appointmentId: result.insertId, externalId: null, status: 'tentative' };
  }

  async confirmAppointment(appointmentId: number): Promise<void> {
    await pool.execute("UPDATE appointments SET status = 'confirmed' WHERE id = ?", [
      appointmentId,
    ]);
  }

  async cancelAppointment(appointmentId: number): Promise<void> {
    await pool.execute("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [
      appointmentId,
    ]);
  }
}

import { Slot } from './types';

export interface BusinessHourInput {
  dayOfWeek: number; // 0=domingo ... 6=sábado
  openTime: string; // 'HH:MM' ou 'HH:MM:SS'
  closeTime: string;
  barberId: number | null;
}

export interface BusyAppointmentInput {
  scheduledAt: Date;
  barberId: number | null;
  durationMin: number;
}

export interface ComputeAvailableSlotsInput {
  durationMin: number;
  businessHours: BusinessHourInput[];
  activeBarberIds: Array<number | null>;
  busyAppointments: BusyAppointmentInput[];
  range: { from: Date; to: Date };
  now: Date;
}

function toMinutesSinceMidnight(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function atMinutes(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

/**
 * Lógica pura de geração de horários disponíveis, extraída do
 * InternalCalendarProvider para poder ser testada sem banco de dados: dado o
 * horário de funcionamento, os barbeiros ativos e os agendamentos já
 * existentes, calcula os slots livres dentro do intervalo pedido.
 */
export function computeAvailableSlots(input: ComputeAvailableSlotsInput): Slot[] {
  const { durationMin, businessHours, activeBarberIds, busyAppointments, range, now } = input;
  const slots: Slot[] = [];
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (
    let day = new Date(range.from);
    day.getTime() <= range.to.getTime();
    day = new Date(day.getTime() + oneDayMs)
  ) {
    const dayOfWeek = day.getDay();
    const dayHours = businessHours.filter((h) => h.dayOfWeek === dayOfWeek);

    for (const bh of dayHours) {
      const barberIds = bh.barberId !== null ? [bh.barberId] : activeBarberIds;
      const openMin = toMinutesSinceMidnight(bh.openTime);
      const closeMin = toMinutesSinceMidnight(bh.closeTime);

      for (const barberId of barberIds) {
        for (let start = openMin; start + durationMin <= closeMin; start += durationMin) {
          const slotStart = atMinutes(day, start);
          const slotEnd = new Date(slotStart.getTime() + durationMin * 60000);
          if (slotStart <= now) continue;

          const overlaps = busyAppointments.some((busy) => {
            if (barberId !== null && busy.barberId !== null && busy.barberId !== barberId) {
              return false;
            }
            const busyStart = busy.scheduledAt.getTime();
            const busyEnd = busyStart + busy.durationMin * 60000;
            return slotStart.getTime() < busyEnd && busyStart < slotEnd.getTime();
          });
          if (!overlaps) slots.push({ start: slotStart, end: slotEnd, barberId });
        }
      }
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

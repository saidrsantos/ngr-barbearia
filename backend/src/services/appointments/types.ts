export interface Slot {
  start: Date;
  end: Date;
  barberId: number | null;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface CustomerRef {
  id: number;
  whatsappNumber: string;
  name: string | null;
}

export interface CreateAppointmentResult {
  appointmentId: number;
  externalId: string | null;
  status: 'tentative' | 'confirmed';
}

/**
 * Fonte de verdade da agenda. Duas implementações trocáveis via
 * APPOINTMENT_PROVIDER, sem nenhuma mudança no resto do sistema (IA,
 * lembretes, painel): InternalCalendarProvider (agora) e AppBarberProvider
 * (quando o acesso à API for concedido).
 */
export interface AppointmentProvider {
  listAvailability(serviceId: number, range: DateRange): Promise<Slot[]>;
  createAppointment(
    customer: CustomerRef,
    serviceId: number,
    slot: Slot,
    conversationId: number | null
  ): Promise<CreateAppointmentResult>;
  confirmAppointment(appointmentId: number): Promise<void>;
  cancelAppointment(appointmentId: number): Promise<void>;
}

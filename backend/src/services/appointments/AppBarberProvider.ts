import {
  AppointmentProvider,
  Slot,
  DateRange,
  CustomerRef,
  CreateAppointmentResult,
} from './types';

/**
 * Esqueleto do provider real, para quando o App Barber liberar acesso à API
 * (o usuário já solicitou por e-mail). Implementar aqui assim que a
 * documentação/credenciais chegarem — os métodos abaixo têm exatamente a
 * mesma assinatura do InternalCalendarProvider, então nenhum outro arquivo
 * do sistema (IA, lembretes, painel) precisa mudar quando isso acontecer.
 * Troca de provider é só a variável de ambiente APPOINTMENT_PROVIDER.
 */
export class AppBarberProvider implements AppointmentProvider {
  async listAvailability(_serviceId: number, _range: DateRange): Promise<Slot[]> {
    throw new Error(
      'AppBarberProvider ainda não implementado — aguardando acesso à API do App Barber. ' +
        'Use APPOINTMENT_PROVIDER=internal até lá.'
    );
  }

  async createAppointment(
    _customer: CustomerRef,
    _serviceId: number,
    _slot: Slot,
    _conversationId: number | null
  ): Promise<CreateAppointmentResult> {
    throw new Error(
      'AppBarberProvider ainda não implementado — aguardando acesso à API do App Barber. ' +
        'Use APPOINTMENT_PROVIDER=internal até lá.'
    );
  }

  async confirmAppointment(_appointmentId: number): Promise<void> {
    throw new Error('AppBarberProvider ainda não implementado.');
  }

  async cancelAppointment(_appointmentId: number): Promise<void> {
    throw new Error('AppBarberProvider ainda não implementado.');
  }
}

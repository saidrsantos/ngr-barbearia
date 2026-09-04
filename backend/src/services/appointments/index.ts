import { AppointmentProvider } from './types';
import { InternalCalendarProvider } from './InternalCalendarProvider';
import { AppBarberProvider } from './AppBarberProvider';

let cachedProvider: AppointmentProvider | null = null;

export function getAppointmentProvider(): AppointmentProvider {
  if (cachedProvider) return cachedProvider;
  const kind = process.env.APPOINTMENT_PROVIDER || 'internal';
  cachedProvider = kind === 'appbarber' ? new AppBarberProvider() : new InternalCalendarProvider();
  return cachedProvider;
}

export * from './types';
export { createAppointmentsRouter } from './router';

import axios from 'axios';
import Cookies from 'js-cookie';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1',
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('ngr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('ngr_token');
      // fora de componente React (interceptor do axios) — sem acesso ao router do Next aqui.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface Service {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  duration_min: number;
  active: boolean;
}

export interface Promotion {
  id: number;
  title: string;
  description: string;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
}

export interface Barber {
  id: number;
  name: string;
  active: boolean;
}

export interface BusinessHour {
  id: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  barber_id: number | null;
}

export interface Appointment {
  id: number;
  scheduled_at: string;
  status: string;
  provider: string;
  customer_name: string | null;
  whatsapp_number: string;
  service_name: string;
  barber_name: string | null;
}

export interface Conversation {
  id: number;
  status: string;
  last_message_at: string;
  customer_name: string | null;
  whatsapp_number: string;
}

export interface Message {
  id: number;
  direction: 'in' | 'out';
  content: string;
  ai_generated: boolean;
  created_at: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: { token: string; user: { id: number; name: string; role: string } } }>(
      '/auth/login',
      { email, password }
    ),
  me: () => api.get('/auth/me'),
};

export const servicesApi = {
  list: () => api.get<{ data: Service[] }>('/services'),
  create: (payload: Partial<Service>) => api.post('/services', payload),
  update: (id: number, payload: Partial<Service>) => api.put(`/services/${id}`, payload),
  remove: (id: number) => api.delete(`/services/${id}`),
};

export const promotionsApi = {
  list: () => api.get<{ data: Promotion[] }>('/promotions'),
  create: (payload: Partial<Promotion>) => api.post('/promotions', payload),
  update: (id: number, payload: Partial<Promotion>) => api.put(`/promotions/${id}`, payload),
  remove: (id: number) => api.delete(`/promotions/${id}`),
};

export const barbersApi = {
  list: () => api.get<{ data: Barber[] }>('/barbers'),
  create: (payload: Partial<Barber>) => api.post('/barbers', payload),
};

export const businessHoursApi = {
  list: () => api.get<{ data: BusinessHour[] }>('/business-hours'),
  create: (payload: Partial<BusinessHour>) => api.post('/business-hours', payload),
  remove: (id: number) => api.delete(`/business-hours/${id}`),
};

export const appointmentsApi = {
  list: (params?: Record<string, string>) => api.get<{ data: Appointment[] }>('/appointments', { params }),
  confirm: (id: number) => api.patch(`/appointments/${id}/confirm`),
  cancel: (id: number) => api.patch(`/appointments/${id}/cancel`),
};

export const conversationsApi = {
  list: (status?: string) => api.get<{ data: Conversation[] }>('/conversations', { params: status ? { status } : {} }),
  get: (id: number) => api.get<{ data: Conversation }>(`/conversations/${id}`),
  messages: (id: number) => api.get<{ data: Message[] }>(`/conversations/${id}/messages`),
  reply: (id: number, text: string) => api.post(`/conversations/${id}/reply`, { text }),
  resumeAi: (id: number) => api.patch(`/conversations/${id}/resume-ai`),
};

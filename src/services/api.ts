import type {
  AiAnalysis, DashboardSummary, Equipment, HistoryEvent, Occurrence, OccurrenceCreate,
  Task, TaskCreate, User,
} from '../types/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
export const DEMO_ACCESS_REQUIRED = import.meta.env.VITE_DEMO_ACCESS_REQUIRED === 'true';
const ACCESS_KEY = 'sm-demo-access';
export const demoAccess = {
  get: () => sessionStorage.getItem(ACCESS_KEY) || '',
  set: (token: string) => sessionStorage.setItem(ACCESS_KEY, token),
  clear: () => sessionStorage.removeItem(ACCESS_KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const token = demoAccess.get();
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError(`Não foi possível conectar à API em ${API_BASE}.`, 0);
  }

  if (!response.ok) {
    let message = `A solicitação falhou (${response.status}).`;
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === 'string') message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((item: { msg?: string }) => item.msg || 'Entrada inválida').join('; ');
    } catch { /* keep the status message */ }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
};

export const api = {
  baseUrl: API_BASE,
  access: (token: string) => request<{ access_required: boolean }>('/access', { headers: { Authorization: `Bearer ${token}` } }),
  summary: () => request<DashboardSummary>('/dashboard/summary'),
  occurrences: (filters: Record<string, string | undefined> = {}) => request<Occurrence[]>(`/occurrences${query(filters)}`),
  occurrence: (id: string) => request<Occurrence>(`/occurrences/${id}`),
  createOccurrence: (payload: OccurrenceCreate) => request<Occurrence>('/occurrences', { method: 'POST', body: JSON.stringify(payload) }),
  patchOccurrence: (id: string, payload: Record<string, unknown>) => request<Occurrence>(`/occurrences/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  analyze: (id: string) => request<AiAnalysis>(`/occurrences/${id}/analyze`, { method: 'POST' }),
  history: (id: string) => request<HistoryEvent[]>(`/occurrences/${id}/history`),
  tasks: (filters: Record<string, string | undefined> = {}) => request<Task[]>(`/tasks${query(filters)}`),
  createTask: (payload: TaskCreate) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  patchTask: (id: string, payload: Record<string, unknown>) => request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  equipment: () => request<Equipment[]>('/equipment'),
  createEquipment: (payload: Omit<Equipment, 'id'>) => request<Equipment>('/equipment', { method: 'POST', body: JSON.stringify(payload) }),
  patchEquipment: (id: string, payload: Record<string, unknown>) => request<Equipment>(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  users: (role?: string) => request<User[]>(`/users${query({ role })}`),
};

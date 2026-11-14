export type Priority = 'untriaged' | 'low' | 'medium' | 'high' | 'critical';
export type OccurrenceStatus = 'open' | 'in_progress' | 'resolved';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type Category = 'hvac' | 'electrical' | 'plumbing' | 'cleaning' | 'other';
export type UserRole = 'operator' | 'technician' | 'manager';

export interface AiAnalysis {
  category: Category;
  suggested_priority: Exclude<Priority, 'untriaged'>;
  suggested_team: string;
  rationale: string;
  recommendation: string;
  is_simulation: boolean;
}

export interface Task {
  id: string;
  occurrence_id: string;
  title: string;
  details: string | null;
  assigned_to: string;
  due_at: string | null;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Occurrence {
  id: string;
  title: string;
  description: string;
  location: string;
  category: Category | null;
  equipment_id: string | null;
  status: OccurrenceStatus;
  priority: Priority;
  created_at: string | null;
  updated_at: string | null;
  ai_analysis: AiAnalysis | null;
  assigned_team: string | null;
  recommendation: string | null;
  ai_reviewed_at: string | null;
  tasks?: Task[];
}

export interface HistoryEvent {
  id: string;
  occurrence_id: string;
  task_id: string | null;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  operational_status: 'operational' | 'maintenance' | 'out_of_service';
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  is_active: boolean;
}

export interface DashboardSummary {
  occurrences_total: number;
  occurrences_by_status: Record<OccurrenceStatus, number>;
  occurrences_by_priority: Record<Priority, number>;
  tasks_pending: number;
  equipment_by_status: Record<'operational' | 'maintenance' | 'out_of_service', number>;
}

export interface OccurrenceCreate {
  title: string;
  description: string;
  location: string;
  category?: Category | null;
  equipment_id?: string | null;
}

export interface TaskCreate {
  occurrence_id: string;
  title: string;
  details?: string;
  assigned_to: string;
  due_at: string;
}

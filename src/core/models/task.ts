export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

/** Tasks are local-only. They are never written to Google Calendar. */
export interface Task {
  id: string;
  title: string;
  description?: string;
  /** `yyyy-MM-dd` */
  dueDate: string | null;
  /** `HH:mm` */
  dueTime: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  estimatedMinutes: number | null;
  /** ISO start of a manually planned time block. Only set by the user. */
  plannedStart?: string;
  createdAt: string;
  updatedAt: string;
}

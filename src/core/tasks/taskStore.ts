import { format, isBefore, startOfDay } from 'date-fns';
import type { Task, TaskPriority } from '@/core/models';
import { createStore } from '@/core/storage/store';

interface TaskState {
  tasks: Task[];
}

export const taskStore = createStore<TaskState>('dayflow:tasks', { tasks: [] }, (stored) => ({
  tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
}));

export interface NewTask {
  title: string;
  description?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: TaskPriority;
  category?: string;
  estimatedMinutes?: number | null;
}

export function addTask(input: NewTask): void {
  const now = new Date().toISOString();
  const task: Task = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    description: input.description,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueTime ?? null,
    priority: input.priority ?? 'medium',
    status: 'todo',
    category: input.category?.trim() || 'General',
    estimatedMinutes: input.estimatedMinutes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  taskStore.update((s) => ({ tasks: [task, ...s.tasks] }));
}

export function updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): void {
  const updatedAt = new Date().toISOString();
  taskStore.update((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt } : t)),
  }));
}

export function toggleTaskDone(id: string): void {
  const task = taskStore.get().tasks.find((t) => t.id === id);
  if (task) updateTask(id, { status: task.status === 'done' ? 'todo' : 'done' });
}

export function deleteTask(id: string): void {
  taskStore.update((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export function compareTasks(a: Task, b: Task): number {
  if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export function isOverdue(task: Task, today: Date): boolean {
  return task.status !== 'done' && !!task.dueDate && isBefore(new Date(`${task.dueDate}T00:00:00`), startOfDay(today));
}

export function isDueOn(task: Task, day: Date): boolean {
  return task.dueDate === format(day, 'yyyy-MM-dd');
}

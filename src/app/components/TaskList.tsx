import { useState, type FormEvent } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Task } from '@/core/models';
import { addTask, deleteTask, isOverdue, toggleTaskDone } from '@/core/tasks/taskStore';
import { cn } from '@/app/lib/cn';
import { IconButton } from './ui/Button';

const PRIORITY_DOT: Record<Task['priority'], string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-border-strong',
};

function TaskItem({ task, today }: { task: Task; today: Date }) {
  const done = task.status === 'done';
  const overdue = isOverdue(task, today);
  return (
    <li className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${task.title}" ${done ? 'not done' : 'done'}`}
        onClick={() => toggleTaskDone(task.id)}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
          done ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong hover:border-accent',
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', PRIORITY_DOT[task.priority])} title={`${task.priority} priority`} />
      <span className={cn('min-w-0 flex-1 truncate text-[13px]', done && 'text-subtle line-through')}>{task.title}</span>
      {task.dueDate && !done && (
        <span className={cn('shrink-0 text-xs tabular-nums', overdue ? 'text-danger' : 'text-subtle')}>
          {overdue ? `Overdue · ${format(new Date(`${task.dueDate}T00:00:00`), 'MMM d')}` : task.dueTime ?? ''}
        </span>
      )}
      <IconButton
        label={`Delete "${task.title}"`}
        onClick={() => deleteTask(task.id)}
        className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </IconButton>
    </li>
  );
}

interface Props {
  tasks: Task[];
  today: Date;
  /** Due date given to tasks created from the quick-add field. */
  defaultDueDate: string | null;
}

export function TaskList({ tasks, today, defaultDueDate }: Props) {
  const [title, setTitle] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({ title, dueDate: defaultDueDate });
    setTitle('');
  };

  return (
    <div>
      <ul className="space-y-px" aria-label="Tasks">
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} today={today} />
        ))}
      </ul>
      {tasks.length === 0 && <p className="px-2 py-1 text-xs text-subtle">No tasks for this day.</p>}
      <form onSubmit={submit} className="mt-1 flex items-center gap-2 px-2">
        <Plus aria-hidden className="size-4 shrink-0 text-subtle" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task and press Enter"
          aria-label="New task title"
          className="h-8 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle"
        />
      </form>
    </div>
  );
}

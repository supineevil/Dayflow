import { taskStore } from '@/core/tasks/taskStore';
import { useStore } from './useStore';

export const useTasks = () => useStore(taskStore).tasks;

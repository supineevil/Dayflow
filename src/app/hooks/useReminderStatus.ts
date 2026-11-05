import { reminderStatusStore } from '@/core/notify/reminderStatus';
import { useStore } from './useStore';

export const useReminderStatus = () => useStore(reminderStatusStore);

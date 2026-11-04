import { Bookmark, CalendarDays, ListTodo, Settings, Video, type LucideIcon } from 'lucide-react';
import type { TabId } from '@/core/models';

export const TAB_META: Record<TabId, { label: string; icon: LucideIcon }> = {
  today: { label: 'Today', icon: ListTodo },
  agenda: { label: 'Agenda', icon: CalendarDays },
  meet: { label: 'Meet', icon: Video },
  links: { label: 'Links', icon: Bookmark },
  settings: { label: 'Settings', icon: Settings },
};

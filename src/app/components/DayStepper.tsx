import { addDays, isSameDay, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, IconButton } from './ui/Button';

/** Previous day, jump back to today, next day. */
export function DayStepper({ day, now, onChange }: { day: Date; now: Date; onChange: (day: Date) => void }) {
  const isToday = isSameDay(day, now);
  return (
    <div className="flex items-center gap-0.5">
      <IconButton label="Previous day" onClick={() => onChange(addDays(day, -1))}>
        <ChevronLeft className="size-4" />
      </IconButton>
      <Button size="sm" variant="ghost" disabled={isToday} onClick={() => onChange(startOfDay(now))}>
        Today
      </Button>
      <IconButton label="Next day" onClick={() => onChange(addDays(day, 1))}>
        <ChevronRight className="size-4" />
      </IconButton>
    </div>
  );
}

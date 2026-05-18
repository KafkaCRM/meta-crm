import { useCallback } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Calendar } from 'lucide-react';
import dayjs from 'dayjs';

interface DateRangePickerProps {
  className?: string;
}

function parseDateRange(search: string): { date_from: string; date_to: string } {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const date_from = params.get('date_from') ?? dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const date_to = params.get('date_to') ?? dayjs().format('YYYY-MM-DD');
  return { date_from, date_to };
}

export function DateRangePicker({ className }: DateRangePickerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { date_from, date_to } = parseDateRange(location.search);

  const handleChange = useCallback(
    (field: 'date_from' | 'date_to', value: string) => {
      const params = new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search);
      params.set(field, value);
      navigate({
        to: location.pathname,
        search: `?${params.toString()}`,
        replace: true,
      });
    },
    [location.pathname, location.search, navigate],
  );

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <input
        type="date"
        value={date_from}
        onChange={(e) => handleChange('date_from', e.target.value)}
        className="rounded-md border border-input px-2 py-1.5 text-sm"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        value={date_to}
        onChange={(e) => handleChange('date_to', e.target.value)}
        className="rounded-md border border-input px-2 py-1.5 text-sm"
      />
    </div>
  );
}

export function getDateRangeFromSearch(search: string): { date_from: string; date_to: string } {
  return parseDateRange(search);
}

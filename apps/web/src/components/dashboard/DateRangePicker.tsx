import { useCallback } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Calendar } from 'lucide-react';
import dayjs from 'dayjs';

interface DateRangePickerProps {
  className?: string;
}

function parseDateRange(search: any): { date_from: string; date_to: string } {
  let date_from: string | null = null;
  let date_to: string | null = null;

  if (typeof search === 'string') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    date_from = params.get('date_from');
    date_to = params.get('date_to');
  } else if (search && typeof search === 'object') {
    date_from = search.date_from;
    date_to = search.date_to;
  }

  return {
    date_from: date_from ?? dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    date_to: date_to ?? dayjs().format('YYYY-MM-DD'),
  };
}

export function DateRangePicker({ className }: DateRangePickerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { date_from, date_to } = parseDateRange(location.search);

  const handleChange = useCallback(
    (field: 'date_from' | 'date_to', value: string) => {
      navigate({
        to: location.pathname,
        search: (prev: any) => ({
          ...prev,
          [field]: value,
        }),
        replace: true,
      });
    },
    [location.pathname, navigate],
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

export function getDateRangeFromSearch(search: any): { date_from: string; date_to: string } {
  return parseDateRange(search);
}

import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Calendar } from 'lucide-react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';

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

  const activePreset = useMemo(() => {
    const from = dayjs(date_from);
    const to = dayjs(date_to);
    const today = dayjs();

    if (from.isSame(today.startOf('week'), 'day') && to.isSame(today, 'day')) return 'week';
    if (from.isSame(today.startOf('month'), 'day') && to.isSame(today, 'day')) return 'month';
    if (from.isSame(today.subtract(30, 'day'), 'day') && to.isSame(today, 'day')) return '30d';
    return null;
  }, [date_from, date_to]);

  const handleChange = useCallback(
    (field: 'date_from' | 'date_to', value: string) => {
      navigate({
        to: location.pathname,
        search: (prev: any) => ({
          ...(prev ?? {}),
          [field]: value,
        }),
        replace: true,
      });
    },
    [location.pathname, navigate],
  );

  const applyPreset = useCallback(
    (preset: string) => {
      const today = dayjs();
      let from: string;
      let to = today.format('YYYY-MM-DD');

      switch (preset) {
        case 'week':
          from = today.startOf('week').format('YYYY-MM-DD');
          break;
        case 'month':
          from = today.startOf('month').format('YYYY-MM-DD');
          break;
        case '30d':
          from = today.subtract(30, 'day').format('YYYY-MM-DD');
          break;
        default:
          return;
      }

      navigate({
        to: location.pathname,
        search: (prev: any) => ({
          ...(prev ?? {}),
          date_from: from,
          date_to: to,
        }),
        replace: true,
      });
    },
    [location.pathname, navigate],
  );

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <div className="flex items-center gap-1">
        <Button
          variant={activePreset === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => applyPreset('week')}
          className={`h-7 text-xs rounded-md ${
            activePreset === 'week'
              ? 'bg-primary text-white hover:bg-[#1e293b]'
              : 'border-border text-muted-foreground hover:bg-background'
          }`}
        >
          This Week
        </Button>
        <Button
          variant={activePreset === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => applyPreset('month')}
          className={`h-7 text-xs rounded-md ${
            activePreset === 'month'
              ? 'bg-primary text-white hover:bg-[#1e293b]'
              : 'border-border text-muted-foreground hover:bg-background'
          }`}
        >
          This Month
        </Button>
        <Button
          variant={activePreset === '30d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => applyPreset('30d')}
          className={`h-7 text-xs rounded-md ${
            activePreset === '30d'
              ? 'bg-primary text-white hover:bg-[#1e293b]'
              : 'border-border text-muted-foreground hover:bg-background'
          }`}
        >
          Last 30 Days
        </Button>
      </div>

      <Separator orientation="vertical" className="h-5 bg-[#e2e8f0]" />

      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="date"
          value={date_from}
          onChange={(e) => handleChange('date_from', e.target.value)}
          className="h-7 rounded-md border border-border px-2 text-xs bg-card text-foreground focus:border-[#0f172a] focus:outline-none"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={date_to}
          onChange={(e) => handleChange('date_to', e.target.value)}
          className="h-7 rounded-md border border-border px-2 text-xs bg-card text-foreground focus:border-[#0f172a] focus:outline-none"
        />
      </div>
    </div>
  );
}

export function getDateRangeFromSearch(search: any): { date_from: string; date_to: string } {
  return parseDateRange(search);
}

function Separator({ orientation, className }: { orientation: 'horizontal' | 'vertical'; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: orientation === 'vertical' ? '1px' : '100%',
        height: orientation === 'horizontal' ? '1px' : '100%',
      }}
    />
  );
}

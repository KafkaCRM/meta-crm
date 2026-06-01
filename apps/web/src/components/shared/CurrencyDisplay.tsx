import React from 'react';
import { useCurrency } from '@/contexts/currency.context';

interface CurrencyDisplayProps {
  value: number;
  className?: string;
  format?: 'indian' | 'standard';
  showSymbol?: boolean;
}

export function CurrencyDisplay({
  value,
  className = '',
  format,
  showSymbol = true,
}: CurrencyDisplayProps) {
  const { config } = useCurrency();
  const activeFormat = format ?? config.format;

  const formatted = React.useMemo(() => {
    if (value === undefined || value === null || isNaN(value)) {
      return showSymbol ? `${config.symbol}0` : '0';
    }

    const locale = activeFormat === 'indian' ? 'en-IN' : 'en-US';
    const formatter = new Intl.NumberFormat(locale, {
      style: 'decimal',
      maximumFractionDigits: 2,
    });
    const formattedVal = formatter.format(value);
    return showSymbol ? `${config.symbol}${formattedVal}` : formattedVal;
  }, [value, activeFormat, showSymbol, config]);

  return <span className={`font-mono ${className}`}>{formatted}</span>;
}

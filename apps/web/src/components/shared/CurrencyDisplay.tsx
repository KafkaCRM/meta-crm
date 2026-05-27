import React from 'react';

interface CurrencyDisplayProps {
  value: number;
  className?: string;
  format?: 'indian' | 'standard';
  showSymbol?: boolean;
}

export function CurrencyDisplay({
  value,
  className = '',
  format = 'indian',
  showSymbol = true,
}: CurrencyDisplayProps) {
  const formatted = React.useMemo(() => {
    if (value === undefined || value === null || isNaN(value)) {
      return showSymbol ? '₹0' : '0';
    }

    if (format === 'indian') {
      // Indian formatting: Lakhs and Crores
      // e.g. 1200000 -> 12,00,000
      const formatter = new Intl.NumberFormat('en-IN', {
        style: 'decimal',
        maximumFractionDigits: 2,
      });
      const formattedVal = formatter.format(value);
      return showSymbol ? `₹${formattedVal}` : formattedVal;
    } else {
      // Standard international formatting
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'decimal',
        maximumFractionDigits: 2,
      });
      const formattedVal = formatter.format(value);
      return showSymbol ? `₹${formattedVal}` : formattedVal;
    }
  }, [value, format, showSymbol]);

  return <span className={`font-mono ${className}`}>{formatted}</span>;
}

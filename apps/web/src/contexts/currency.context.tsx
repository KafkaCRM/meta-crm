import React, { createContext, useContext, useState } from 'react';

export type CurrencyType = 'USD' | 'INR';

export interface CurrencyConfig {
  code: CurrencyType;
  symbol: string;
  locale: string;
  format: 'indian' | 'standard';
}

export const CURRENCY_CONFIGS: Record<CurrencyType, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    format: 'standard',
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    locale: 'en-IN',
    format: 'indian',
  },
};

interface CurrencyContextValue {
  currency: CurrencyType;
  config: CurrencyConfig;
  setCurrency: (currency: CurrencyType) => void;
  formatCurrency: (value: number, maximumFractionDigits?: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyType>(() => {
    const saved = localStorage.getItem('meta-crm-currency');
    return (saved === 'INR' || saved === 'USD') ? saved : 'INR'; // default to INR for Indian customers!
  });

  const setCurrency = (curr: CurrencyType) => {
    setCurrencyState(curr);
    localStorage.setItem('meta-crm-currency', curr);
  };

  const config = CURRENCY_CONFIGS[currency];

  const formatCurrency = (value: number, maximumFractionDigits = 2) => {
    if (value === undefined || value === null || isNaN(value)) {
      return `${config.symbol}0`;
    }
    
    const formatter = new Intl.NumberFormat(config.locale, {
      style: 'decimal',
      maximumFractionDigits,
    });
    
    return `${config.symbol}${formatter.format(value)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, config, setCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}

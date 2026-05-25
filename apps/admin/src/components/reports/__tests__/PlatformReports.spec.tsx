import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlatformReports } from '../PlatformReports';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('PlatformReports', () => {
  it('renders without crashing', () => {
    render(<PlatformReports />, { wrapper });
    expect(screen.getByText('Tenant Segment Allocation')).toBeTruthy();
  });

  it('does not render any PII fields (name, email, phone)', () => {
    const { container } = render(<PlatformReports />, { wrapper });
    const textContent = container.textContent?.toLowerCase() ?? '';

    const piiPatterns = [
      /@.*\.\w{2,}/,
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      /\b[a-z]+\.[a-z]+@/,
    ];

    for (const pattern of piiPatterns) {
      expect(textContent).not.toMatch(pattern);
    }

    const piiLabels = ['email', 'phone', 'name:'];
    for (const label of piiLabels) {
      const elements = container.querySelectorAll('*');
      for (const el of elements) {
        const text = el.textContent?.trim().toLowerCase();
        if (text === label || text?.startsWith(`${label}:`)) {
          throw new Error(`Found PII label "${label}" in PlatformReports`);
        }
      }
    }
  });
});

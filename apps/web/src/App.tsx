import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './contexts/auth.context';
import { queryClient } from './lib/query-client';
import { router } from './routes';
import { GlobalErrorBoundary } from './components/shared/GlobalErrorBoundary';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalErrorBoundary>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ThemeProvider>
      </GlobalErrorBoundary>
    </QueryClientProvider>
  );
}


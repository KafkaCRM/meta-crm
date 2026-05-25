import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider } from './contexts/auth.context';
import { queryClient } from './lib/query-client';
import { router } from './routes';
import { GlobalErrorBoundary } from './components/shared/GlobalErrorBoundary';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalErrorBoundary>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </GlobalErrorBoundary>
    </QueryClientProvider>
  );
}


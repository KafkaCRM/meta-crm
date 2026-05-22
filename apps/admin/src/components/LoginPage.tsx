import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      // Navigate to dashboard after successful login
      navigate({ to: '/' });
    } catch {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 rounded-xl bg-slate-900 items-center justify-center mb-4 shadow-sm border border-slate-800">
            <Shield size={18} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-1">
            Admin Console
          </h1>
          <p className="text-sm text-slate-400">
            Restricted access · Platform team only
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="text-xs font-semibold text-slate-600">
                Email address
              </label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className="bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-xs font-semibold text-slate-600">
                Password
              </label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-50 border-slate-200 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 h-10"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg h-10 mt-2 shadow-sm transition-all"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 font-medium">
          Meta CRM Admin · Platform access
        </p>
      </div>
    </div>
  );
}

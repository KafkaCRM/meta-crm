import { useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1ec]">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#111111] items-center justify-center mb-4">
            <Shield size={18} className="text-white" />
          </div>
          <h1 className="text-2xl font-medium text-[#111111] tracking-tight mb-1">
            Admin Console
          </h1>
          <p className="text-sm text-[#9c9fa5]">
            Restricted access · Platform team only
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#d3cec6] p-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="text-sm font-medium text-[#111111]">
                Email address
              </label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className="bg-[#f5f1ec] border-[#d3cec6] placeholder:text-[#9c9fa5] focus-visible:ring-[#111111] focus-visible:border-[#111111] h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-sm font-medium text-[#111111]">
                Password
              </label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111] focus-visible:border-[#111111] h-10"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#111111] hover:bg-black text-white font-medium rounded-lg h-10 mt-2"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[#9c9fa5] mt-4">
          Meta CRM Admin · Platform access
        </p>
      </div>
    </div>
  );
}

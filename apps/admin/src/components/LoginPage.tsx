import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedEmail = localStorage.getItem('meta_crm_admin_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (rememberMe) {
        localStorage.setItem('meta_crm_admin_remember_email', email);
      } else {
        localStorage.removeItem('meta_crm_admin_remember_email');
      }
      await login(email, password);
      navigate({ to: '/' });
    } catch {
      setError('Invalid platform administrator credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[minmax(0,440px)_1fr]">
        <div className="flex min-h-screen flex-col px-6 py-6 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              M
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-foreground">Meta CRM</p>
              <p className="mt-1 text-xs text-muted-foreground">Platform admin</p>
            </div>
          </div>

          <main className="flex flex-1 items-center py-10">
            <div className="w-full max-w-sm">
              <div className="mb-7">
                <h1 className="text-2xl font-semibold tracking-normal text-foreground">
                  Admin sign in
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Manage tenants, plans, plugins, platform team access, and operational health.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="admin-email" className="block text-xs font-semibold text-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@company.com"
                      className="h-10 rounded-md bg-card pl-9 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="admin-password" className="block text-xs font-semibold text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="h-10 rounded-md bg-card pl-9 pr-9 text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="admin-remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <label htmlFor="admin-remember-me" className="text-xs text-muted-foreground">
                    Remember my email
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 w-full rounded-md text-sm font-semibold"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </main>

          <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
            <span>Meta CRM platform</span>
            <span>Restricted admin access</span>
          </div>
        </div>

        <div className="hidden border-l border-border bg-card lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Platform operations</span>
            <span>Admin console</span>
          </div>

          <div className="max-w-xl">
            <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-normal text-foreground">
              Control tenant setup without exposing platform complexity to CRM users.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
              Use the admin console for tenant lifecycle, billing plans, plugin registry, support impersonation, and platform audit review.
            </p>

            <div className="mt-8 grid gap-3">
              {[
                ['Tenant management', 'Create, inspect, and support customer workspaces.'],
                ['Platform access', 'Manage platform roles and restricted operations.'],
                ['System health', 'Review queues, webhooks, billing, and audit events.'],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-md border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Sessions are limited to platform administrators.
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Building2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [showTenantSlug, setShowTenantSlug] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ slug: string; name: string }[]>([]);
  const [showSelector, setShowSelector] = useState(false);

  // Load saved email if rememberMe was true
  useEffect(() => {
    const savedEmail = localStorage.getItem('meta_crm_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  if (isAuthenticated) {
    router.navigate({ to: '/' });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('meta_crm_remember_email', email);
      } else {
        localStorage.removeItem('meta_crm_remember_email');
      }

      const slug = showTenantSlug && tenantSlug.trim() ? tenantSlug.trim() : undefined;
      const res = await login(email, password, slug);
      if ('multiple_workspaces' in res && res.multiple_workspaces) {
        setWorkspaces(res.workspaces);
        setShowSelector(true);
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'INVALID_CREDENTIALS') {
          setError('Invalid email or password. Please check your credentials.');
        } else if (err.message === 'TENANT_NOT_FOUND') {
          setError('The requested workspace slug could not be found.');
        } else if (err.message === 'ACCOUNT_SUSPENDED') {
          setError('This workspace or account is currently suspended.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Login failed. Please verify your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectWorkspace = async (slug: string) => {
    setError('');
    setIsLoading(true);
    const ws = workspaces.find((w) => w.slug === slug);
    if (ws) localStorage.setItem('meta_crm_tenant_name', ws.name);
    try {
      await login(email, password, slug);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'INVALID_CREDENTIALS') {
          setError('Invalid email or password. Please check your credentials.');
        } else if (err.message === 'TENANT_NOT_FOUND') {
          setError('The requested workspace slug could not be found.');
        } else if (err.message === 'ACCOUNT_SUSPENDED') {
          setError('This workspace or account is currently suspended.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Login failed. Please verify your connection and try again.');
      }
      setShowSelector(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loginStyles = `
    @keyframes float-y-1 {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-12px) rotate(0.5deg); }
    }
    @keyframes float-y-2 {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(8px) rotate(-0.5deg); }
    }
    @keyframes pulse-glow-slow {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.03); }
    }
    .animate-float-1 {
      animation: float-y-1 6s ease-in-out infinite;
    }
    .animate-float-2 {
      animation: float-y-2 7s ease-in-out infinite;
    }
    .animate-pulse-glow {
      animation: pulse-glow-slow 5s ease-in-out infinite;
    }
  `;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground select-none font-sans">
      <style>{loginStyles}</style>
      <div className="grid w-full lg:grid-cols-2">
        {/* Left Column: Form Panel */}
        <div className="flex min-h-screen flex-col justify-between px-6 py-6 sm:px-10 lg:max-w-lg">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <span className="text-white font-bold text-base">M</span>
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-foreground block">Meta CRM</span>
              <span className="text-xs text-muted-foreground font-medium">Workspace access</span>
            </div>
          </div>

          {/* Form Container */}
          <div className="my-auto max-w-sm w-full mx-auto">
            {!showSelector ? (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                    Sign in
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1.5 font-normal leading-relaxed">
                    Access leads, follow-ups, customers, and pipeline work for your workspace.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200/40 p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-semibold text-foreground block">
                      Email or Phone Number
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                      </span>
                      <Input
                        id="email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com or +1 555-0199"
                        className="bg-card border-border pl-9 h-10 rounded-md text-sm text-foreground"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-xs font-semibold text-foreground block">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-card border-border pl-9 pr-9 h-10 rounded-md text-sm text-foreground"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Workspace ID Option */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowTenantSlug(!showTenantSlug)}
                      className="text-xs font-semibold text-primary hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {showTenantSlug ? 'Use default workspace' : 'Log into specific workspace'}
                    </button>

                    {showTenantSlug && (
                      <div className="mt-2 space-y-1 transition-all">
                        <label htmlFor="tenantSlug" className="text-xs font-medium text-muted-foreground block">
                          Workspace slug
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5" />
                          </span>
                          <Input
                            id="tenantSlug"
                            type="text"
                            value={tenantSlug}
                            onChange={(e) => setTenantSlug(e.target.value)}
                            placeholder="acme-corp"
                            className="bg-card border-border pl-9 h-9 rounded-md text-sm text-foreground"
                            required={showTenantSlug}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 border-border rounded accent-primary cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="text-xs text-muted-foreground font-medium cursor-pointer select-none">
                      Remember my email
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full font-semibold rounded-md h-10 mt-2 flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-4">
                <div className="mb-6">
                  <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                    Select workspace
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1.5 font-normal leading-relaxed">
                    Choose which company workspace you would like to access.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200/40 p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.slug}
                      type="button"
                      onClick={() => handleSelectWorkspace(workspace.slug)}
                      disabled={isLoading}
                      className="w-full text-left p-3.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-all flex items-center justify-between group cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform flex-shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-foreground block leading-tight truncate">
                            {workspace.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium block truncate mt-0.5">
                            {workspace.slug}.crm.com
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSelector(false);
                      setError('');
                    }}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    ← Back to login
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clean Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-4">
            <span className="font-medium">Meta CRM</span>
            <span>Secure workspace session</span>
          </div>
        </div>

        {/* Right Column: Visual Showcase Panel */}
        <div className="hidden lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-6 bg-[#faf8f5]">
          <div className="relative z-10 flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#ff5600] flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Inbox & Operations Live Console</span>
          </div>

          <div className="relative z-10 my-auto max-w-md w-full mx-auto space-y-6">
            <div className="space-y-2 text-center lg:text-left mb-6">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground leading-tight">
                Designed to let your product be the protagonist.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                A clean, warm-cream ground and modest hairline frames. No SaaS noise, just editorial clarity.
              </p>
            </div>

            {/* Crisp Inbox Mockup Card */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#ebe7e1]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0bdf50]" />
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Customer Helpdesk Desk</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#ff5600]/10 border border-[#ff5600]/20 text-[9px] font-bold text-[#ff5600] uppercase tracking-wider">
                  Fin AI Agent Active
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#ebe7e1]/20 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#ff5600] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    KM
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground truncate">Karan Malhotra</p>
                      <span className="text-[9px] text-[#9c9fa5]">2m ago</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">Interested in unit A-402, auto-routed to Mumbai Desk.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#ebe7e1]/20 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#65b5ff] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    AS
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground truncate">Aarav Sharma</p>
                      <span className="text-[9px] text-[#9c9fa5]">18m ago</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">Token payment of ₹50,000 received via Razorpay.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Crisp Stats Mockup Card */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Campaign Outreach</span>
                <span className="text-xl font-bold text-foreground block mt-0.5">₹48.6 Lakhs</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[9px] text-[#0bdf50] font-semibold block">72% Completed</span>
                  <span className="text-[9px] text-muted-foreground block">Direct visits</span>
                </div>
                <div className="w-12 h-1.5 bg-[#ebe7e1] rounded-full overflow-hidden">
                  <div className="h-full bg-[#111111] rounded-full" style={{ width: '72%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Active Instance: ap-south-1</span>
            <span>Vault Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

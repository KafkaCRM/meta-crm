import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Eye, EyeOff, Lock, Mail, ArrowRight, Terminal, Database, Server, Activity, ShieldCheck } from 'lucide-react';

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
      setError('Access Denied. Invalid platform administrator credentials.');
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
      0%, 100% { opacity: 0.2; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.03); }
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
    <div className="flex min-h-screen w-full bg-[#f5f1ec] text-foreground select-none font-sans">
      <div className="grid w-full lg:grid-cols-12">
        {/* Left Column: Admin Login Form */}
        <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 bg-[#f5f1ec]">
          
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#ff5600] shadow-sm shadow-orange-500/10">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-foreground block">Admin Console</span>
              <span className="text-[10px] text-[#ff5600] font-semibold tracking-wide uppercase">Platform Operations</span>
            </div>
          </div>
 
          {/* Form Container (Enclosed in a beautiful white card with hairline border) */}
          <div className="my-auto max-w-sm w-full mx-auto bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Control Room
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5 font-normal leading-relaxed">
                Authorization required. Sign in using your platform administrator credentials to manage cluster tenants.
              </p>
            </div>
 
            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200/40 p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1 shrink-0" />
                <p>{error}</p>
              </div>
            )}
 
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="admin-email" className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                  Admin Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <Input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="bg-card border-border pl-9 placeholder:text-[#9c9fa5] focus-visible:ring-[#111111] focus-visible:border-[#111111] h-10 rounded-md text-sm text-foreground"
                    required
                  />
                </div>
              </div>
 
              <div className="space-y-1">
                <label htmlFor="admin-password" className="text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                  Secure Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-card border-border pl-9 pr-9 focus-visible:ring-[#111111] focus-visible:border-[#111111] h-10 rounded-md text-sm text-foreground"
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
 
              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  id="admin-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 border-border rounded accent-[#111111] cursor-pointer"
                />
                <label htmlFor="admin-remember-me" className="text-xs text-muted-foreground font-medium cursor-pointer select-none">
                  Remember my secure ID
                </label>
              </div>
 
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#111111] hover:bg-[#000000] text-white font-semibold rounded-md h-10 mt-2 hover:scale-[1.005] active:scale-[0.995] transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    Request Control Session
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </form>
          </div>
 
          {/* Secure Environment Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-[#ff5600]" />
              <span>Zero-Trust Node Active</span>
            </span>
            <span>RESTRICTED OPERATIONS</span>
          </div>
        </div>
 
        {/* Right Column: Platform Status / Command Board (Premium warm canvas with crisp mockup cards) */}
        <div className="hidden lg:col-span-7 lg:flex relative overflow-hidden bg-[#ebe7e1] flex-col justify-between p-12 border-l border-border select-none">
          {/* Top Telemetry */}
          <div className="relative z-10 flex items-center justify-between text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
            <span>Stable Cluster Telemetry</span>
            <span>RESTRICTED ACCESS ONLY</span>
          </div>
 
          {/* Cluster Telemetry Cards */}
          <div className="relative z-10 my-auto max-w-md w-full mx-auto space-y-6">
            <div className="space-y-2 text-center lg:text-left mb-6">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground leading-tight">
                Secure multi-tenant database routing.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                Provision, scale, and monitor active tenant workspaces in real-time from a single administrative hub.
              </p>
            </div>
 
            {/* Cluster Stats Card */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#ebe7e1]">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#ff5600]" />
                  <span className="text-[10px] font-bold text-foreground tracking-wider">SYSTEM INSTANCE: AP-SOUTH-1A</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0bdf50]/10 border border-[#0bdf50]/20 text-[9px] font-bold text-[#0bdf50] uppercase tracking-wider">
                  ONLINE
                </div>
              </div>
              
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Database Connections</span>
                    <span className="text-foreground font-semibold">142 active</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#ebe7e1] rounded-full overflow-hidden">
                    <div className="h-full bg-[#111111] rounded-full" style={{ width: '64%' }} />
                  </div>
                </div>
 
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Platform CPU Load</span>
                    <span className="text-foreground font-semibold">18.4%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#ebe7e1] rounded-full overflow-hidden">
                    <div className="h-full bg-[#111111] rounded-full" style={{ width: '18.4%' }} />
                  </div>
                </div>
              </div>
            </div>
 
            {/* Active Tenants List Mockup Card */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block border-b border-[#ebe7e1] pb-2">Active Workspaces Registry</span>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Acme Group</span>
                  <span className="text-[10px] text-[#ff5600] font-medium bg-[#ff5600]/10 px-2 py-0.5 rounded border border-[#ff5600]/15">Enterprise Plan</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Star Health Ltd.</span>
                  <span className="text-[10px] text-[#65b5ff] font-medium bg-[#65b5ff]/10 px-2 py-0.5 rounded border border-[#65b5ff]/15">Growth Plan</span>
                </div>
              </div>
            </div>
          </div>
 
          {/* Telemetry bottom */}
          <div className="relative z-10 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>PLATFORM: METACRM-CORE</span>
            <span>ENCRYPTED SECURITY LAYER</span>
          </div>
        </div>
      </div>
    </div>
  );
}

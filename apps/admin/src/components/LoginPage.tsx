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
    <div className="flex min-h-screen w-full bg-white select-none">
      <style dangerouslySetInnerHTML={{ __html: loginStyles }} />
      
      <div className="grid w-full lg:grid-cols-12">
        {/* Left Column: Admin Login Form */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 md:p-14 bg-slate-50/50">
          
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 shadow-md shadow-slate-950/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight block">Admin Console</span>
              <span className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase">Platform Operations</span>
            </div>
          </div>

          {/* Form Container */}
          <div className="my-auto max-w-sm w-full mx-auto py-10">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
                Control Room
              </h1>
              <p className="text-sm text-slate-500 mt-2 font-medium">
                Authorization required. Sign in using your platform administrator credentials.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-rose-50/70 border border-rose-200/50 p-4 text-xs text-rose-700 font-medium flex items-start gap-2.5 animate-fadeIn">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Admin Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <Input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="bg-white border-slate-200 pl-10 placeholder:text-slate-400 focus-visible:ring-slate-900 focus-visible:border-slate-900 h-11 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Secure Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-white border-slate-200 pl-10 pr-10 focus-visible:ring-slate-900 focus-visible:border-slate-900 h-11 rounded-lg"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="admin-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900 cursor-pointer"
                />
                <label htmlFor="admin-remember-me" className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                  Remember my secure ID
                </label>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-black text-white font-semibold rounded-lg h-11 mt-3 shadow-md shadow-slate-900/10 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Authenticating Node...
                  </>
                ) : (
                  <>
                    Request Control Session
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Secure Environment Footer */}
          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-200/60 pt-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Zero-Trust Node active</span>
            </span>
            <span>RESTRICTED ACCESS</span>
          </div>
        </div>

        {/* Right Column: Platform Status / Command Board */}
        <div className="hidden lg:col-span-7 lg:flex relative overflow-hidden bg-[#030712] flex-col justify-between p-12 text-white border-l border-slate-900 select-none">
          {/* Grid lines and background matrix */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(17,24,39,0.9)_0%,rgba(3,7,18,1)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(79,70,229,0.12)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px]" />
          
          {/* Ambient Glows */}
          <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] bg-indigo-900/10 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-1/3 -left-20 w-[350px] h-[350px] bg-slate-800/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2.5s' }} />

          {/* Top telemetry */}
          <div className="relative z-10 flex items-center justify-between text-xs font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              <span>STABLE CLUSTER CONTROL</span>
            </div>
            <span>PORT 443 // SECURITY PROTOCOLS ENFORCED</span>
          </div>

          {/* Cluster Telemetry Cards */}
          <div className="relative z-10 my-auto flex flex-col gap-6 max-w-md mx-auto w-full font-mono">
            
            {/* Cluster Stats Card */}
            <div className="bg-slate-950/65 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl animate-float-1">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-bold text-slate-200 tracking-wider">SYSTEM INSTANCE: AP-SOUTH-1A</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-400">
                  ONLINE
                </div>
              </div>
              
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Database Engine Connections</span>
                    <span className="text-slate-200">142 active</span>
                  </div>
                  <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '64%' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Platform CPU Utilization</span>
                    <span className="text-slate-200">18.4%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '18.4%' }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-900/60 mt-1">
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-slate-500" />
                    <span>Neon Hyperdrive Mode</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">Ready</span>
                </div>
              </div>
            </div>

            {/* Operations Log Card */}
            <div className="bg-slate-950/65 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl animate-float-2">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-bold text-slate-200 tracking-wider">PLATFORM CONSOLE LOGS</span>
                </div>
                <Activity className="w-3.5 h-3.5 text-slate-500 animate-pulse" />
              </div>

              <div className="space-y-2 text-[10px] font-mono leading-relaxed text-slate-400">
                <div className="flex items-start gap-1">
                  <span className="text-indigo-400 shrink-0">[11:35:12]</span>
                  <span>[SEC] Vault successfully integrity-checked (256-bit AES verified).</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-indigo-400 shrink-0">[11:35:18]</span>
                  <span>[API] Tenant "Acme Group" initialized routing endpoints successfully.</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-indigo-400 shrink-0">[11:35:25]</span>
                  <span>[SYS] System check complete. Core health status 100% operational.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry bottom */}
          <div className="relative z-10 flex items-center justify-between text-xs font-mono text-slate-500">
            <span>PLATFORM: METACRM-CORE</span>
            <span>SHIELD LEVEL 3 // ENCRYPTED SHA-256</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Shield } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted animate-in fade-in duration-200">
      <div className="w-full max-w-sm text-center p-6 bg-card border border-border rounded-2xl shadow-sm">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-rose-500/10 items-center justify-center mb-4 border border-rose-500/20 animate-bounce duration-1000">
          <Shield size={22} className="text-rose-600" />
        </div>
        <h1 className="text-xl font-bold text-foreground tracking-tight mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
          You don't have platform access. Contact your administrator to request access.
        </p>
        <div className="mt-6">
          <a
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 bg-fin-orange hover:bg-fin-orange/90 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm shadow-indigo-100"
          >
            Go to login
          </a>
        </div>
      </div>
    </div>
  );
}

import { Shield } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 animate-in fade-in duration-200">
      <div className="w-full max-w-sm text-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-rose-500/10 items-center justify-center mb-4 border border-rose-500/20 animate-bounce duration-1000">
          <Shield size={22} className="text-rose-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
          You don't have platform access. Contact your administrator to request access.
        </p>
        <div className="mt-6">
          <a
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm shadow-indigo-100"
          >
            Go to login
          </a>
        </div>
      </div>
    </div>
  );
}

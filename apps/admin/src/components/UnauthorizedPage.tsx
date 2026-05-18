import { Shield } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1ec]">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-[#c41c1c]/10 items-center justify-center mb-4">
          <Shield size={22} className="text-[#c41c1c]" />
        </div>
        <h1 className="text-2xl font-medium text-[#111111] tracking-tight mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-[#9c9fa5] max-w-xs mx-auto">
          You don't have platform access. Contact your administrator to request access.
        </p>
        <div className="mt-6">
          <a
            href="/login"
            className="inline-flex items-center px-4 py-2 bg-[#111111] text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
          >
            Go to login
          </a>
        </div>
      </div>
    </div>
  );
}

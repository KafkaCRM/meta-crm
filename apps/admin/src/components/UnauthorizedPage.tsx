import { Shield } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-red-200 bg-red-50">
          <Shield size={18} className="text-red-700" />
        </div>
        <h1 className="text-xl font-semibold tracking-normal text-foreground">
          Access denied
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your account does not have platform admin access. Contact a platform owner to update your role.
        </p>
        <a
          href="/login"
          className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}

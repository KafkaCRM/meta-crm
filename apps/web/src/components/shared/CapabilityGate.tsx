import { useCapabilities } from '@/hooks/useCapabilities';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CapabilityGateProps {
  /** The capability ID that must be enabled, e.g. 'capability/property-listing' */
  capabilityId: string;
  /** Human-readable name shown in the locked state UI */
  capabilityName: string;
  /** Short description of what this capability unlocks */
  description?: string;
  /** The protected page content */
  children: React.ReactNode;
}

/**
 * CapabilityGate wraps a page that requires a specific tenant capability.
 *
 * Behaviour:
 *   - While capabilities are loading: shows a subtle spinner.
 *   - If the capability is enabled: renders children normally.
 *   - If the capability is NOT enabled: renders a locked-state banner
 *     with a link to /settings/capabilities instead of the actual page.
 *
 * This is the frontend enforcement of what CapabilityGuard does on the backend.
 */
export function CapabilityGate({
  capabilityId,
  capabilityName,
  description,
  children,
}: CapabilityGateProps) {
  const { isEnabled, isLoading } = useCapabilities();
  const navigate = useNavigate();

  const enabled = isEnabled(capabilityId);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Loading workspace settings…
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          {/* Lock Icon */}
          <div className="inline-flex w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 items-center justify-center mb-5">
            <Lock size={24} className="text-slate-400" />
          </div>

          {/* Headline */}
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {capabilityName} is not enabled
          </h2>

          {/* Description */}
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            {description ||
              `Your workspace has not enabled the ${capabilityName} module. Ask your administrator to enable it from the Capabilities settings.`}
          </p>

          {/* CTA */}
          <Button
            variant="default"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => navigate({ to: '/settings/capabilities' })}
          >
            Go to Capabilities Settings
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

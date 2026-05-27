import React from 'react';

interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageShell({
  title,
  description,
  actions,
  children,
  className = '',
}: PageShellProps) {
  return (
    <div className={`space-y-6 max-w-[1280px] mx-auto ${className}`}>
      {/* Header section */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight text-slate-900 leading-none">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-400 mt-0.5 leading-normal font-medium">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Main page body */}
      <div className="space-y-5">
        {children}
      </div>
    </div>
  );
}

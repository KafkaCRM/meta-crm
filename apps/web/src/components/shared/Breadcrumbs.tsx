import { Link, useMatches } from '@tanstack/react-router';
import { Home, ChevronRight } from 'lucide-react';

export function Breadcrumbs() {
  const matches = useMatches();

  // Parse path segments to generate friendly labels
  const breadcrumbItems = matches
    .map((match) => {
      const path = match.pathname;
      if (path === '/') {
        return { label: 'Dashboard', to: '/' };
      }
      
      const segments = path.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1] || '';
      
      // Dynamic route parameter check (e.g. ID matches like $id)
      const isParam = lastSegment.startsWith('$') || (match.params && Object.values(match.params).includes(lastSegment));
      
      let label = lastSegment;
      if (isParam) {
        label = 'Record Details';
      } else {
        // Format names: slug to capitalized label
        label = label
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());
      }

      return { label, to: path };
    })
    .filter((item, idx, self) => self.findIndex(t => t.to === item.to) === idx); // De-duplicate

  return (
    <nav className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 select-none">
      <Link 
        to="/" 
        className="flex items-center gap-1 hover:text-slate-700 transition-colors text-slate-400"
      >
        <Home size={12} strokeWidth={2.2} className="text-slate-400" />
      </Link>
      
      {breadcrumbItems.map((item, idx) => {
        if (item.to === '/') return null;
        
        return (
          <div key={item.to} className="flex items-center gap-1">
            <ChevronRight size={11} className="text-slate-300 stroke-[2.5]" />
            <Link 
              to={item.to}
              activeOptions={{ exact: true }}
              className="hover:text-slate-700 transition-colors font-medium capitalize max-w-[140px] truncate"
              activeProps={{ className: 'text-indigo-600 font-bold' }}
            >
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

import { Link, useMatches } from '@tanstack/react-router';
import { Home, ChevronRight } from 'lucide-react';
import { useLabels } from '@/hooks/useLabels';

export function Breadcrumbs() {
  const matches = useMatches();
  const { t } = useLabels();

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
        if (label === 'parties') {
          label = t('party.plural');
        } else if (label === 'cases') {
          label = t('case.plural');
        } else {
          // Format names: slug to capitalized label
          label = label
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
        }
      }

      return { label, to: path };
    })
    .filter((item, idx, self) => self.findIndex(t => t.to === item.to) === idx); // De-duplicate

  return (
    <nav className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground select-none">
      <Link 
        to="/" 
        className="flex items-center gap-1 hover:text-foreground/80 transition-colors text-muted-foreground"
      >
        <Home size={12} strokeWidth={2.2} className="text-muted-foreground" />
      </Link>
      
      {breadcrumbItems.map((item, idx) => {
        if (item.to === '/') return null;
        
        return (
          <div key={item.to} className="flex items-center gap-1">
            <ChevronRight size={11} className="text-muted-foreground/70 stroke-[2.5]" />
            <Link 
              to={item.to}
              activeOptions={{ exact: true }}
              className="hover:text-foreground/80 transition-colors font-medium capitalize max-w-[140px] truncate"
              activeProps={{ className: 'text-fin-orange font-bold' }}
            >
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

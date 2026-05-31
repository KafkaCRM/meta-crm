import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPlugins } from '@/api/platform';
import { useNavigate } from '@tanstack/react-router';
import { Search, Puzzle, ExternalLink, Calendar, Grid3X3, Zap, ShieldCheck, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Categories mapping to visual styling
const CATEGORY_COLORS: Record<string, string> = {
  Communication: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Integrations: 'bg-amber-50 text-amber-700 border-amber-100',
  Analytics: 'bg-fin-orange/10 text-fin-orange border-fin-orange/20',
  Productivity: 'bg-purple-50 text-purple-700 border-purple-100',
  Healthcare: 'bg-rose-50 text-rose-700 border-rose-100',
  Retail: 'bg-sky-50 text-sky-700 border-sky-100',
  Finance: 'bg-blue-50 text-blue-700 border-blue-100',
};

const CATEGORY_ICONS: Record<string, string> = {
  Communication: '📧',
  Integrations: '⚡',
  Analytics: '📊',
  Productivity: '📚',
  Healthcare: '🏥',
  Retail: '🛍️',
  Finance: '🧾',
};

export function PluginRegistry() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const { data: plugins, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: listPlugins,
  });

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
        <div className="w-5 h-5 border-2 border-border border-t-indigo-600 rounded-full animate-spin" />
        Initializing platform plugin registry...
      </div>
    );
  }

  if (!plugins || plugins.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Puzzle size={36} className="mx-auto mb-3 text-muted-foreground/70 animate-bounce" />
        <p className="text-base font-semibold text-foreground">No plugins registered in this environment</p>
        <p className="mt-1 text-sm text-muted-foreground">Deploy first-party packages to seed the extension registry.</p>
      </div>
    );
  }

  // Extract all categories
  const categories = ['All', ...Array.from(new Set(plugins.map(p => p.manifest?.category ?? 'Utility')))];

  const filteredPlugins = plugins.filter((p) => {
    const matchesSearch =
      p.package_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.manifest?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.manifest?.description ?? '').toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory =
      activeCategory === 'All' ||
      p.manifest?.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-200 bg-card">
      {/* Category selector & Search bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5 order-2 md:order-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                activeCategory === cat
                  ? 'bg-fin-orange border-indigo-600 text-white shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80 order-1 md:order-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search plugins & manifests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-muted-foreground text-foreground"
          />
        </div>
      </div>

      {/* Grid of Plugin Cards */}
      {filteredPlugins.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No matching plugins found in the platform catalogue.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlugins.map((plugin) => {
            const cat = plugin.manifest?.category ?? 'Utility';
            const badgeColor = CATEGORY_COLORS[cat] ?? 'bg-muted text-foreground/80 border-border';
            const catIcon = CATEGORY_ICONS[cat] ?? '⚙️';
            const isUniversal = plugin.manifest?.compatible_industries?.includes('*') ?? false;

            return (
              <Card
                key={plugin.id}
                onClick={() => navigate({ to: `/admin/plugins/${plugin.id}` })}
                className="group cursor-pointer bg-card border-border rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                  <div className="space-y-3">
                    {/* Header: custom icon and status badge */}
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-lg bg-muted border border-border/50 flex items-center justify-center text-xl flex-shrink-0 group-hover:bg-fin-orange/10 group-hover:border-fin-orange/20 transition-colors">
                        {catIcon}
                      </div>
                      
                      <div className="flex gap-1.5">
                        {isUniversal && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100/50 hover:bg-emerald-50 text-[9px] px-1.5 py-0 rounded font-semibold shadow-none">
                            Universal
                          </Badge>
                        )}
                        <Badge className={`text-[9px] px-1.5 py-0 rounded font-semibold border shadow-none ${
                          plugin.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : plugin.status === 'deprecated'
                              ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                              : 'bg-slate-100 text-muted-foreground border-border'
                        }`}>
                          {plugin.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1">
                      <h3 className="font-bold text-foreground group-hover:text-fin-orange transition-colors text-sm line-clamp-1">
                        {plugin.manifest?.name ?? plugin.package_name.replace('@meta-crm/plugin-', '')}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono line-clamp-1">{plugin.package_name}</p>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {plugin.manifest?.description ?? 'No description provided.'}
                    </p>
                  </div>

                  {/* Footer metadata grid */}
                  <div className="border-t border-border/50 pt-3.5 mt-auto flex items-center justify-between text-[10px] font-semibold font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Database size={11} className="text-muted-foreground/70" />
                      v{plugin.version}
                    </span>
                    
                    <span className="flex items-center gap-1 bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded-md font-bold font-sans">
                      {plugin.tenant_count ?? 0} Tenants
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { createRoute, Link } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { GenericListView } from '@/components/shared/GenericListView';
import { useQuery } from '@tanstack/react-query';
import { objectsApi } from '@/api/objects';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Plus, ArrowRight, Database, Sparkles, RefreshCw } from 'lucide-react';

export const customObjectsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/objects',
  component: CustomObjectsIndexPage,
});

export const customObjectRecordsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/objects/$objectKey',
  component: CustomObjectRecordsPage,
});

function CustomObjectRecordsPage() {
  const { objectKey } = customObjectRecordsRoute.useParams();
  return <GenericListView objectKey={objectKey} />;
}

function CustomObjectsIndexPage() {
  const { data: objects = [], isLoading, refetch } = useQuery({
    queryKey: ['custom-objects'],
    queryFn: () => objectsApi.list(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Custom Capability Objects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and manage schema-driven dynamic data collections and industry entities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button asChild size="sm" className="gap-1.5 text-xs font-semibold shadow-sm">
            <Link to="/settings/objects">
              <Plus className="h-3.5 w-3.5" />
              Manage Schemas
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Loading custom objects…
          </div>
        </div>
      ) : objects.length === 0 ? (
        <Card className="border-dashed border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No Custom Objects Active</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Create modular entities for any vertical (Healthcare, Legal, Real Estate, Manufacturing) or install an industry capability package.
            </p>
            <Button asChild size="sm" className="mt-4 gap-1.5 text-xs">
              <Link to="/settings/objects">
                <Plus className="h-3.5 w-3.5" />
                Define First Object
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {objects.map((obj) => (
            <Card key={obj.id} className="border-border bg-card hover:border-primary/40 transition-all shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-foreground">{obj.plural_label}</CardTitle>
                      <Badge variant="outline" className="text-[10px] font-mono mt-0.5 font-normal text-muted-foreground">
                        {obj.key}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-medium">
                    {obj.domain}
                  </Badge>
                </div>
                {obj.description && (
                  <CardDescription className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {obj.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-between border-t border-border/50 mt-2 py-3 bg-muted/20">
                <span className="text-xs text-muted-foreground font-medium">
                  {obj.record_count ?? 0} {obj.record_count === 1 ? 'record' : 'records'}
                </span>
                <Button asChild size="xs" variant="ghost" className="gap-1 text-primary hover:text-primary font-semibold">
                  <Link to="/objects/$objectKey" params={{ objectKey: obj.key }}>
                    Open Table
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

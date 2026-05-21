import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { capabilitiesApi } from '@/api/capabilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Home, ArrowUpRight, BedDouble, Bath } from 'lucide-react';

interface PropertiesWidgetProps {
  className?: string;
}

export function PropertiesWidget({ className }: PropertiesWidgetProps) {
  const navigate = useNavigate();

  const { data: properties = [], isLoading, error } = useQuery({
    queryKey: ['properties', 'list'],
    queryFn: () => capabilitiesApi.properties.list(),
    staleTime: 30_000,
  });

  const available = properties.filter(p => p.status === 'available').length;
  const pending = properties.filter(p => p.status === 'pending').length;
  const sold = properties.filter(p => p.status === 'sold').length;

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">Property Listings</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-4 w-28 bg-[#ebe7e1]" />
          <Skeleton className="h-12 w-full bg-[#ebe7e1]" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">Property Listings</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-4">
          <p className="text-xs text-[#c41c1c]">Failed to load property listings.</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#111111]">Property Listings</CardTitle>
        <Home size={16} className="text-[#9c9fa5]" />
      </CardHeader>
      <Separator className="bg-[#ebe7e1]" />
      <CardContent className="pt-4 space-y-3">
        {/* Status summary grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#f5f1ec] rounded-lg p-2 border border-[#ebe7e1]">
            <p className="text-[10px] text-[#9c9fa5] font-semibold uppercase">Available</p>
            <p className="text-lg font-bold text-[#111111] mt-0.5">{available}</p>
          </div>
          <div className="bg-[#f5f1ec] rounded-lg p-2 border border-[#ebe7e1]">
            <p className="text-[10px] text-[#9c9fa5] font-semibold uppercase">Pending</p>
            <p className="text-lg font-bold text-[#d97706] mt-0.5">{pending}</p>
          </div>
          <div className="bg-[#f5f1ec] rounded-lg p-2 border border-[#ebe7e1]">
            <p className="text-[10px] text-[#9c9fa5] font-semibold uppercase">Sold</p>
            <p className="text-lg font-bold text-[#0a7f2e] mt-0.5">{sold}</p>
          </div>
        </div>

        {/* Recent listings */}
        {properties.length > 0 && (
          <div className="space-y-2">
            <p className="text-2xs font-semibold text-[#9c9fa5] uppercase tracking-wider">Recent Listings</p>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
              {properties.slice(0, 2).map(prop => (
                <div
                  key={prop.id}
                  className="flex items-center justify-between rounded-lg border border-[#ebe7e1] p-2 hover:bg-[#f5f1ec] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#111111] truncate">{prop.title}</p>
                    <p className="text-2xs text-[#9c9fa5] truncate">{prop.address}, {prop.city}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[#626260]">
                      <span className="flex items-center gap-0.5">
                        <BedDouble size={10} />
                        {prop.bedrooms} Bed
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Bath size={10} />
                        {prop.bathrooms} Bath
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <p className="text-xs font-bold text-[#111111]">{formatCurrency(prop.price)}</p>
                    <span className={`inline-flex items-center px-1 py-0.5 rounded text-[8px] font-semibold uppercase border mt-0.5 ${
                      prop.status === 'available'
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : prop.status === 'pending'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                        : 'bg-green-50 text-green-700 border-green-100'
                    }`}>
                      {prop.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-[#ebe7e1]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/properties' })}
            className="w-full h-7 text-xs text-[#626260] hover:text-[#111111]"
          >
            Manage Listings
            <ArrowUpRight size={12} className="ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { capabilitiesApi } from '@/api/capabilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface AppointmentsWidgetProps {
  className?: string;
}

export function AppointmentsWidget({ className }: AppointmentsWidgetProps) {
  const navigate = useNavigate();

  // Get start and end of today
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const { data: appointments = [], isLoading, error } = useQuery({
    queryKey: ['appointments', 'today', start, end],
    queryFn: () => capabilitiesApi.appointments.list({ start, end }),
    staleTime: 30_000,
  });

  const scheduledAppointments = appointments.filter(a => a.status === 'scheduled');

  if (isLoading) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">Today's Appointments</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-28 bg-[#ebe7e1]" />
              <Skeleton className="h-4 w-16 bg-[#ebe7e1] ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none ${className ?? ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#111111]">Today's Appointments</CardTitle>
        </CardHeader>
        <Separator className="bg-[#ebe7e1]" />
        <CardContent className="pt-4">
          <p className="text-xs text-[#c41c1c]">Failed to load today's appointments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white border-[#d3cec6] rounded-xl shadow-none hover:shadow-md transition-shadow ${className ?? ''}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#111111]">Today's Appointments</CardTitle>
        {scheduledAppointments.length > 0 && (
          <Badge className="bg-[#3b82f6]/10 text-[#2563eb] border-0 text-xs rounded-md">
            {scheduledAppointments.length} pending
          </Badge>
        )}
      </CardHeader>
      <Separator className="bg-[#ebe7e1]" />
      <CardContent className="pt-4">
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-[#f5f1ec] flex items-center justify-center mb-3">
              <Calendar size={18} className="text-[#9c9fa5]" />
            </div>
            <p className="text-sm font-medium text-[#111111]">No appointments today</p>
            <p className="text-xs text-[#9c9fa5] mt-1">Schedule patient bookings in Appointments.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {appointments.map((appt) => {
              const timeString = new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={appt.id}
                  className="flex items-center justify-between rounded-lg border border-[#ebe7e1] p-3 hover:bg-[#f5f1ec] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#111111] truncate">{appt.title}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize ${
                        appt.status === 'scheduled'
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : appt.status === 'completed'
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-red-50 text-red-700 border-red-100'
                      }`}>
                        {appt.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#9c9fa5] mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {timeString}
                      </span>
                      {appt.party && (
                        <span className="flex items-center gap-1 truncate">
                          <User size={11} />
                          {appt.party.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate({ to: '/appointments' })}
                    className="h-7 w-7 p-0 ml-2"
                  >
                    <ArrowUpRight size={14} className="text-[#9c9fa5] hover:text-[#111111]" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[#ebe7e1]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/appointments' })}
            className="w-full h-7 text-xs text-[#626260] hover:text-[#111111]"
          >
            Go to Appointments calendar
            <ArrowUpRight size={12} className="ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

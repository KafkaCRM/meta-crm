import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { capabilitiesApi, type Appointment, type AvailableSlot } from '@/api/capabilities';
import { partiesApi } from '@/api/parties';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Clock, User, UserCheck, Plus, CheckCircle, XCircle } from 'lucide-react';
import dayjs from 'dayjs';

export function Appointments() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [room, setRoom] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Filters
  const [filterDoctorId, setFilterDoctorId] = useState('');
  const [filterContactId, setFilterContactId] = useState('');

  // Fetch appointments
  const { data: appointments = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ['appointments', filterDoctorId, filterContactId],
    queryFn: () =>
      capabilitiesApi.appointments.list({
        user_id: filterDoctorId || undefined,
        party_id: filterContactId || undefined,
      }),
  });

  // Fetch contacts for select dropdown
  const { data: contactsData } = useQuery({
    queryKey: ['parties', 'all'],
    queryFn: () => partiesApi.list({ limit: 100 }),
  });
  const contacts = contactsData?.data ?? [];

  // Fetch staff/doctors for select dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['settings', 'users'],
    queryFn: () => settingsApi.users.list(),
  });

  // Fetch available slots when booking dialog inputs change
  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['appointments', 'slots', selectedDate, selectedDoctorId],
    queryFn: () => capabilitiesApi.appointments.getSlots(selectedDate, selectedDoctorId || undefined),
    enabled: isDialogOpen && !!selectedDate,
  });

  // Book appointment mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      party_id: string;
      user_id?: string;
      title: string;
      description?: string;
      start_time: string;
      end_time: string;
      room?: string;
    }) => capabilitiesApi.appointments.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment booked successfully!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to book appointment');
    },
  });

  // Cancel/Update status mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      capabilitiesApi.appointments.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment status updated');
    },
    onError: () => {
      toast.error('Failed to update appointment');
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setRoom('');
    setSelectedContactId('');
    setSelectedDoctorId('');
    setSelectedSlot(null);
    setSelectedDate(dayjs().format('YYYY-MM-DD'));
  };

  const handleBook = () => {
    if (!selectedContactId || !title || !selectedSlot) {
      toast.error('Please fill in all required fields and select a slot');
      return;
    }

    createMutation.mutate({
      party_id: selectedContactId,
      user_id: selectedDoctorId || undefined,
      title,
      description,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      room,
    });
  };

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Appointments & Scheduling</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Manage patient bookings, calendars, and availability</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#111111] hover:bg-black text-white rounded-lg text-sm font-medium h-9 px-4">
              <Plus size={16} className="mr-1.5" />
              Book Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white border border-[#d3cec6] rounded-xl shadow-lg p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#111111]">Book a Slot</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="title" className="text-xs font-semibold text-[#626260]">Appointment Title *</Label>
                <Input
                  id="title"
                  placeholder="E.g., Initial Dental Checkup"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="contact" className="text-xs font-semibold text-[#626260]">Patient/Contact *</Label>
                <select
                  id="contact"
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                >
                  <option value="">Select Contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="doctor" className="text-xs font-semibold text-[#626260]">Assigned Doctor / Practitioner</Label>
                <select
                  id="doctor"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                >
                  <option value="">Select Practitioner (Optional)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="date" className="text-xs font-semibold text-[#626260]">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="room" className="text-xs font-semibold text-[#626260]">Room / Cabin</Label>
                  <Input
                    id="room"
                    placeholder="E.g., Room 101"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description" className="text-xs font-semibold text-[#626260]">Notes</Label>
                <Input
                  id="description"
                  placeholder="Any specific instructions"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]"
                />
              </div>

              {/* Slot Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#626260]">Available Slots</Label>
                {loadingSlots ? (
                  <div className="text-xs text-[#9c9fa5]">Checking availability...</div>
                ) : slots.length === 0 ? (
                  <div className="text-xs text-red-600">No work hours or slots defined for this day.</div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-1 bg-[#f5f1ec] rounded-lg border border-[#ebe7e1]">
                    {slots.map((slot, idx) => (
                      <button
                        key={idx}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className={`text-xs p-1.5 rounded-md border text-center font-medium transition-all ${
                          !slot.available
                            ? 'bg-red-50 text-red-400 border-red-100 cursor-not-allowed opacity-50'
                            : selectedSlot?.start_time === slot.start_time
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : 'bg-white text-[#111111] border-[#d3cec6] hover:bg-[#f5f1ec]'
                        }`}
                      >
                        {dayjs(slot.start_time).format('hh:mm A')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-[#d3cec6] text-[#626260] hover:bg-[#f5f1ec]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBook}
                disabled={createMutation.isPending}
                className="bg-[#111111] hover:bg-black text-white"
              >
                {createMutation.isPending ? 'Booking...' : 'Book'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters & Content */}
      <div className="grid gap-6 md:grid-cols-4 items-start">
        {/* Sidebar Filters */}
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#9c9fa5]">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="filter-practitioner" className="text-xs text-[#626260]">Practitioner</Label>
              <select
                id="filter-practitioner"
                value={filterDoctorId}
                onChange={(e) => setFilterDoctorId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111]"
              >
                <option value="">All Practitioners</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-contact" className="text-xs text-[#626260]">Patient/Contact</Label>
              <select
                id="filter-contact"
                value={filterContactId}
                onChange={(e) => setFilterContactId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111]"
              >
                <option value="">All Patients</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFilterDoctorId(''); setFilterContactId(''); }}
              className="w-full text-xs border-[#d3cec6] text-[#626260]"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>

        {/* Main List */}
        <div className="md:col-span-3 space-y-4">
          {loadingAppointments ? (
            <div className="text-center py-12 text-[#9c9fa5]">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none py-12 text-center">
              <CalendarIcon className="mx-auto h-8 w-8 text-[#9c9fa5] mb-2" />
              <p className="text-sm font-medium text-[#111111]">No appointments scheduled</p>
              <p className="text-xs text-[#9c9fa5] mt-1">Book an appointment slot to get started.</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {appointments.map((appt: Appointment) => (
                <Card key={appt.id} className="bg-white border-[#d3cec6] rounded-xl shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[#f5f1ec] text-[#111111] mt-0.5">
                        <CalendarIcon size={18} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-[#111111]">{appt.title}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold uppercase ${
                            appt.status === 'scheduled'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : appt.status === 'completed'
                              ? 'bg-green-50 text-green-700 border border-green-100'
                              : 'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {appt.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[#626260] flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {dayjs(appt.start_time).format('DD MMM YYYY, hh:mm A')} - {dayjs(appt.end_time).format('hh:mm A')}
                          </span>
                          {appt.room && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#9c9fa5]" />
                              {appt.room}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 pt-1 text-xs text-[#111111] flex-wrap">
                          <span className="flex items-center gap-1">
                            <User size={12} className="text-[#9c9fa5]" />
                            Patient: <span className="font-medium">{appt.party?.name}</span>
                          </span>
                          {appt.user && (
                            <span className="flex items-center gap-1">
                              <UserCheck size={12} className="text-[#9c9fa5]" />
                              Doctor: <span className="font-medium">{appt.user.name}</span>
                            </span>
                          )}
                        </div>

                        {appt.description && (
                          <p className="text-xs text-[#9c9fa5] italic pt-1">Notes: "{appt.description}"</p>
                        )}
                      </div>
                    </div>

                    {appt.status === 'scheduled' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateMutation.mutate({ id: appt.id, status: 'completed' })}
                          className="h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle size={14} className="mr-1" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateMutation.mutate({ id: appt.id, status: 'cancelled' })}
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <XCircle size={14} className="mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

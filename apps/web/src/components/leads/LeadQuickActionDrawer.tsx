import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, type LeadResponse } from '@/api/leads';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Phone,
  PhoneCall,
  MessageSquare,
  Clock,
  CheckCircle2,
  Calendar,
  Send,
  Loader2,
  Sparkles,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

interface LeadQuickActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadResponse | null;
  initialMode?: 'call' | 'whatsapp' | 'note';
  onSuccess?: () => void;
}

const CALL_OUTCOMES = [
  { id: 'connected_interested', label: 'Connected - Interested', status: 'qualified', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'callback_scheduled', label: 'Callback Scheduled', status: 'contacted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'busy_no_answer', label: 'Ringing / No Answer', status: 'contacted', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'voicemail', label: 'Left Voicemail', status: 'contacted', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { id: 'wrong_number', label: 'Wrong Number / Junk', status: 'junk', color: 'bg-red-50 text-red-700 border-red-200' },
];

export function LeadQuickActionDrawer({
  open,
  onOpenChange,
  lead,
  initialMode = 'call',
  onSuccess,
}: LeadQuickActionDrawerProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'call' | 'whatsapp' | 'note'>(initialMode);

  React.useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  // Call state
  const [selectedOutcome, setSelectedOutcome] = useState(CALL_OUTCOMES[0]!.id);
  const [callNotes, setCallNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // WhatsApp state
  const [whatsappTemplate, setWhatsappTemplate] = useState('intro');
  const [customMessage, setCustomMessage] = useState('');

  // Update custom message when template or lead changes
  React.useEffect(() => {
    if (!lead) return;
    const firstName = lead.name.split(' ')[0] || lead.name;

    if (whatsappTemplate === 'intro') {
      setCustomMessage(
        `Hi ${firstName}, thank you for your interest with Meta CRM! Here are the program details you requested. Please let me know if you have any questions or would like to schedule a quick consultation.`
      );
    } else if (whatsappTemplate === 'admission') {
      setCustomMessage(
        `Hi ${firstName}, we noticed your inquiry for the upcoming batch. We have a seat reserved for you! Would you like to review the course structure or discuss fee payment plans?`
      );
    } else if (whatsappTemplate === 'callback') {
      setCustomMessage(
        `Hi ${firstName}, I just tried reaching you by phone. Please let me know what time works best today for a quick 2-minute chat!`
      );
    }
  }, [whatsappTemplate, lead]);

  const logInteractionMutation = useMutation({
    mutationFn: (data: {
      type: 'call' | 'whatsapp' | 'note';
      outcome?: string;
      notes?: string;
      status?: string;
      next_follow_up?: string;
    }) => {
      if (!lead) throw new Error('No lead selected');
      return leadsApi.logInteraction(lead.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (lead?.id) {
        queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
      }
      toast.success(
        mode === 'call' ? 'Call logged successfully' : mode === 'whatsapp' ? 'WhatsApp action recorded' : 'Note saved'
      );
      onSuccess?.();
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Failed to log interaction');
    },
  });

  if (!lead) return null;

  const handleLaunchCall = () => {
    window.location.href = `tel:${lead.phone}`;
  };

  const handleSaveCall = () => {
    const outcomeObj = CALL_OUTCOMES.find((o) => o.id === selectedOutcome);
    logInteractionMutation.mutate({
      type: 'call',
      outcome: outcomeObj?.label || selectedOutcome,
      notes: callNotes,
      status: outcomeObj?.status,
      next_follow_up: followUpDate || undefined,
    });
  };

  const handleSendWhatsApp = () => {
    let cleaned = lead.phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = `91${cleaned}`;
    const encoded = encodeURIComponent(customMessage);
    window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encoded}`, '_blank');

    logInteractionMutation.mutate({
      type: 'whatsapp',
      outcome: `Template: ${whatsappTemplate}`,
      notes: customMessage,
      status: 'contacted',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-2xl border-border bg-card">
        {/* Lead Summary Bar */}
        <div className="p-5 border-b border-border bg-muted/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">{lead.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs font-mono font-semibold text-muted-foreground select-all">{lead.phone}</span>
                <span className="text-muted-foreground/50">•</span>
                <Badge variant="outline" className="text-[10px] capitalize font-medium">
                  {lead.status}
                </Badge>
                {lead.campaign && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                    {lead.campaign.name}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="xs"
                variant={mode === 'call' ? 'default' : 'outline'}
                onClick={() => setMode('call')}
                className="text-xs font-semibold h-7 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <PhoneCall size={12} />
                Call
              </Button>
              <Button
                type="button"
                size="xs"
                variant={mode === 'whatsapp' ? 'default' : 'outline'}
                onClick={() => setMode('whatsapp')}
                className="text-xs font-semibold h-7 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare size={12} />
                WhatsApp
              </Button>
              <Button
                type="button"
                size="xs"
                variant={mode === 'note' ? 'default' : 'outline'}
                onClick={() => setMode('note')}
                className="text-xs font-semibold h-7 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <FileText size={12} />
                Note
              </Button>
            </div>
          </div>
        </div>

        {/* Action Body */}
        <div className="p-5 space-y-4">
          {mode === 'call' && (
            <div className="space-y-4">
              {/* Direct Click to Call */}
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <Phone size={15} />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">Click to Call Directly</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{lead.phone}</p>
                  </div>
                </div>
                <Button
                  onClick={handleLaunchCall}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <PhoneCall size={12} />
                  Dial Now
                </Button>
              </div>

              {/* Outcome Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Call Outcome</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CALL_OUTCOMES.map((outcome) => (
                    <button
                      key={outcome.id}
                      type="button"
                      onClick={() => setSelectedOutcome(outcome.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                        selectedOutcome === outcome.id
                          ? 'border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary/20'
                          : 'border-border text-foreground/80 hover:bg-muted/50'
                      }`}
                    >
                      <span>{outcome.label}</span>
                      {selectedOutcome === outcome.id && <CheckCircle2 size={13} className="text-primary flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Conversation Summary & Notes</Label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Key discussion points, customer questions, interest level..."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Quick Follow-up Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock size={12} />
                  Next Follow-up Action
                </Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="xs"
                    variant={followUpDate === 'tomorrow_10am' ? 'default' : 'outline'}
                    onClick={() => setFollowUpDate('tomorrow_10am')}
                    className="text-[11px] h-7 rounded-lg cursor-pointer"
                  >
                    Tomorrow 10 AM
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={followUpDate === 'in_2_days' ? 'default' : 'outline'}
                    onClick={() => setFollowUpDate('in_2_days')}
                    className="text-[11px] h-7 rounded-lg cursor-pointer"
                  >
                    In 2 Days
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={followUpDate === 'next_week' ? 'default' : 'outline'}
                    onClick={() => setFollowUpDate('next_week')}
                    className="text-[11px] h-7 rounded-lg cursor-pointer"
                  >
                    Next Week
                  </Button>
                </div>
              </div>
            </div>
          )}

          {mode === 'whatsapp' && (
            <div className="space-y-4">
              {/* Template Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-500" />
                  Select Message Template
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant={whatsappTemplate === 'intro' ? 'default' : 'outline'}
                    onClick={() => setWhatsappTemplate('intro')}
                    className="text-xs h-8 rounded-lg font-medium cursor-pointer"
                  >
                    Intro & Catalog
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={whatsappTemplate === 'admission' ? 'default' : 'outline'}
                    onClick={() => setWhatsappTemplate('admission')}
                    className="text-xs h-8 rounded-lg font-medium cursor-pointer"
                  >
                    Seat Reservation
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={whatsappTemplate === 'callback' ? 'default' : 'outline'}
                    onClick={() => setWhatsappTemplate('callback')}
                    className="text-xs h-8 rounded-lg font-medium cursor-pointer"
                  >
                    Missed Call
                  </Button>
                </div>
              </div>

              {/* Editable Message Box */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Message Preview</Label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={5}
                  className="w-full text-xs p-3 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2">
                <MessageSquare size={14} className="text-emerald-600 flex-shrink-0" />
                <span>
                  Clicking &ldquo;Send via WhatsApp&rdquo; will launch WhatsApp Web and log the dispatch in this lead&apos;s activity timeline.
                </span>
              </div>
            </div>
          )}

          {mode === 'note' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Internal Note</Label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Record internal team observation or handover notes..."
                  rows={5}
                  className="w-full text-xs p-3 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 rounded-lg cursor-pointer"
          >
            Cancel
          </Button>

          {mode === 'call' && (
            <Button
              onClick={handleSaveCall}
              disabled={logInteractionMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold h-8 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {logInteractionMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Log Call & Update
            </Button>
          )}

          {mode === 'whatsapp' && (
            <Button
              onClick={handleSendWhatsApp}
              disabled={logInteractionMutation.isPending || !customMessage.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {logInteractionMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Send via WhatsApp & Log
            </Button>
          )}

          {mode === 'note' && (
            <Button
              onClick={() => {
                logInteractionMutation.mutate({
                  type: 'note',
                  notes: callNotes,
                });
              }}
              disabled={logInteractionMutation.isPending || !callNotes.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold h-8 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {logInteractionMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              Save Internal Note
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

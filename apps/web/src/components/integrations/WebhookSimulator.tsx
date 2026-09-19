import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Copy,
  Check,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

const SAMPLE_PAYLOADS: Record<string, { label: string; payload: Record<string, any> }> = {
  facebook: {
    label: 'Meta / Facebook Lead Ad',
    payload: {
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@example.com',
      phone: '+14155552671',
      source: 'facebook_ad',
      campaign: 'Fall Admissions 2026',
      ad_id: 'fb_ad_9921448',
      form_data: {
        preferred_course: 'Full Stack Engineering',
        preferred_timing: 'Weekend Batch',
      },
    },
  },
  website: {
    label: 'Website Landing Page Form',
    payload: {
      name: 'David Miller',
      email: 'david.m@cloudtech.io',
      phone: '+14155559812',
      source: 'website_webhook',
      course_interest: 'Cloud Architecture & DevOps',
      notes: 'Requested brochure and fee structure download',
    },
  },
  whatsapp: {
    label: 'WhatsApp Inbound Inquiry',
    payload: {
      name: 'Priya Sharma',
      phone: '+919876543210',
      source: 'whatsapp',
      message: 'Hi, I saw your training program. Can you please share the syllabus and upcoming batch dates?',
    },
  },
  justdial: {
    label: 'JustDial Consumer Inquiry',
    payload: {
      name: 'Marcus Vance',
      email: 'marcus.vance@gmail.com',
      phone: '+14155558833',
      source: 'justdial',
      category: 'Professional Certification',
      city: 'San Francisco',
    },
  },
};

export function WebhookSimulator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState('facebook');
  const [jsonText, setJsonText] = useState(
    JSON.stringify(SAMPLE_PAYLOADS['facebook']!.payload, null, 2)
  );
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<any | null>(null);

  const tenantSlug = (user as any)?.tenant_slug || (user as any)?.tenantSlug || 'default';
  const webhookUrl = `${window.location.origin}/api/v1/webhooks/generic`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast.success('Webhook URL copied to clipboard');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSelectTemplate = (key: string) => {
    setSelectedTemplate(key);
    setJsonText(JSON.stringify(SAMPLE_PAYLOADS[key]!.payload, null, 2));
    setLastResult(null);
  };

  const handleSendTest = async () => {
    setIsSending(true);
    setLastResult(null);

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(jsonText);
    } catch {
      toast.error('Invalid JSON payload format');
      setIsSending(false);
      return;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': tenantSlug,
        },
        body: JSON.stringify({
          ...parsedPayload,
          tenant_slug: tenantSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Webhook request failed');
      }

      setLastResult({
        success: true,
        status: res.status,
        data,
        leadName: parsedPayload.name || 'Inbound Lead',
        phone: parsedPayload.phone || 'N/A',
      });

      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Inbound lead "${parsedPayload.name}" ingested successfully!`);
    } catch (err: any) {
      setLastResult({
        success: false,
        error: err.message || 'Failed to trigger webhook',
      });
      toast.error(err.message || 'Failed to simulate webhook');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Webhook Endpoint Banner */}
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Zap size={16} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Your Live Inbound Webhook</CardTitle>
                <CardDescription className="text-xs">
                  Send real HTTP POST payloads from Meta Ads, Webflow, WordPress, Zapier, or custom forms.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
              Active & Listening
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 p-2 bg-muted/70 rounded-lg border border-border">
            <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 bg-primary/10 text-primary rounded">
              POST
            </span>
            <code className="text-xs font-mono text-foreground flex-1 truncate select-all">
              {webhookUrl}
            </code>
            <Button
              size="xs"
              variant="outline"
              onClick={handleCopyUrl}
              className="h-7 text-xs flex items-center gap-1 cursor-pointer font-medium"
            >
              {copiedUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              {copiedUrl ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>Required Header:</span>
            <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] text-foreground select-all">
              x-tenant-slug: {tenantSlug}
            </code>
            <span className="text-muted-foreground/60">•</span>
            <span>Content-Type:</span>
            <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] text-foreground">
              application/json
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Ingestion Simulator */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-card border-border rounded-xl shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Code2 size={15} className="text-primary" />
                  Live Ingestion Simulator
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] font-medium">
                  Instant Test
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Pick a real-world lead source template or customize the JSON payload below:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preset Selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(SAMPLE_PAYLOADS).map(([key, item]) => (
                  <Button
                    key={key}
                    type="button"
                    size="xs"
                    variant={selectedTemplate === key ? 'default' : 'outline'}
                    onClick={() => handleSelectTemplate(key)}
                    className="text-xs h-7 rounded-lg font-medium cursor-pointer"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              {/* JSON Editor Textarea */}
              <div className="relative">
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  rows={11}
                  className="w-full font-mono text-xs p-3 bg-muted/50 border border-border rounded-lg text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-muted-foreground">
                  Payload will be converted into a Lead and routed immediately.
                </p>
                <Button
                  onClick={handleSendTest}
                  disabled={isSending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold h-9 px-4 rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Ingesting...
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      Send Live Test Ingestion
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Ingestion Results */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-card border-border rounded-xl shadow-none h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles size={15} className="text-amber-500" />
                Ingestion Results & Verification
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time server routing confirmation
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              {lastResult ? (
                lastResult.success ? (
                  <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      Lead Created & Routed!
                    </div>
                    <div className="space-y-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lead Name:</span>
                        <span className="font-semibold">{lastResult.leadName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contact Phone:</span>
                        <span className="font-mono">{lastResult.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Event Status:</span>
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                          HTTP 200 · ROUTED
                        </Badge>
                      </div>
                      {lastResult.data?.event_id && (
                        <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t border-emerald-200/60">
                          <span>Event ID:</span>
                          <span className="font-mono">{lastResult.data.event_id}</span>
                        </div>
                      )}
                    </div>
                    <div className="pt-2">
                      <Button asChild size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 rounded-lg flex items-center justify-center gap-1.5">
                        <Link to="/leads">
                          View Ingested Lead in Leads CRM
                          <ArrowRight size={13} />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertCircle size={18} className="text-rose-600" />
                      Ingestion Failed
                    </div>
                    <p className="text-xs">{lastResult.error}</p>
                  </div>
                )
              ) : (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <Zap size={28} className="mx-auto text-muted-foreground/40 stroke-1" />
                  <p className="text-xs">Click &ldquo;Send Live Test Ingestion&rdquo; to test the inbound pipeline.</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    The lead will appear instantly in your workspace Leads list.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

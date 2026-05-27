import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  GitFork,
  Zap,
  Plus,
  Trash2,
  Mail,
  MessageSquare,
  FileText,
  Save,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  Settings,
  ChevronRight,
  X,
  Search,
  Eye,
  RefreshCw
} from 'lucide-react';

interface FlowStep {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  config: {
    field?: string;
    operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
    value?: string;
    
    actionType?: 'update_field' | 'whatsapp_alert' | 'email_notification';
    fieldName?: string;
    fieldValue?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    messageTemplate?: string;
    subject?: string;
    body?: string;
  };
  nextStepId?: string;
  yesStepId?: string;
  noStepId?: string;
}

interface AutomationFlow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  flow_json: {
    steps?: FlowStep[];
    nodes?: FlowStep[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function FlowBuilder() {
  const queryClient = useQueryClient();
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local state for the flow being edited/created
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('Party:create');
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Queries
  const { data: flows = [], isLoading: loadingFlows } = useQuery<AutomationFlow[]>({
    queryKey: ['automation-flows'],
    queryFn: () => apiCall<AutomationFlow[]>('/automation-flows'),
  });

  const { data: customObjects = [] } = useQuery<any[]>({
    queryKey: ['custom-objects'],
    queryFn: () => apiCall<any[]>('/custom-objects'),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => apiCall<AutomationFlow>('/automation-flows', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-flows'] });
      setIsEditing(false);
      setSelectedFlowId(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiCall<AutomationFlow>(`/automation-flows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-flows'] });
      setIsEditing(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiCall<void>(`/automation-flows/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-flows'] });
      setSelectedFlowId(null);
      setIsEditing(false);
    }
  });

  // Handle flow selection
  const handleSelectFlow = (flow: AutomationFlow) => {
    setSelectedFlowId(flow.id);
    setFlowName(flow.name);
    setFlowDescription(flow.description || '');
    setTriggerEvent(flow.trigger_event);
    
    // Parse flow steps
    const steps = flow.flow_json?.steps || flow.flow_json?.nodes || [];
    setFlowSteps(steps);
    setSelectedStepId(steps[0]?.id || null);
    setIsEditing(true);
  };

  // Handle new flow creation
  const handleNewFlow = () => {
    setSelectedFlowId(null);
    setFlowName('New Process Automation');
    setFlowDescription('Trigger a custom background action flow');
    setTriggerEvent('Party:create');
    
    const initialSteps: FlowStep[] = [
      {
        id: 'step-trigger',
        type: 'trigger',
        config: {},
        nextStepId: 'step-criteria'
      },
      {
        id: 'step-criteria',
        type: 'condition',
        config: {
          field: 'type',
          operator: 'equals',
          value: 'individual'
        },
        yesStepId: 'step-action',
        noStepId: undefined
      },
      {
        id: 'step-action',
        type: 'action',
        config: {
          actionType: 'update_field',
          fieldName: 'attributes.preferred_time__c',
          fieldValue: 'Morning'
        }
      }
    ];
    
    setFlowSteps(initialSteps);
    setSelectedStepId('step-criteria');
    setIsEditing(true);
  };

  // Add Step Helper
  const handleAddStep = (parentStepId: string, branch?: 'yes' | 'no' | 'next') => {
    const newId = `step-action-${Date.now()}`;
    const newStep: FlowStep = {
      id: newId,
      type: 'action',
      config: {
        actionType: 'email_notification',
        subject: 'Notification Hook',
        body: 'A workflow event has run successfully.'
      }
    };

    const updatedSteps = flowSteps.map(step => {
      if (step.id === parentStepId) {
        if (step.type === 'condition') {
          if (branch === 'yes') {
            return { ...step, yesStepId: newId };
          } else {
            return { ...step, noStepId: newId };
          }
        } else {
          return { ...step, nextStepId: newId };
        }
      }
      return step;
    });

    setFlowSteps([...updatedSteps, newStep]);
    setSelectedStepId(newId);
  };

  // Delete Step Helper
  const handleDeleteStep = (stepId: string) => {
    if (stepId === 'step-trigger') return; // Cannot delete trigger entry point

    // Clean connections pointing to this deleted step
    const updatedSteps = flowSteps
      .filter(step => step.id !== stepId)
      .map(step => {
        const nextId = step.nextStepId === stepId ? undefined : step.nextStepId;
        const yesId = step.yesStepId === stepId ? undefined : step.yesStepId;
        const noId = step.noStepId === stepId ? undefined : step.noStepId;
        return {
          ...step,
          nextStepId: nextId,
          yesStepId: yesId,
          noStepId: noId
        };
      });

    setFlowSteps(updatedSteps);
    if (selectedStepId === stepId) {
      setSelectedStepId('step-trigger');
    }
  };

  // Update step config in local state
  const handleUpdateStepConfig = (stepId: string, updatedConfig: any) => {
    setFlowSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          config: { ...step.config, ...updatedConfig }
        };
      }
      return step;
    }));
  };

  // Save Flow
  const handleSaveFlow = () => {
    if (!flowName.trim()) return;

    const data = {
      name: flowName,
      description: flowDescription,
      trigger_event: triggerEvent,
      flow_json: {
        steps: flowSteps
      },
      is_active: true
    };

    if (selectedFlowId) {
      updateMutation.mutate({ id: selectedFlowId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filter flows
  const filteredFlows = flows.filter(flow => 
    flow.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (flow.description && flow.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Render Visual Node
  const renderFlowchartNode = (step: FlowStep) => {
    const isSelected = selectedStepId === step.id;
    
    let icon = <Zap size={16} className="text-amber-500" />;
    let headerText = 'Action Node';
    let summaryText = 'Execute background operation';
    let themeColor = 'border-amber-500 bg-amber-500/10';

    if (step.type === 'trigger') {
      icon = <Play size={16} className="text-emerald-500" />;
      headerText = `Trigger Event`;
      summaryText = triggerEvent;
      themeColor = 'border-emerald-500 bg-emerald-500/10';
    } else if (step.type === 'condition') {
      icon = <GitFork size={16} className="text-indigo-500 animate-pulse" />;
      headerText = 'Criteria Filter';
      summaryText = `${step.config.field || 'Field'} ${step.config.operator || 'operator'} ${step.config.value || 'value'}`;
      themeColor = 'border-indigo-500 bg-indigo-500/10';
    } else if (step.type === 'action') {
      const type = step.config.actionType;
      if (type === 'update_field') {
        icon = <FileText size={16} className="text-blue-500" />;
        headerText = 'Update Field';
        summaryText = `Set ${step.config.fieldName || 'field'} = "${step.config.fieldValue || 'value'}"`;
        themeColor = 'border-blue-500 bg-blue-500/10';
      } else if (type === 'whatsapp_alert') {
        icon = <MessageSquare size={16} className="text-teal-500" />;
        headerText = 'WhatsApp Alert';
        summaryText = `Send Template to recipient`;
        themeColor = 'border-teal-500 bg-teal-500/10';
      } else if (type === 'email_notification') {
        icon = <Mail size={16} className="text-fuchsia-500" />;
        headerText = 'Send Email';
        summaryText = `Email: "${step.config.subject || 'Subject'}"`;
        themeColor = 'border-fuchsia-500 bg-fuchsia-500/10';
      }
    }

    return (
      <div className="flex flex-col items-center group relative" key={step.id}>
        <div 
          onClick={() => setSelectedStepId(step.id)}
          className={`cursor-pointer w-72 rounded-xl border p-4 shadow-md transition-all duration-300 hover:scale-[1.02] ${
            isSelected 
              ? 'ring-2 ring-indigo-600 bg-slate-900 border-indigo-600' 
              : `bg-slate-950/70 border-slate-800 hover:border-slate-700`
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${themeColor} flex items-center justify-center`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-slate-200 text-sm block tracking-wide">{headerText}</span>
              <span className="text-[11px] text-slate-400 font-medium block truncate mt-0.5">{summaryText}</span>
            </div>
            {step.type !== 'trigger' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStep(step.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-rose-500 text-slate-500 transition-all p-1"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Connections and next nodes */}
        {step.type === 'condition' ? (
          <div className="flex gap-16 mt-12 w-full justify-center relative">
            {/* Connection line connector lines */}
            <svg className="absolute top-[-48px] left-0 w-full h-[48px] pointer-events-none" style={{ zIndex: -1 }}>
              <path d="M 50% 0 L 50% 100%" stroke="#4338ca" strokeWidth="2" strokeDasharray="3,3" />
            </svg>

            {/* Yes branch */}
            <div className="flex flex-col items-center">
              <div className="text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full mb-3 select-none">
                Yes Branch
              </div>
              {step.yesStepId ? (
                renderFlowchartNode(flowSteps.find(s => s.id === step.yesStepId)!)
              ) : (
                <Button 
                  onClick={() => handleAddStep(step.id, 'yes')}
                  variant="outline" 
                  className="border-dashed border-slate-800 text-slate-500 hover:text-indigo-400 hover:border-indigo-600 rounded-lg text-xs h-9"
                >
                  <Plus size={12} className="mr-1" /> Add Action
                </Button>
              )}
            </div>

            {/* No branch */}
            <div className="flex flex-col items-center">
              <div className="text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400 px-2 py-0.5 rounded-full mb-3 select-none">
                No Branch
              </div>
              {step.noStepId ? (
                renderFlowchartNode(flowSteps.find(s => s.id === step.noStepId)!)
              ) : (
                <Button 
                  onClick={() => handleAddStep(step.id, 'no')}
                  variant="outline" 
                  className="border-dashed border-slate-800 text-slate-500 hover:text-indigo-400 hover:border-indigo-600 rounded-lg text-xs h-9"
                >
                  <Plus size={12} className="mr-1" /> Add Action
                </Button>
              )}
            </div>
          </div>
        ) : (
          step.nextStepId ? (
            <div className="flex flex-col items-center w-full">
              {/* Connecting line */}
              <div className="h-10 w-0.5 bg-slate-800 border-dashed border-l border-slate-700/50 my-1 relative">
                <ArrowDown size={12} className="absolute bottom-[-6px] left-[-5px] text-slate-600" />
              </div>
              {renderFlowchartNode(flowSteps.find(s => s.id === step.nextStepId)!)}
            </div>
          ) : (
            <div className="mt-4">
              <Button 
                onClick={() => handleAddStep(step.id, 'next')}
                variant="outline" 
                className="border-dashed border-slate-800 text-slate-500 hover:text-indigo-400 hover:border-indigo-600 rounded-lg text-xs h-8"
              >
                <Plus size={12} className="mr-1" /> Add Action Node
              </Button>
            </div>
          )
        )}
      </div>
    );
  };

  const selectedStep = flowSteps.find(s => s.id === selectedStepId);

  return (
    <div className="space-y-6 max-w-[1500px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Zap size={22} className="text-indigo-600 animate-pulse" />
            Process Builder Setup
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Define Salesforce-style visual triggers, conditions, and background execution workflows.</p>
        </div>
        {!isEditing && (
          <Button 
            onClick={handleNewFlow}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 shadow-sm"
          >
            <Plus size={15} className="mr-1.5" />
            New Automation Flow
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid gap-6 md:grid-cols-3">
          {/* List panel */}
          <div className="md:col-span-3 space-y-4">
            <div className="flex items-center gap-2 bg-white rounded-xl p-3 border border-slate-200 shadow-sm max-w-md">
              <Search size={16} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search processes..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 outline-none text-slate-800 text-sm placeholder-slate-400"
              />
            </div>

            {loadingFlows ? (
              <div className="flex py-12 items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                  <RefreshCw size={15} className="animate-spin text-indigo-600" />
                  Loading background triggers…
                </div>
              </div>
            ) : filteredFlows.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm">
                <Zap size={42} className="text-slate-300 mx-auto mb-3" />
                <p className="text-base font-semibold text-slate-900">No automation flows defined</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Create process builder chains to auto-update contact fields or trigger notifications on actions.</p>
                <Button 
                  onClick={handleNewFlow} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg mt-4 h-9 shadow-sm"
                >
                  <Plus size={14} className="mr-1.5" /> Create First Flow
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFlows.map(flow => (
                  <Card 
                    key={flow.id} 
                    onClick={() => handleSelectFlow(flow)}
                    className="cursor-pointer hover:shadow-md hover:border-slate-300 transition-all bg-white border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <Badge className={`${flow.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'} border px-2 py-0.5 rounded-full text-[10px] font-bold`}>
                          {flow.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 border px-2 py-0.5 rounded-full text-[10px] font-mono">
                          {flow.trigger_event}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold text-slate-900 mt-3 truncate">{flow.name}</CardTitle>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{flow.description || 'No description provided.'}</p>
                    </CardHeader>
                    <CardContent className="bg-slate-50/50 py-3 px-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>Updated: {new Date(flow.updated_at).toLocaleDateString()}</span>
                      <span className="text-indigo-600 hover:underline flex items-center gap-0.5 font-semibold">
                        Edit Flowchart <ChevronRight size={12} />
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Workspace active editor */
        <div className="grid gap-6 lg:grid-cols-12 bg-slate-950 rounded-2xl border border-slate-900 shadow-xl overflow-hidden min-h-[750px]">
          {/* Visual flowchart Canvas (Left) */}
          <div className="lg:col-span-8 p-8 flex flex-col items-center overflow-auto bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:20px_20px] bg-slate-950 relative min-h-[600px] border-r border-slate-900">
            {/* Header controls inside canvas */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setIsEditing(false)}
                  variant="outline" 
                  className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800 rounded-lg h-8 px-3 text-xs"
                >
                  <X size={12} className="mr-1.5" /> Back to List
                </Button>
                {selectedFlowId && (
                  <Button 
                    onClick={() => {
                      if(confirm('Are you sure you want to delete this process flow?')) {
                        deleteMutation.mutate(selectedFlowId);
                      }
                    }}
                    variant="ghost" 
                    className="hover:bg-rose-950/20 hover:text-rose-400 text-slate-500 rounded-lg h-8 px-3 text-xs"
                  >
                    <Trash2 size={12} className="mr-1.5" /> Delete Flow
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleSaveFlow}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 px-4 text-xs shadow-sm font-semibold flex items-center gap-1.5"
                >
                  <Save size={12} />
                  Save Changes
                </Button>
              </div>
            </div>

            {/* flowchart diagram items */}
            <div className="w-full flex flex-col items-center mt-12 py-10">
              {flowSteps.length > 0 && renderFlowchartNode(flowSteps[0]!)}
            </div>
          </div>

          {/* Configuration Property panel (Right) */}
          <div className="lg:col-span-4 p-6 bg-slate-950/40 border-l border-slate-900 flex flex-col justify-between h-full min-h-[600px]">
            <div className="space-y-6">
              <div className="border-b border-slate-900 pb-4">
                <h3 className="font-semibold text-slate-200 text-sm tracking-wide">Flow Properties</h3>
                <p className="text-[11px] text-slate-400 mt-1">Configure global triggers and metadata</p>
              </div>

              {/* global Flow properties */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Flow Name</label>
                  <input 
                    type="text" 
                    value={flowName}
                    onChange={e => setFlowName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs py-2 px-3 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    placeholder="e.g. Welcome Customer Trigger"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                  <textarea 
                    value={flowDescription}
                    onChange={e => setFlowDescription(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs py-2 px-3 h-16 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-none"
                    placeholder="Describe what this automation accomplished..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trigger Target Object</label>
                  <select 
                    value={triggerEvent}
                    onChange={e => setTriggerEvent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs py-2 px-3 focus:outline-none focus:border-indigo-600"
                  >
                    <optgroup label="Standard CRM Objects">
                      <option value="Party:create">Contact Created (Party:create)</option>
                      <option value="Party:update">Contact Updated (Party:update)</option>
                      <option value="Case:create">Ticket/Case Created (Case:create)</option>
                      <option value="Case:update">Ticket/Case Updated (Case:update)</option>
                    </optgroup>
                    
                    {customObjects.length > 0 && (
                      <optgroup label="Custom Low-Code Objects">
                        {customObjects.map(obj => (
                          <React.Fragment key={obj.id}>
                            <option value={`${obj.api_name}:create`}>{obj.singular_label} Created ({obj.api_name}:create)</option>
                            <option value={`${obj.api_name}:update`}>{obj.singular_label} Updated ({obj.api_name}:update)</option>
                          </React.Fragment>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Node-specific configuration */}
              {selectedStep && (
                <div className="mt-8 border-t border-slate-900 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Step Settings ({selectedStep.id.split('-')[1]})</h4>
                    <Badge className="bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono px-2 py-0.5 rounded">
                      {selectedStep.type}
                    </Badge>
                  </div>

                  {selectedStep.type === 'condition' && (
                    <div className="space-y-3 bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-slate-400">Target Field</label>
                        <input 
                          type="text" 
                          value={selectedStep.config.field || ''}
                          onChange={e => handleUpdateStepConfig(selectedStep.id, { field: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                          placeholder="e.g. type or attributes.custom_field__c"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-slate-400">Operator</label>
                        <select 
                          value={selectedStep.config.operator || 'equals'}
                          onChange={e => handleUpdateStepConfig(selectedStep.id, { operator: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value="contains">contains</option>
                          <option value="greater_than">greater than</option>
                          <option value="less_than">less than</option>
                          <option value="exists">exists / is set</option>
                        </select>
                      </div>

                      {selectedStep.config.operator !== 'exists' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-slate-400">Value to Match</label>
                          <input 
                            type="text" 
                            value={selectedStep.config.value || ''}
                            onChange={e => handleUpdateStepConfig(selectedStep.id, { value: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                            placeholder="e.g. individual"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedStep.type === 'action' && (
                    <div className="space-y-3 bg-slate-900/30 p-4 rounded-xl border border-slate-900">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-slate-400">Action Type</label>
                        <select 
                          value={selectedStep.config.actionType || 'update_field'}
                          onChange={e => handleUpdateStepConfig(selectedStep.id, { actionType: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                        >
                          <option value="update_field">Update Trigger Record Field</option>
                          <option value="whatsapp_alert">Send WhatsApp Message</option>
                          <option value="email_notification">Send Transactional Email</option>
                        </select>
                      </div>

                      {selectedStep.config.actionType === 'update_field' && (
                        <React.Fragment>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400">Field Name</label>
                            <input 
                              type="text" 
                              value={selectedStep.config.fieldName || ''}
                              onChange={e => handleUpdateStepConfig(selectedStep.id, { fieldName: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                              placeholder="e.g. status or attributes.preferred_time__c"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400">Field Value</label>
                            <input 
                              type="text" 
                              value={selectedStep.config.fieldValue || ''}
                              onChange={e => handleUpdateStepConfig(selectedStep.id, { fieldValue: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                              placeholder="e.g. Closed or Morning"
                            />
                          </div>
                        </React.Fragment>
                      )}

                      {selectedStep.config.actionType === 'whatsapp_alert' && (
                        <React.Fragment>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400">Recipient Phone (Optional)</label>
                            <input 
                              type="text" 
                              value={selectedStep.config.recipientPhone || ''}
                              onChange={e => handleUpdateStepConfig(selectedStep.id, { recipientPhone: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                              placeholder="Leave blank for record owner phone"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400">WhatsApp Message Template</label>
                            <textarea 
                              value={selectedStep.config.messageTemplate || ''}
                              onChange={e => handleUpdateStepConfig(selectedStep.id, { messageTemplate: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 h-20 resize-none focus:outline-none"
                              placeholder="Hello! Welcome to Meta CRM! We have successfully enqueued your registration."
                            />
                          </div>
                        </React.Fragment>
                      )}

                      {selectedStep.config.actionType === 'email_notification' && (
                        <React.Fragment>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400">Recipient Email (Optional)</label>
                            <input 
                              type="text" 
                              value={selectedStep.config.recipientEmail || ''}
                              onChange={e => handleUpdateStepConfig(selectedStep.id, { recipientEmail: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                              placeholder="Leave blank to send to record contact"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400">Subject</label>
                            <input 
                              type="text" 
                              value={selectedStep.config.subject || ''}
                              onChange={e => handleUpdateStepConfig(selectedStep.id, { subject: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 focus:outline-none"
                              placeholder="Action update regarding your record..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400">Email Body</label>
                            <textarea 
                              value={selectedStep.config.body || ''}
                              onChange={e => handleUpdateStepConfig(selectedStep.id, { body: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs py-1.5 px-2 h-20 resize-none focus:outline-none"
                              placeholder="Write a clear transactional text update..."
                            />
                          </div>
                        </React.Fragment>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-900 pt-6">
              <div className="flex gap-3">
                <Button 
                  onClick={handleSaveFlow}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 shadow-sm font-semibold"
                >
                  Save Flow Configuration
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

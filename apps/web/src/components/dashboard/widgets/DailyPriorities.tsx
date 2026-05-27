import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { CheckCircle2, Phone, Mail, Calendar, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';

interface PriorityTask {
  id: string;
  title: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  type: 'call' | 'email' | 'meeting' | 'task';
  targetName: string;
  completed: boolean;
  phone?: string;
}

export function DailyPriorities() {
  const [tasks, setTasks] = useState<PriorityTask[]>([
    {
      id: 'task-1',
      title: 'Urgent follow-up on pricing proposal',
      dueDate: 'Overdue by 2h',
      priority: 'high',
      type: 'call',
      targetName: 'Sarah Chen (TechCorp)',
      phone: '9876543210',
      completed: false,
    },
    {
      id: 'task-2',
      title: 'Send security questionnaire documents',
      dueDate: 'Overdue by 1d',
      priority: 'high',
      type: 'email',
      targetName: 'Acme Corp Admin',
      completed: false,
    },
    {
      id: 'task-3',
      title: 'Schedule Q3 roadmap alignment call',
      dueDate: 'Today at 3:00 PM',
      priority: 'medium',
      type: 'meeting',
      targetName: 'James Wilson',
      phone: '9988776655',
      completed: false,
    },
    {
      id: 'task-4',
      title: 'Review custom schema definition feedback',
      dueDate: 'Today at 5:00 PM',
      priority: 'low',
      type: 'task',
      targetName: 'Platform Admins Team',
      completed: false,
    },
  ]);

  const handleToggleComplete = (id: string) => {
    setTasks(prev => 
      prev.map(task => {
        if (task.id === id) {
          const nextState = !task.completed;
          if (nextState) {
            toast.success(`Completed: "${task.title}"`, {
              icon: <Sparkles className="h-4 w-4 text-emerald-500 animate-bounce" />
            });
          }
          return { ...task, completed: nextState };
        }
        return task;
      })
    );
  };

  const activeCount = tasks.filter(t => !t.completed).length;

  return (
    <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none hover:shadow-md transition-shadow h-full flex flex-col justify-between overflow-hidden">
      <CardHeader className="pb-3 border-b border-[#e2e8f0] bg-slate-50/20">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold text-[#0f172a] flex items-center gap-1.5">
              Daily Priorities
              {activeCount > 0 && (
                <Badge className="bg-indigo-600 text-white font-bold text-[9px] px-1.5 py-0 rounded-full">
                  {activeCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-[11px] text-[#94a3b8]">
              High priority CRM actions and overdue interactions needing attention today.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 divide-y divide-[#e2e8f0]">
        {tasks.map((task) => {
          const isOverdue = task.dueDate.includes('Overdue');

          return (
            <div 
              key={task.id}
              className={cn(
                "p-3.5 flex items-start gap-3 transition-colors",
                task.completed ? "bg-slate-50/40 opacity-60" : "hover:bg-slate-50/30"
              )}
            >
              {/* Completed Checkbox */}
              <div className="pt-0.5">
                <Checkbox 
                  checked={task.completed} 
                  onCheckedChange={() => handleToggleComplete(task.id)}
                  className="rounded-full h-4 w-4 border-[#cbd5e1] text-[#0f172a] focus-visible:ring-indigo-500"
                />
              </div>

              {/* Task Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn(
                    "text-xs font-semibold tracking-tight",
                    task.completed ? "text-slate-400 line-through" : "text-slate-800"
                  )}>
                    {task.title}
                  </span>
                  
                  {/* Priority Badge */}
                  {!task.completed && (
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-[8px] font-bold py-0 px-1 rounded-sm select-none uppercase shrink-0",
                        task.priority === 'high' && "bg-red-50 text-red-650 border-red-100",
                        task.priority === 'medium' && "bg-amber-50 text-amber-650 border-amber-100",
                        task.priority === 'low' && "bg-slate-50 text-slate-500 border-slate-100"
                      )}
                    >
                      {task.priority}
                    </Badge>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-650 truncate max-w-[150px]">
                    {task.targetName}
                  </span>
                  <span>•</span>
                  <span className={cn(
                    "font-medium flex items-center gap-0.5",
                    isOverdue && !task.completed ? "text-red-500 font-bold" : "text-slate-400"
                  )}>
                    {isOverdue && !task.completed && <AlertCircle size={10} />}
                    {task.dueDate}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {!task.completed && (
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  {task.type === 'call' && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon-xs"
                        onClick={() => toast.success(`Starting outbound dialer to ${task.targetName}...`)}
                        className="h-6 w-6 text-slate-450 hover:text-indigo-600 hover:bg-slate-100 rounded-md"
                        title="Outbound dialer"
                      >
                        <Phone size={12} />
                      </Button>
                      {task.phone && (
                        <WhatsAppButton
                          phone={task.phone}
                          message={`Hi ${task.targetName.split(' ')[0]}, following up from our conversation...`}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 border-0 text-slate-450 hover:text-emerald-600 hover:bg-slate-100 rounded-md p-0 flex items-center justify-center"
                          title="WhatsApp direct chat"
                        >
                          <span className="sr-only">WhatsApp</span>
                        </WhatsAppButton>
                      )}
                    </>
                  )}
                  {task.type === 'email' && (
                    <Button 
                      variant="ghost" 
                      size="icon-xs"
                      onClick={() => toast.success(`Opening mail client composer for ${task.targetName}...`)}
                      className="h-6 w-6 text-slate-450 hover:text-indigo-600 hover:bg-slate-100 rounded-md"
                      title="Send email"
                    >
                      <Mail size={12} />
                    </Button>
                  )}
                  {task.type === 'meeting' && (
                    <Button 
                      variant="ghost" 
                      size="icon-xs"
                      onClick={() => toast.success(`Launching calendar scheduler...`)}
                      className="h-6 w-6 text-slate-450 hover:text-indigo-600 hover:bg-slate-100 rounded-md"
                      title="Calendar invite"
                    >
                      <Calendar size={12} />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {activeCount === 0 && (
          <div className="p-8 text-center space-y-2 bg-slate-50/15">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 animate-bounce" />
            <div>
              <p className="text-xs font-semibold text-slate-800">You're all caught up!</p>
              <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-normal mt-0.5">All daily priority follow-ups and outreach calls have been resolved.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

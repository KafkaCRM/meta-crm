import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DangerousActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title: string;
  description: string;
  targetName: string;
  confirmButtonText?: string;
  isPending?: boolean;
}

export function DangerousActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetName,
  confirmButtonText = 'Confirm Dangerous Action',
  isPending = false,
}: DangerousActionModalProps) {
  const [nameInput, setNameInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [error, setError] = useState('');

  // Reset inputs when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setNameInput('');
      setReasonInput('');
      setError('');
    }
  }, [isOpen]);

  const nameMatches = nameInput.trim() === targetName.trim();
  const reasonValid = reasonInput.trim().length >= 5;
  const isSubmitDisabled = !nameMatches || !reasonValid || isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    try {
      await onConfirm(reasonInput.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-rose-200 shadow-xl overflow-hidden bg-white text-slate-900 rounded-2xl p-0">
        <form onSubmit={handleSubmit}>
          {/* Header block with red accent warning */}
          <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
              <AlertTriangle size={20} className="animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-rose-900">{title}</DialogTitle>
              <DialogDescription className="text-xs text-rose-700/80 mt-1">
                {description}
              </DialogDescription>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            {/* Target name match verification */}
            <div className="space-y-1.5">
              <label htmlFor="confirm-target-name" className="text-xs font-bold text-slate-700 block">
                Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-900 font-bold select-all">{targetName}</span> to confirm:
              </label>
              <Input
                id="confirm-target-name"
                type="text"
                autoComplete="off"
                placeholder={targetName}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:ring-rose-600 focus-visible:border-rose-600 h-9 font-semibold text-xs text-slate-800"
                required
              />
            </div>

            {/* Impersonator/Operator logged reason */}
            <div className="space-y-1.5">
              <label htmlFor="operator-action-reason" className="text-xs font-bold text-slate-700 block">
                Logged reason for action (minimum 5 characters):
              </label>
              <textarea
                id="operator-action-reason"
                placeholder="e.g. Cleared payment invoice arrears / payment failed"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus-visible:ring-rose-600 focus-visible:border-rose-600 outline-none placeholder:text-slate-400 font-medium"
                required
              />
              <p className="text-[10px] text-slate-400 font-semibold italic">
                * This action will be permanently logged in the audit history under your super-admin profile.
              </p>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 border-t border-slate-100 p-4 flex flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="h-9 rounded-lg border-slate-200 text-slate-700 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className="h-9 bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-4 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              <span>{confirmButtonText}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

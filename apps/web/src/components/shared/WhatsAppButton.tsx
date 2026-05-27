import React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface WhatsAppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  phone: string;
  message?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
}

export function WhatsAppButton({
  phone,
  message = 'Hello,',
  variant = 'outline',
  size = 'sm',
  className = '',
  children,
  ...props
}: WhatsAppButtonProps) {
  const handleOpenWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) {
      toast.error('No phone number provided');
      return;
    }

    // Clean phone number (keep only digits)
    let cleaned = phone.replace(/\D/g, '');
    
    // If it's a 10-digit number, prepend 91 (India)
    if (cleaned.length === 10) {
      cleaned = `91${cleaned}`;
    }

    if (cleaned.length < 10) {
      toast.error('Invalid phone number format');
      return;
    }

    const url = `https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    toast.success(`Opening WhatsApp chat to +${cleaned}`);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size as any}
      onClick={handleOpenWhatsApp}
      className={`border-emerald-250 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 ${className}`}
      {...props}
    >
      <svg
        className="mr-1.5 h-3.5 w-3.5 fill-current shrink-0"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.859-4.42 9.863-9.864.002-2.637-1.03-5.115-2.905-6.99C16.556 1.877 14.077.845 11.983.845 6.548.845 2.122 5.265 2.117 10.7c-.002 1.712.453 3.382 1.32 4.874l-.99 3.612 3.7-.977zm12.39-6.304c-.302-.15-1.786-.882-2.057-.982-.271-.1-.47-.15-.667.15-.198.3-.765.982-.937 1.18-.172.2-.343.224-.645.075-.303-.15-1.277-.47-2.433-1.5-.9-.8-1.51-1.79-1.78-1.89-.271-.1-.048-.271.048-.407.114-.116.27-.325.406-.49.136-.163.185-.271.036-.573-.15-.302-.47-1.277-1.5-2.432-.8-.9-1.79-1.51-1.89-1.78-.1-.271-.271-.048-.407.048-.116.114-.325.27-.49.406-.163.136-.271.185-.573.036z" />
      </svg>
      {children || 'WhatsApp'}
    </Button>
  );
}

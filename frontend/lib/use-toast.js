'use client';

import { toast } from 'sonner';

// Preserves the old ToastProvider/useToast() call signature
// (`notify(message, type='ok'|'err')`) so every page's call sites stay
// unchanged, backed by sonner instead of a hand-rolled context+div.
export function useToast() {
  return (message, type = 'ok') => {
    if (type === 'err') toast.error(message);
    else toast.success(message);
  };
}

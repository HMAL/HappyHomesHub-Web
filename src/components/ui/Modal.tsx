import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Accent color for the header bar. */
  headerBg?: string;
}

/**
 * Accessible modal: focus is trapped inside while open, Esc closes it, background
 * scroll is locked, and screen readers announce it as a dialog. Replaces the
 * inline overlay markup recreated across many pages (which lacked focus handling).
 */
export default function Modal({ open, onClose, title, children, headerBg }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog.
    const focusables = () =>
      panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
    focusables()?.[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={headerBg ? { background: headerBg } : undefined}>
            <h2 className={`font-bold ${headerBg ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
            <button onClick={onClose} aria-label="Close dialog" className={`${headerBg ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore } from '../../stores/toast';

const icons = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
};

const colors = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-500 text-white',
};

export default function Toast() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="animate-in slide-in-from-top-2 fade-in duration-200">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl max-w-sm ${colors[t.type]}`}>
            {icons[t.type]}
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100 transition-opacity ml-1" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

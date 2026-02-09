import { CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';

interface SuccessToastProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}

export default function SuccessToast({ isOpen, onClose, message }: SuccessToastProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] animate-slide-in-right">
      <div className="bg-white rounded-xl shadow-2xl border border-green-200 p-4 flex items-center gap-3 min-w-[320px] max-w-md">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-0.5">Sucesso!</h3>
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
}

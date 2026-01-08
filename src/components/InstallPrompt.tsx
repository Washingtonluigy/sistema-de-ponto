import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      const lastDismissed = localStorage.getItem('installPromptDismissed');
      const now = Date.now();

      if (!lastDismissed || now - parseInt(lastDismissed) > 7 * 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl shadow-2xl p-4 max-w-md mx-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                <line x1="12" y1="12" x2="12" y2="6" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="12" x2="16" y2="12" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Instalar Ponto Digital</h3>
              <p className="text-white text-sm opacity-90">Acesso rápido e modo offline</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center space-x-2 text-white text-sm">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <span>Funciona sem internet</span>
          </div>
          <div className="flex items-center space-x-2 text-white text-sm">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <span>Mantém login salvo automaticamente</span>
          </div>
          <div className="flex items-center space-x-2 text-white text-sm">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <span>Ícone na tela inicial do celular</span>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleInstall}
            className="flex-1 bg-white text-amber-600 font-semibold py-3 rounded-lg hover:bg-gray-100 transition flex items-center justify-center space-x-2"
          >
            <Download className="w-5 h-5" />
            <span>Instalar Agora</span>
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 bg-white bg-opacity-20 text-white font-semibold py-3 rounded-lg hover:bg-opacity-30 transition"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  );
}

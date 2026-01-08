import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    if (localStorage.getItem('appInstalled') === 'true') {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowButton(false);
      setShowModal(false);
      localStorage.setItem('appInstalled', 'true');
    });

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
      setShowButton(false);
      setShowModal(false);
      setIsInstalled(true);
      localStorage.setItem('appInstalled', 'true');
    }
  };

  if (isInstalled || !showButton) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl transition-all transform hover:scale-110 animate-bounce-slow"
        title="Instalar aplicativo"
      >
        <Download className="w-6 h-6" />
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-slide-up">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 rounded-t-xl">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center">
                    <svg className="w-10 h-10 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="9" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                      <line x1="12" y1="12" x2="12" y2="6" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="12" y1="12" x2="16" y2="12" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">Instalar App</h3>
                    <p className="text-white text-sm opacity-90">Ponto Digital</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-4 font-medium">
                Instale o aplicativo na tela inicial do seu celular para:
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-800 text-sm font-medium">Acesso rápido com um toque</span>
                </div>
                <div className="flex items-center space-x-3 bg-blue-50 p-3 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-800 text-sm font-medium">Funciona sem internet</span>
                </div>
                <div className="flex items-center space-x-3 bg-purple-50 p-3 rounded-lg">
                  <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-800 text-sm font-medium">Login salvo automaticamente</span>
                </div>
                <div className="flex items-center space-x-3 bg-amber-50 p-3 rounded-lg">
                  <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-800 text-sm font-medium">Abre em tela cheia</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleInstall}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-4 rounded-lg hover:from-amber-600 hover:to-orange-700 transition shadow-lg flex items-center justify-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Instalar</span>
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 bg-gray-200 text-gray-700 font-semibold py-4 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

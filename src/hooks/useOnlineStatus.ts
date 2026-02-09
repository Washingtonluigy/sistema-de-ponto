import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    try {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      const handleOnline = () => {
        console.log('[ONLINE STATUS] Online');
        setIsOnline(true);
      };
      const handleOffline = () => {
        console.log('[ONLINE STATUS] Offline');
        setIsOnline(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } catch (error) {
      console.error('[ONLINE STATUS] Erro ao configurar listeners:', error);
    }
  }, []);

  return isOnline;
}

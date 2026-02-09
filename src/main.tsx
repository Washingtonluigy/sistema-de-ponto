import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('[MAIN] Inicializando aplicação...');
console.log('[MAIN] User Agent:', navigator.userAgent);
console.log('[MAIN] Online:', navigator.onLine);
console.log('[MAIN] Secure Context:', window.isSecureContext);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[SW] Service Worker registrado com sucesso:', registration.scope);
      },
      (error) => {
        console.log('[SW] Falha ao registrar Service Worker:', error);
      }
    );
  });
} else {
  console.warn('[SW] Service Worker não disponível');
}

window.addEventListener('error', (event) => {
  console.error('[GLOBAL ERROR]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason);
});

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Elemento root não encontrado');
  }

  console.log('[MAIN] Renderizando aplicação...');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log('[MAIN] Aplicação renderizada com sucesso');
} catch (error) {
  console.error('[MAIN] Erro fatal ao inicializar:', error);
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(to bottom right, #fef3c7, #fed7aa); padding: 1rem;">
      <div style="background: white; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); max-width: 28rem; padding: 2rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: #111827;">Erro ao Carregar</h1>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">Não foi possível inicializar o aplicativo. Por favor, recarregue a página.</p>
        <button onclick="window.location.reload()" style="width: 100%; padding: 0.75rem 1.5rem; background: linear-gradient(to right, #f59e0b, #f97316); color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">Recarregar</button>
        <details style="margin-top: 1rem; text-align: left;">
          <summary style="color: #6b7280; font-size: 0.875rem; cursor: pointer;">Detalhes</summary>
          <pre style="margin-top: 0.5rem; font-size: 0.75rem; color: #dc2626; background: #fef2f2; padding: 0.5rem; border-radius: 0.25rem; overflow: auto;">${error}</pre>
        </details>
      </div>
    </div>
  `;
}

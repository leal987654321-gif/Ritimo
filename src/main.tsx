import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log("Ritmo App initializing...");

window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global error caught:", { message, source, lineno, colno, error });
  
  // Use a delay to avoid interrupting React's own error recovery/cleanup
  setTimeout(() => {
    const root = document.getElementById('root');
    if (root && (root.innerHTML === "" || root.innerHTML.includes("initial-loading"))) {
      const errorDetails = error?.stack || `${message} em ${source}:${lineno}:${colno}`;
      root.innerHTML = `<div style="padding: 20px; color: #ef4444; font-family: sans-serif; max-width: 600px; margin: 40px auto; background: #fee2e2; border-radius: 12px; border: 1px solid #fecaca;">
        <h2 style="margin-top: 0;">Erro de Inicialização</h2>
        <p style="font-weight: bold;">${message}</p>
        <pre style="font-size: 11px; white-space: pre-wrap; word-break: break-all; background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #fecaca; max-height: 200px; overflow: auto; color: #333;">${errorDetails}</pre>
        <p>Tente recarregar a página ou verifique sua conexão com a internet. Se o problema persistir, pode haver um erro no código.</p>
        <button onclick="window.location.reload()" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">Recarregar</button>
      </div>`;
    }
  }, 100);
};

createRoot(document.getElementById('root')!).render(
  <App />
);

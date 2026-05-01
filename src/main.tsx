import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log("Ritmo App initializing...");

window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global error caught:", { message, source, lineno, colno, error });
  const root = document.getElementById('root');
  if (root && root.innerHTML === "") {
    root.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>Erro de Inicialização</h2>
      <p>${message}</p>
      <p>Tente recarregar a página ou verifique a conexão.</p>
    </div>`;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

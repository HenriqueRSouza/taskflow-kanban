import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento raiz da aplicação não encontrado.');
}

async function bootstrap(root: HTMLElement): Promise<void> {
  if (import.meta.env.DEV) {
    const seed = new URLSearchParams(window.location.search).get('seed');
    if (seed !== null && /^\d+$/.test(seed)) {
      const cardCount = Number(seed);
      if (Number.isSafeInteger(cardCount)) {
        const { seedBoard } = await import('./lib/devSeed');
        seedBoard(cardCount);
      }
    }
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap(rootElement);

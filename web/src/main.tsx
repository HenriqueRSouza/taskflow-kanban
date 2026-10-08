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
        // Quadro de teste vai para outra chave do localStorage: o quadro real e a
        // fila de sincronização ficam intocados.
        const { useBoardStore } = await import('./store/boardStore');
        useBoardStore.persist.setOptions({ name: 'taskflow-board-seed' });
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

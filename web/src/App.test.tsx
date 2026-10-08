import { render, screen } from '@testing-library/react';
import { App } from './App';

test('exibe o título e as três colunas do quadro', () => {
  render(<App />);

  expect(screen.getByRole('heading', { level: 1, name: 'TaskFlow' })).toBeInTheDocument();

  for (const title of ['A Fazer', 'Fazendo', 'Feito']) {
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
  }
});

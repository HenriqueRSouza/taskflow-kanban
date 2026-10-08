import { CardSchema, ColumnSchema, TagSchema } from '@taskflow/shared';
import { useBoardStore } from '../store/boardStore';
import { POSITION_STEP, rebalancedPositions } from './position';

export function seedBoard(cardCount: number): void {
  if (!Number.isSafeInteger(cardCount) || cardCount < 0) {
    throw new Error('A quantidade de cartões deve ser um inteiro não negativo.');
  }

  const titles = ['Backlog', 'A Fazer', 'Fazendo', 'Feito'];
  const positions = rebalancedPositions(titles.length);
  const columns = titles.map((title, index) => ColumnSchema.parse({
    id: crypto.randomUUID(),
    title,
    position: positions[index],
  }));
  const tags = [
    TagSchema.parse({ id: crypto.randomUUID(), name: 'Prioridade', color: 'red' }),
    TagSchema.parse({ id: crypto.randomUUID(), name: 'Melhoria', color: 'blue' }),
    TagSchema.parse({ id: crypto.randomUUID(), name: 'Revisão', color: 'green' }),
  ];
  const tasks = [
    'Revisar requisitos',
    'Desenhar a interface',
    'Implementar validações',
    'Escrever testes',
    'Investigar desempenho',
    'Atualizar documentação',
    'Conferir acessibilidade',
    'Preparar entrega',
  ];
  const timestamp = new Date().toISOString();
  const cards = Array.from({ length: cardCount }, (_, index) => {
    const column = columns[index % columns.length];
    if (!column) throw new Error('Coluna do quadro de teste não encontrada.');

    const tagOffset = Math.floor(index / 3) % tags.length;
    const tagIds = index % 3 === 0
      ? tags.filter((_, tagIndex) =>
        tagIndex === tagOffset || (index % 2 === 0 && tagIndex === (tagOffset + 1) % tags.length),
      ).map((tag) => tag.id)
      : [];

    return CardSchema.parse({
      id: crypto.randomUUID(),
      columnId: column.id,
      title: `Tarefa ${String(index + 1).padStart(3, '0')} — ${tasks[index % tasks.length]}`,
      description: null,
      tagIds,
      position: (Math.floor(index / columns.length) + 1) * POSITION_STEP,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  useBoardStore.getState().hydrate({ columns, cards, tags });
}

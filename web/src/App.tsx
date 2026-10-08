const exampleColumns = [
  {
    id: 'todo',
    title: 'A Fazer',
    cards: [
      { id: 'plan', title: 'Planejar as próximas tarefas', tag: 'Planejamento' },
      { id: 'review', title: 'Revisar os requisitos do quadro', tag: 'Revisão' },
    ],
  },
  {
    id: 'doing',
    title: 'Fazendo',
    cards: [
      { id: 'layout', title: 'Preparar a estrutura visual', tag: 'Interface' },
    ],
  },
  {
    id: 'done',
    title: 'Feito',
    cards: [
      { id: 'organize', title: 'Organizar as etapas do projeto', tag: 'Planejamento' },
    ],
  },
];

export function App() {
  return (
    <>
      <div className="h-9 text-[11px] text-white/80">
        <div className="mx-auto flex h-full max-w-[1440px] items-center px-4 sm:px-8">
          Quadro Kanban
        </div>
      </div>
      <main className="min-h-[calc(100dvh-2.25rem)] rounded-t-3xl bg-white text-ink">
        <header className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12">
          <h1 className="font-display text-3xl font-black uppercase tracking-tight sm:text-5xl">
            <span className="display-highlight">TaskFlow</span>
          </h1>
        </header>
        <section aria-label="Quadro de tarefas" className="mx-auto max-w-[1440px] px-4 pb-8 sm:px-8">
          <div className="flex snap-x gap-4 overflow-x-auto pb-4">
            {exampleColumns.map((column) => (
              <section key={column.id} aria-labelledby={`column-${column.id}`} className="w-[85vw] max-w-80 shrink-0 snap-start rounded-2xl bg-band p-3">
                <h2 id={`column-${column.id}`} className="px-1 pb-3 pt-1 text-sm font-semibold">
                  {column.title}
                </h2>
                <ul className="space-y-3">
                  {column.cards.map((card) => (
                    <li key={card.id} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <p className="mb-3 text-sm font-medium">{card.title}</p>
                      <span className="inline-block rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-ink">
                        {card.tag}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

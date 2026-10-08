import { useColumnOrder } from "../store/boardStore.ts";
import { Column } from "./Column.tsx";
import { AddColumnForm } from "./AddColumnForm.tsx";

export function Board() {
  // O Board só conhece a ORDEM das colunas; cada Column busca os próprios dados.
  const columnOrder = useColumnOrder();

  return (
    <section aria-label="Quadro de tarefas" className="mx-auto max-w-[1440px] px-4 pb-8 sm:px-8">
      <div className="flex snap-x items-start gap-4 overflow-x-auto pb-4">
        {columnOrder.map((columnId) => (
          <Column key={columnId} id={columnId} />
        ))}
        <AddColumnForm />
      </div>
    </section>
  );
}

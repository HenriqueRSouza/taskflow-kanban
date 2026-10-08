import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useBoardDnd } from "../hooks/useBoardDnd.ts";
import { useColumnOrder } from "../store/boardStore.ts";
import { AddColumnForm } from "./AddColumnForm.tsx";
import { CardPreview } from "./CardPreview.tsx";
import { Column } from "./Column.tsx";
import { ColumnPreview } from "./ColumnPreview.tsx";

export function Board() {
  // O Board só conhece a ORDEM das colunas; cada Column busca os próprios dados.
  const columnOrder = useColumnOrder();
  const { active, contextProps } = useBoardDnd();

  return (
    <section aria-label="Quadro de tarefas" className="mx-auto max-w-[1440px] px-4 pb-8 sm:px-8">
      {/* DndContext: "área" onde arrastar funciona; recebe sensores e os handlers. */}
      <DndContext {...contextProps}>
        <div className="flex snap-x items-start gap-4 overflow-x-auto pb-4">
          {/* SortableContext: as colunas formam uma lista ordenável na horizontal. */}
          <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
            {columnOrder.map((columnId) => (
              <Column key={columnId} id={columnId} />
            ))}
          </SortableContext>
          <AddColumnForm />
        </div>

        {/* DragOverlay: a cópia que segue o cursor/dedo enquanto arrasta. */}
        <DragOverlay>
          {active?.type === "card" && <CardPreview id={active.id} />}
          {active?.type === "column" && <ColumnPreview id={active.id} />}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

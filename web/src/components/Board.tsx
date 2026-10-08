import { createPortal } from "react-dom";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useBoardDnd } from "../hooks/useBoardDnd.ts";
import { useColumnOrder } from "../store/boardStore.ts";
import { useCardDetailsStore } from "../store/uiStore.ts";
import { AddColumnForm } from "./AddColumnForm.tsx";
import { CardDetails } from "./CardDetails.tsx";
import { CardPreview } from "./CardPreview.tsx";
import { Column } from "./Column.tsx";
import { ColumnPreview } from "./ColumnPreview.tsx";
import { TagFilterBar } from "./TagFilterBar.tsx";

export function Board() {
  // O Board só conhece a ORDEM das colunas; cada Column busca os próprios dados.
  const columnOrder = useColumnOrder();
  const { active, contextProps } = useBoardDnd();
  const openCardId = useCardDetailsStore((s) => s.openCardId);
  const closeCard = useCardDetailsStore((s) => s.closeCard);

  return (
    <section aria-label="Quadro de tarefas" className="mx-auto max-w-[1440px] px-4 pb-8 sm:px-8">
      <TagFilterBar />
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

      {/*
        Painel de detalhes: renderizado aqui (e não no Card) para não fechar se o
        cartão for escondido pelo filtro; vai para o <body> via portal, fora da
        árvore de arrasto. `key` recria o painel ao trocar de cartão.
      */}
      {openCardId &&
        createPortal(<CardDetails key={openCardId} id={openCardId} onClose={closeCard} />, document.body)}
    </section>
  );
}

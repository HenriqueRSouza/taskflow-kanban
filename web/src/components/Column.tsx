import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ColumnId } from "@taskflow/shared";
import { useInlineEdit } from "../hooks/useInlineEdit.ts";
import { useBoardStore, useCardIds, useColumn } from "../store/boardStore.ts";
import { AddCardForm } from "./AddCardForm.tsx";
import { Card } from "./Card.tsx";

export function Column({ id }: { id: ColumnId }) {
  const column = useColumn(id);
  // Só a lista de IDs: a coluna re-renderiza quando um cartão entra, sai ou muda
  // de ordem — editar o título de um cartão NÃO re-renderiza a coluna.
  const cardIds = useCardIds(id);
  const renameColumn = useBoardStore((s) => s.renameColumn);
  const removeColumn = useBoardStore((s) => s.removeColumn);

  const title = useInlineEdit(column?.title ?? "", (next) => renameColumn(id, next));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "column", id },
    disabled: title.isEditing,
  });

  if (!column) return null;

  function handleRemove() {
    const message = `Excluir a coluna "${column?.title}" e seus ${cardIds.length} cartões?`;
    if (cardIds.length === 0 || window.confirm(message)) removeColumn(id);
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-2xl bg-band p-3 ${isDragging ? "opacity-40" : ""}`}
    >
      <header {...attributes} {...listeners} className="flex touch-manipulation items-center gap-2 px-1 pb-3 pt-1">
        <h2 className="flex-1 text-sm font-semibold">
          {title.isEditing ? (
            <input
              {...title.inputProps}
              aria-label="Título da coluna"
              className="w-full rounded-lg border border-ink bg-white px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500"
            />
          ) : (
            <button type="button" onClick={title.startEditing} className="w-full text-left">
              {column.title}
            </button>
          )}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
          {cardIds.length}
        </span>
        <button
          type="button"
          onClick={handleRemove}
          aria-label={`Excluir coluna ${column.title}`}
          className="rounded-full px-2 text-neutral-500 transition hover:bg-white hover:text-ink"
        >
          ×
        </button>
      </header>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <ul className="min-h-2 space-y-3">
          {cardIds.map((cardId) => (
            // key: identidade estável para o React saber qual item é qual ao reordenar.
            <Card key={cardId} id={cardId} />
          ))}
        </ul>
      </SortableContext>

      <AddCardForm columnId={id} />
    </section>
  );
}

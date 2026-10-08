import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ColumnId } from "@taskflow/shared";
import { useShallow } from "zustand/react/shallow";
import { useInlineEdit } from "../hooks/useInlineEdit.ts";
import { useBoardStore, useColumn } from "../store/boardStore.ts";
import { useFilterStore } from "../store/filterStore.ts";
import { AddCardForm } from "./AddCardForm.tsx";
import { Card } from "./Card.tsx";

export function Column({ id }: { id: ColumnId }) {
  const column = useColumn(id);
  const tagIds = useFilterStore((state) => state.tagIds);
  const total = useBoardStore((state) => (state.cardOrder[id] ?? []).length);
  const hasFilter = useBoardStore((state) => tagIds.some((tagId) => state.tags[tagId] !== undefined));
  // Ignora etiquetas removidas; useShallow mantém a referência se os IDs não mudam.
  const cardIds = useBoardStore(useShallow((state) => {
    const ids = state.cardOrder[id] ?? [];
    const activeTagIds = tagIds.filter((tagId) => state.tags[tagId] !== undefined);
    if (activeTagIds.length === 0) return ids;
    return ids.filter((cardId) => state.cards[cardId]?.tagIds.some((tagId) => activeTagIds.includes(tagId)));
  }));
  const renameColumn = useBoardStore((s) => s.renameColumn);
  const removeColumn = useBoardStore((s) => s.removeColumn);

  const title = useInlineEdit(column?.title ?? "", (next) => renameColumn(id, next));

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "column", id },
    disabled: title.isEditing,
  });

  if (!column) return null;

  function handleRemove() {
    const message = `Excluir a coluna "${column?.title}" e seus ${total} cartões?`;
    if (total === 0 || window.confirm(message)) removeColumn(id);
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-2xl bg-band p-3 ${isDragging ? "opacity-40" : ""}`}
    >
      <header ref={setActivatorNodeRef} {...attributes} {...listeners} className="flex touch-manipulation items-center gap-2 px-1 pb-3 pt-1">
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
        <span
          aria-label={hasFilter ? `${cardIds.length} de ${total} cartões visíveis` : undefined}
          className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-600"
        >
          {hasFilter ? `${cardIds.length}/${total}` : total}
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

      {hasFilter && cardIds.length === 0 && (
        <p className="px-1 py-3 text-xs text-neutral-500">Nenhum cartão com essa etiqueta</p>
      )}

      <AddCardForm columnId={id} />
    </section>
  );
}

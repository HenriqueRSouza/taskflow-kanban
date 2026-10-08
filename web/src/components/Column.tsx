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

  if (!column) return null;

  function handleRemove() {
    const message = `Excluir a coluna "${column?.title}" e seus ${cardIds.length} cartões?`;
    if (cardIds.length === 0 || window.confirm(message)) removeColumn(id);
  }

  return (
    <section className="flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-2xl bg-band p-3">
      <header className="flex items-center gap-2 px-1 pb-3 pt-1">
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

      <ul className="space-y-3">
        {cardIds.map((cardId) => (
          // key: identidade estável para o React saber qual item é qual ao reordenar.
          <Card key={cardId} id={cardId} />
        ))}
      </ul>

      <AddCardForm columnId={id} />
    </section>
  );
}

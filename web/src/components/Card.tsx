import type { CardId } from "@taskflow/shared";
import { useInlineEdit } from "../hooks/useInlineEdit.ts";
import { useBoardStore, useCard } from "../store/boardStore.ts";
import { TagChip } from "./TagChip.tsx";

export function Card({ id }: { id: CardId }) {
  // Seletor: este componente só re-renderiza quando ESTE cartão muda.
  const card = useCard(id);
  const updateCard = useBoardStore((s) => s.updateCard);
  const removeCard = useBoardStore((s) => s.removeCard);

  // Hooks sempre no topo, antes de qualquer `return` (regra dos hooks).
  const title = useInlineEdit(card?.title ?? "", (next) => updateCard(id, { title: next }));

  if (!card) return null;

  return (
    <li className="group rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-ink">
      <div className="flex items-start gap-2">
        {title.isEditing ? (
          <input
            {...title.inputProps}
            aria-label="Título do cartão"
            className="w-full rounded-lg border border-ink px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
        ) : (
          <button
            type="button"
            onClick={title.startEditing}
            className="flex-1 text-left text-sm font-medium break-words"
          >
            {card.title}
          </button>
        )}

        <button
          type="button"
          onClick={() => removeCard(id)}
          aria-label={`Excluir cartão ${card.title}`}
          className="shrink-0 rounded-full px-2 text-neutral-400 transition hover:bg-band hover:text-ink focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          ×
        </button>
      </div>

      {card.tagIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tagIds.map((tagId) => (
            <TagChip key={tagId} id={tagId} />
          ))}
        </div>
      )}
    </li>
  );
}

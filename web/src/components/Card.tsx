import { useState } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CardId } from "@taskflow/shared";
import { useInlineEdit } from "../hooks/useInlineEdit.ts";
import { useBoardStore, useCard } from "../store/boardStore.ts";
import { CardDetails } from "./CardDetails.tsx";
import { TagChip } from "./TagChip.tsx";

export function Card({ id }: { id: CardId }) {
  // Seletor: este componente só re-renderiza quando ESTE cartão muda.
  const card = useCard(id);
  const updateCard = useBoardStore((s) => s.updateCard);
  const removeCard = useBoardStore((s) => s.removeCard);

  // Hooks sempre no topo, antes de qualquer `return` (regra dos hooks).
  const title = useInlineEdit(card?.title ?? "", (next) => updateCard(id, { title: next }));
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "card", id },
    disabled: title.isEditing || isDetailsOpen,
  });

  if (!card) return null;

  return (
    <>
      <li
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        {...listeners}
        className={`group touch-manipulation rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm hover:border-ink ${
          isDragging ? "opacity-40" : ""
        }`}
      >
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
            onClick={() => setIsDetailsOpen(true)}
            aria-label={`Abrir detalhes do cartão ${card.title}`}
            className="shrink-0 rounded-full p-1.5 text-neutral-400 transition hover:bg-band hover:text-ink focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
              <path d="M9 2h5v5M14 2 8 8M7 3H3v10h10V9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => removeCard(id)}
            aria-label={`Excluir cartão ${card.title}`}
            className="shrink-0 rounded-full px-2 text-neutral-400 transition hover:bg-band hover:text-ink focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            ×
          </button>
        </div>

        {(card.tagIds.length > 0 || card.description) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {card.tagIds.map((tagId) => (
              <TagChip key={tagId} id={tagId} />
            ))}
            {card.description && (
              <span title="Este cartão tem descrição" className="ml-auto text-neutral-400">
                <svg viewBox="0 0 16 16" aria-label="Tem descrição" role="img" className="h-3.5 w-3.5">
                  <path d="M3 4h10M3 8h10M3 12h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            )}
          </div>
        )}
      </li>

      {/*
        O painel vai para o <body> (portal) e fica FORA do <li>: assim cliques e
        teclas dentro dele não chegam aos listeners de arrasto do cartão.
      */}
      {isDetailsOpen && createPortal(<CardDetails id={id} onClose={() => setIsDetailsOpen(false)} />, document.body)}
    </>
  );
}

import type { CardId } from "@taskflow/shared";
import { useCard } from "../store/boardStore.ts";
import { TagChip } from "./TagChip.tsx";

/**
 * Cópia do cartão que "flutua" sob o cursor/dedo durante o arrasto (DragOverlay).
 * É só visual: não tem edição nem useSortable, por isso é um componente separado.
 */
export function CardPreview({ id }: { id: CardId }) {
  const card = useCard(id);
  if (!card) return null;

  return (
    <div className="rotate-2 cursor-grabbing rounded-2xl border border-ink bg-white p-3 shadow-xl">
      <p className="text-sm font-medium break-words">{card.title}</p>
      {card.tagIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tagIds.map((tagId) => (
            <TagChip key={tagId} id={tagId} />
          ))}
        </div>
      )}
    </div>
  );
}

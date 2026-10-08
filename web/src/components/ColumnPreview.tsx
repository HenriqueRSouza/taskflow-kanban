import type { ColumnId } from "@taskflow/shared";
import { useCardIds, useColumn } from "../store/boardStore.ts";

/** Cópia simplificada da coluna exibida durante o arrasto de colunas. */
export function ColumnPreview({ id }: { id: ColumnId }) {
  const column = useColumn(id);
  const cardIds = useCardIds(id);
  if (!column) return null;

  return (
    <div className="w-[85vw] max-w-80 rotate-1 cursor-grabbing rounded-2xl border border-ink bg-band p-3 shadow-xl">
      <div className="flex items-center gap-2 px-1 pt-1">
        <h2 className="flex-1 text-sm font-semibold">{column.title}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
          {cardIds.length}
        </span>
      </div>
    </div>
  );
}

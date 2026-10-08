import { useTags } from "../store/boardStore.ts";
import { useFilterStore } from "../store/filterStore.ts";
import { TAG_COLOR_CLASSES } from "../lib/tagColors.ts";

export function TagFilterBar() {
  const tags = useTags();
  const tagIds = useFilterStore((state) => state.tagIds);
  const toggleTag = useFilterStore((state) => state.toggleTag);
  const clear = useFilterStore((state) => state.clear);
  const boardTags = Object.values(tags);
  const hasSelection = tagIds.some((id) => tags[id] !== undefined);

  if (boardTags.length === 0) return null;

  return (
    <div role="group" aria-label="Filtrar cartões por etiqueta" className="mb-4 flex items-center gap-2 overflow-x-auto py-2">
      <span className="shrink-0 text-sm text-neutral-600">Filtrar:</span>
      {boardTags.map((tag) => {
        const selected = tagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleTag(tag.id)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TAG_COLOR_CLASSES[tag.color]} ${
              selected ? "ring-2 ring-ink ring-offset-1" : "opacity-60 hover:opacity-100"
            }`}
          >
            {tag.name}
          </button>
        );
      })}
      {hasSelection && (
        <button type="button" onClick={clear} className="shrink-0 rounded-full px-2.5 py-1 text-sm text-neutral-600 hover:text-ink">
          Limpar filtro
        </button>
      )}
    </div>
  );
}

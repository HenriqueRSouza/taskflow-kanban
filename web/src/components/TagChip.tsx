import type { TagId } from "@taskflow/shared";
import { useTag } from "../store/boardStore.ts";
import { TAG_COLOR_CLASSES } from "../lib/tagColors.ts";

export function TagChip({ id }: { id: TagId }) {
  const tag = useTag(id);
  if (!tag) return null;

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${TAG_COLOR_CLASSES[tag.color]}`}>
      {tag.name}
    </span>
  );
}

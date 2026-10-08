import type { TagColor, TagId } from "@taskflow/shared";
import { useTag } from "../store/boardStore.ts";

// Record<TagColor, string> obriga a ter uma classe para CADA cor do tipo:
// se alguém adicionar uma cor nova em @taskflow/shared, isto deixa de compilar.
const COLOR_CLASSES: Record<TagColor, string> = {
  yellow: "bg-brand-500 text-ink",
  black: "bg-ink text-white",
  gray: "bg-band text-ink",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
};

export function TagChip({ id }: { id: TagId }) {
  const tag = useTag(id);
  if (!tag) return null;

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${COLOR_CLASSES[tag.color]}`}>
      {tag.name}
    </span>
  );
}

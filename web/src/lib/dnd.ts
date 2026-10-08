import { z } from "zod";
import { CardIdSchema, ColumnIdSchema } from "@taskflow/shared";

/*
 * "Etiqueta" que cada item arrastável carrega no `data` do useSortable.
 * O @dnd-kit não sabe o que é cartão ou coluna; com isto o Board sabe
 * o que está sendo arrastado e sobre o que foi solto.
 *
 * Uso no Card:   useSortable({ id, data: { type: "card", id } })
 * Uso na Column: useSortable({ id, data: { type: "column", id } })
 */
export const DragDataSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("card"), id: CardIdSchema }),
  z.object({ type: z.literal("column"), id: ColumnIdSchema }),
]);

export type DragData = z.infer<typeof DragDataSchema>;

/** Lê o `data` de um item do @dnd-kit com segurança (ele é tipado como `any`). */
export function readDragData(data: unknown): DragData | null {
  const result = DragDataSchema.safeParse(data);
  return result.success ? result.data : null;
}

import { z } from "zod";
import { CardIdSchema, ColumnIdSchema, TagIdSchema } from "@taskflow/shared";
import type { BoardData } from "../store/boardStore.ts";

/** Uma entidade que mudou localmente e precisa ser enviada ao servidor. */
export const DirtySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("column"), id: ColumnIdSchema }),
  z.object({ kind: z.literal("card"), id: CardIdSchema }),
  z.object({ kind: z.literal("tag"), id: TagIdSchema }),
]);

export type Dirty = z.infer<typeof DirtySchema>;

/** Chave única por entidade (ex.: "card:1234…"), usada para não enfileirar repetido. */
export const dirtyKey = (item: Dirty): string => `${item.kind}:${item.id}`;

/**
 * Compara dois estados do quadro e devolve o que mudou.
 *
 * Funciona por REFERÊNCIA: o store nunca altera um objeto, sempre cria um novo.
 * Então `antes !== depois` significa "este cartão foi criado, editado ou
 * removido" — sem comparar campo a campo.
 */
export function diffBoard(prev: BoardData, next: BoardData): Dirty[] {
  const changed: Dirty[] = [];
  for (const id of changedIds(prev.columns, next.columns)) changed.push({ kind: "column", id });
  for (const id of changedIds(prev.tags, next.tags)) changed.push({ kind: "tag", id });
  for (const id of changedIds(prev.cards, next.cards)) changed.push({ kind: "card", id });
  return changed;
}

function changedIds<Id extends string, T>(prev: Record<Id, T>, next: Record<Id, T>): Id[] {
  if (prev === next) return [];
  const ids = new Set<Id>([...keysOf(prev), ...keysOf(next)]);
  return [...ids].filter((id) => prev[id] !== next[id]);
}

// Object.keys perde o tipo da chave (vira string[]); aqui ele é recuperado.
function keysOf<Id extends string>(record: Record<Id, unknown>): Id[] {
  return Object.keys(record) as Id[];
}

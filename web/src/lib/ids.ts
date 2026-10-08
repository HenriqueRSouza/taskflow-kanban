import { CardIdSchema, ColumnIdSchema, TagIdSchema } from "@taskflow/shared";
import type { CardId, ColumnId, TagId } from "@taskflow/shared";

/*
 * IDs gerados no próprio navegador: o item aparece na tela na hora (UI
 * otimista) e a API recebe o mesmo ID depois. O `parse` aplica a "marca" do
 * tipo sem precisar de cast.
 */
export const newColumnId = (): ColumnId => ColumnIdSchema.parse(crypto.randomUUID());
export const newCardId = (): CardId => CardIdSchema.parse(crypto.randomUUID());
export const newTagId = (): TagId => TagIdSchema.parse(crypto.randomUUID());

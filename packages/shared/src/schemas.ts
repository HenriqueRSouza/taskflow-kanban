import { z } from "zod";

/*
 * Fonte única da verdade dos dados do TaskFlow.
 * Os tipos TypeScript são derivados destes schemas (z.infer), então front-end
 * e API validam e tipam exatamente a mesma coisa.
 */

// IDs "marcados" (branded): impedem passar o ID de um cartão onde se espera o
// de uma coluna, mesmo sendo todos strings em tempo de execução.
export const BoardIdSchema = z.uuid().brand<"BoardId">();
export const ColumnIdSchema = z.uuid().brand<"ColumnId">();
export const CardIdSchema = z.uuid().brand<"CardId">();
export const TagIdSchema = z.uuid().brand<"TagId">();

export const TAG_COLORS = ["yellow", "black", "gray", "green", "red", "blue"] as const;
export const TagColorSchema = z.enum(TAG_COLORS);

export const TITLE_LIMITS = { column: 80, card: 200, tag: 30 } as const;

const title = (max: number) => z.string().trim().min(1, "Título obrigatório").max(max);

export const TagSchema = z.object({
  id: TagIdSchema,
  name: title(TITLE_LIMITS.tag),
  color: TagColorSchema,
});

export const ColumnSchema = z.object({
  id: ColumnIdSchema,
  title: title(TITLE_LIMITS.column),
  position: z.number().finite(),
});

export const CardSchema = z.object({
  id: CardIdSchema,
  columnId: ColumnIdSchema,
  title: title(TITLE_LIMITS.card),
  description: z.string().max(5000).nullable(),
  tagIds: z.array(TagIdSchema),
  position: z.number().finite(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

/** Resposta de GET /api/board: o quadro inteiro em listas "planas". */
export const BoardSnapshotSchema = z.object({
  id: BoardIdSchema,
  title: z.string(),
  columns: z.array(ColumnSchema),
  cards: z.array(CardSchema),
  tags: z.array(TagSchema),
});

// ---- Corpos de requisição da API ----
// Escrita por "upsert": PUT /api/<recurso>/:id com o objeto completo cria ou
// atualiza. Repetir a mesma requisição dá o mesmo resultado (idempotente), o que
// permite ao front reenviar com segurança depois de uma falha de rede.
// O ID vem da URL; o cliente gera os UUIDs (crypto.randomUUID).

export const UpsertColumnSchema = ColumnSchema.omit({ id: true });

export const UpsertCardSchema = CardSchema.omit({ id: true, createdAt: true, updatedAt: true });

export const UpsertTagSchema = TagSchema.omit({ id: true });

export const ApiErrorSchema = z.object({ error: z.string() });

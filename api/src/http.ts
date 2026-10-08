import type { Request } from "express";
import type { z } from "zod";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function parseBody<T>(schema: z.ZodType<T>, req: Pick<Request, "body">): T {
  const body: unknown = req.body;
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message ?? "Corpo inválido");
  }
  return result.data;
}

export function parseId<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, "ID inválido");
  return result.data;
}

export function mapPostgresError(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23503") {
      return new HttpError(409, "Coluna ou etiqueta inexistente");
    }
    if (error.code === "23514") {
      return new HttpError(400, "Dados violam uma restrição do banco");
    }
  }
  return error;
}

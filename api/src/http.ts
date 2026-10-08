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

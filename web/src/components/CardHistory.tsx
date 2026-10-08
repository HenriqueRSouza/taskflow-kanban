import { useEffect, useState } from "react";
import type { CardEvent, CardId } from "@taskflow/shared";
import { boardRepository } from "../data/sync.ts";
import { useSyncStore } from "../data/syncEngine.ts";
import { useCard } from "../store/boardStore.ts";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

// União discriminada: em cada estado só existem os campos que fazem sentido.
type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; events: CardEvent[] };

/** Linha do tempo do cartão: quando foi criado e cada troca de coluna (dados do banco). */
export function CardHistory({ cardId }: { cardId: CardId }) {
  const columnId = useCard(cardId)?.columnId;
  // Quando a fila termina de enviar, lastSyncedAt muda: é a hora de buscar de novo,
  // porque o banco acabou de registrar a movimentação.
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const [state, setState] = useState<HistoryState>({ status: "loading" });

  useEffect(() => {
    // Se o efeito rodar de novo (ou o painel fechar) antes da resposta chegar,
    // a resposta antiga é ignorada — evita mostrar dados de uma busca velha.
    let ignore = false;
    boardRepository
      .fetchCardHistory(cardId)
      .then((events) => !ignore && setState({ status: "ready", events }))
      .catch((error: unknown) => {
        if (ignore) return;
        const notSyncedYet = error instanceof Error && error.message === "Cartão não encontrado";
        setState({
          status: "error",
          message: notSyncedYet ? "O cartão ainda não foi salvo no servidor." : "Histórico indisponível (sem conexão).",
        });
      });
    return () => {
      ignore = true;
    };
  }, [cardId, columnId, lastSyncedAt]);

  if (state.status === "loading") return <p className="text-sm text-neutral-500">Carregando histórico…</p>;
  if (state.status === "error") return <p className="text-sm text-neutral-500">{state.message}</p>;

  return (
    <ol className="relative space-y-3 border-l-2 border-band pl-4">
      {state.events.map((event) => (
        <li key={event.id} className="relative text-sm">
          <span
            aria-hidden="true"
            className={`absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-white ${
              event.type === "created" ? "bg-brand-500" : "bg-ink"
            }`}
          />
          <time dateTime={event.occurredAt} className="block text-xs font-medium text-neutral-500">
            {dateFormat.format(new Date(event.occurredAt))}
          </time>
          {event.type === "created" ? (
            <span>
              Criado em <strong>{event.toColumnTitle}</strong>
            </span>
          ) : (
            <span>
              Movido de <strong>{event.fromColumnTitle}</strong> para <strong>{event.toColumnTitle}</strong>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

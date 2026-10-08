import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { TITLE_LIMITS } from "@taskflow/shared";
import type { CardId } from "@taskflow/shared";
import { useBoardStore, useCard } from "../store/boardStore.ts";
import { CardHistory } from "./CardHistory.tsx";
import { TagPicker } from "./TagPicker.tsx";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Painel de detalhes do cartão: título, descrição, etiquetas e datas.
 *
 * Usa o <dialog> nativo do HTML aberto com showModal(), que já entrega:
 * foco preso dentro do painel, Esc para fechar e o resto da página inerte.
 */
export function CardDetails({ id, onClose }: { id: CardId; onClose: () => void }) {
  const card = useCard(id);
  const columnTitle = useBoardStore((s) => (card ? s.columns[card.columnId]?.title : undefined));
  const updateCard = useBoardStore((s) => s.updateCard);
  const removeCard = useBoardStore((s) => s.removeCard);

  // Rascunhos locais: digitar não altera o store (nem dispara envio ao servidor)
  // a cada tecla; só ao sair do campo ou fechar o painel.
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");

  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // O cartão mudou por fora (outra aba, servidor) enquanto o painel está aberto:
  // atualiza o rascunho — a não ser que o usuário esteja digitando naquele campo.
  const storedTitle = card?.title;
  const storedDescription = card?.description;
  useEffect(() => {
    if (storedTitle !== undefined && document.activeElement !== titleRef.current) setTitle(storedTitle);
  }, [storedTitle]);
  useEffect(() => {
    if (document.activeElement !== descriptionRef.current) setDescription(storedDescription ?? "");
  }, [storedDescription]);

  // Abre o <dialog> como modal assim que ele existe no DOM; fecha ao desmontar.
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  // Se o cartão deixou de existir (excluído aqui ou por outra aba), fecha o painel.
  useEffect(() => {
    if (!card) onClose();
  }, [card, onClose]);

  if (!card) return null;

  function save() {
    if (!card) return;
    const changes: { title?: string; description?: string | null } = {};
    if (title.trim() && title.trim() !== card.title) changes.title = title;
    if ((description.trim() || null) !== card.description) changes.description = description;
    if (Object.keys(changes).length > 0) updateCard(id, changes);
  }

  function close() {
    save();
    onClose();
  }

  // Clique no fundo escurecido (fora da caixa) fecha. O alvo é o próprio <dialog>
  // só quando o clique acontece fora do conteúdo interno.
  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) close();
  }

  function handleDelete() {
    if (window.confirm(`Excluir o cartão "${card?.title}"?`)) removeCard(id);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="card-details-title"
      // onCancel = Esc. preventDefault para fechar pelo nosso close(), que salva antes.
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={handleBackdropClick}
      className="m-auto max-h-[90dvh] w-[min(100%-2rem,34rem)] overflow-y-auto rounded-3xl bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/60 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-neutral-500">Na coluna {columnTitle ?? "—"}</p>
            <h2 id="card-details-title" className="sr-only">
              Detalhes do cartão
            </h2>
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={save}
              onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              maxLength={TITLE_LIMITS.card}
              aria-label="Título do cartão"
              className="mt-1 w-full rounded-lg border border-transparent px-1 py-1 font-display text-xl font-extrabold tracking-tight hover:border-neutral-200 focus:border-ink focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar detalhes"
            className="rounded-full px-3 py-1 text-xl text-neutral-500 transition hover:bg-band hover:text-ink"
          >
            ×
          </button>
        </header>

        <section className="space-y-2">
          <label htmlFor="card-description" className="text-sm font-semibold">
            Descrição
          </label>
          <textarea
            ref={descriptionRef}
            id="card-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={save}
            rows={5}
            maxLength={5000}
            placeholder="Adicione mais detalhes sobre esta tarefa…"
            className="w-full resize-y rounded-xl border border-neutral-300 bg-tile px-3 py-2 text-sm leading-relaxed focus:border-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Etiquetas</h3>
          <TagPicker cardId={id} />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Histórico</h3>
          <CardHistory cardId={id} />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          <p>
            Criado em {dateFormat.format(new Date(card.createdAt))} · Atualizado em{" "}
            {dateFormat.format(new Date(card.updatedAt))}
          </p>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full border border-red-200 px-4 py-2 font-semibold text-red-700 transition hover:bg-red-50"
          >
            Excluir cartão
          </button>
        </footer>
      </div>
    </dialog>
  );
}

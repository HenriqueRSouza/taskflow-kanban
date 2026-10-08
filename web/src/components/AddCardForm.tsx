import { useState } from "react";
import type { FormEvent } from "react";
import type { ColumnId } from "@taskflow/shared";
import { useBoardStore } from "../store/boardStore.ts";

export function AddCardForm({ columnId }: { columnId: ColumnId }) {
  // Estado local: só este formulário precisa saber se está aberto e o que foi digitado.
  // Por isso fica em useState, e não no store global.
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // impede o navegador de recarregar a página
    // getState(): lê o store dentro de um evento, sem "assinar" mudanças
    // (o formulário não precisa re-renderizar quando o quadro muda).
    const createdId = useBoardStore.getState().addCard(columnId, title);
    if (createdId) setTitle(""); // limpa e mantém aberto para adicionar outro
  }

  function close() {
    setTitle("");
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 w-full rounded-xl px-2 py-2 text-left text-sm font-medium text-neutral-600 transition hover:bg-white hover:text-ink"
      >
        + Adicionar cartão
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && close()}
        placeholder="Título do cartão"
        aria-label="Título do novo cartão"
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-brand-500"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 hover:text-ink disabled:opacity-40"
        >
          Adicionar
        </button>
        <button type="button" onClick={close} className="rounded-full px-4 py-2 text-sm font-medium hover:bg-white">
          Cancelar
        </button>
      </div>
    </form>
  );
}

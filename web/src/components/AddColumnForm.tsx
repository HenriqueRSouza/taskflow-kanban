import { useState } from "react";
import type { FormEvent } from "react";
import { useBoardStore } from "../store/boardStore.ts";

export function AddColumnForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    useBoardStore.getState().addColumn(title);
    setTitle("");
    setIsOpen(false);
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
        className="w-[85vw] max-w-80 shrink-0 snap-start rounded-2xl border-2 border-dashed border-neutral-300 px-4 py-3 text-left text-sm font-semibold text-neutral-600 transition hover:border-ink hover:bg-tile hover:text-ink"
      >
        + Adicionar coluna
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-[85vw] max-w-80 shrink-0 snap-start space-y-2 rounded-2xl bg-band p-3"
    >
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && close()}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-brand-500"
        placeholder="Nome da coluna"
        aria-label="Nome da nova coluna"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 hover:text-ink disabled:opacity-40"
        >
          Adicionar
        </button>
        <button
          type="button"
          onClick={close}
          className="rounded-full px-4 py-2 text-sm font-medium transition hover:bg-white"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
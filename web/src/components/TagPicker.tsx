import { useState } from "react";
import type { FormEvent } from "react";
import { TAG_COLORS, TITLE_LIMITS } from "@taskflow/shared";
import type { CardId, TagColor, TagId } from "@taskflow/shared";
import { TAG_COLOR_CLASSES, TAG_COLOR_LABELS } from "../lib/tagColors.ts";
import { useBoardStore, useCard, useTags } from "../store/boardStore.ts";

/**
 * Lista todas as etiquetas do quadro com uma caixa de seleção para o cartão,
 * e um formulário para criar etiquetas novas (já aplicadas ao cartão).
 */
export function TagPicker({ cardId }: { cardId: CardId }) {
  const card = useCard(cardId);
  const tags = useTags();
  const toggleCardTag = useBoardStore((s) => s.toggleCardTag);
  const removeTag = useBoardStore((s) => s.removeTag);

  // Estado local do formulário de nova etiqueta.
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("yellow");

  if (!card) return null;
  const allTags = Object.values(tags).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { createTag } = useBoardStore.getState();
    const tagId = createTag(name, color);
    if (tagId) {
      toggleCardTag(cardId, tagId); // a etiqueta nova já entra no cartão
      setName("");
    }
  }

  function handleRemove(tagId: TagId, tagName: string) {
    if (window.confirm(`Excluir a etiqueta "${tagName}" de todos os cartões?`)) removeTag(tagId);
  }

  return (
    <div className="space-y-3">
      {allTags.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma etiqueta ainda. Crie a primeira abaixo.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const checked = card.tagIds.includes(tag.id);
            return (
              <li key={tag.id} className="flex items-center">
                <label
                  className={`flex cursor-pointer items-center gap-1.5 rounded-l-full py-1 pl-2.5 pr-2 text-xs font-semibold transition ${
                    TAG_COLOR_CLASSES[tag.color]
                  } ${checked ? "" : "opacity-50 hover:opacity-100"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCardTag(cardId, tag.id)}
                    className="h-3.5 w-3.5 accent-ink"
                  />
                  {tag.name}
                </label>
                <button
                  type="button"
                  onClick={() => handleRemove(tag.id, tag.name)}
                  aria-label={`Excluir etiqueta ${tag.name}`}
                  className={`rounded-r-full py-1 pl-1 pr-2 text-xs transition ${TAG_COLOR_CLASSES[tag.color]} ${
                    checked ? "" : "opacity-50"
                  } hover:opacity-100`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleCreate} className="space-y-2 rounded-2xl bg-tile p-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={TITLE_LIMITS.tag}
            placeholder="Nova etiqueta"
            aria-label="Nome da nova etiqueta"
            className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 hover:text-ink disabled:opacity-40"
          >
            Criar
          </button>
        </div>

        {/* Grupo de rádios: escolher UMA cor. fieldset + legend dão o nome do grupo ao leitor de tela. */}
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Cor da etiqueta</legend>
          {TAG_COLORS.map((option) => (
            <label key={option} title={TAG_COLOR_LABELS[option]} className="cursor-pointer">
              <input
                type="radio"
                name="tag-color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
                className="peer sr-only"
              />
              <span className="sr-only">{TAG_COLOR_LABELS[option]}</span>
              <span
                aria-hidden="true"
                className={`block h-6 w-6 rounded-full border border-neutral-300 ${
                  TAG_COLOR_CLASSES[option]
                } peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-ink`}
              />
            </label>
          ))}
        </fieldset>
      </form>
    </div>
  );
}

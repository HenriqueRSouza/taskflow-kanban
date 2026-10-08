import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

/**
 * Edição inline: clicar no texto troca por um input.
 * Enter ou sair do campo salva; Esc cancela.
 *
 * É um hook customizado: junta useState, useRef e useEffect numa função que
 * pode ser reutilizada pela Column (título da coluna) e pelo Card (título do cartão).
 */
export function useInlineEdit(value: string, onSave: (next: string) => void) {
  // Estado: está editando? Quando muda, o componente re-renderiza mostrando o input.
  const [isEditing, setIsEditing] = useState(false);
  // Estado: o texto que está sendo digitado (rascunho), separado do valor salvo.
  const [draft, setDraft] = useState(value);

  // Ref: acesso direto ao <input> do DOM, para dar foco. Mudar uma ref NÃO re-renderiza.
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref: marca que o usuário apertou Esc, para o onBlur não salvar logo em seguida.
  const cancelledRef = useRef(false);

  // Efeito: roda DEPOIS que o React desenhou a tela. Quando isEditing vira true,
  // o input acabou de aparecer no DOM e já pode receber foco.
  // O array [isEditing] diz ao React para rodar o efeito só quando esse valor mudar.
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function startEditing() {
    cancelledRef.current = false;
    setDraft(value);
    setIsEditing(true);
  }

  function save() {
    if (cancelledRef.current) return;
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    setIsEditing(false);
  }

  function cancel() {
    cancelledRef.current = true;
    setDraft(value);
    setIsEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") save();
    if (event.key === "Escape") cancel();
  }

  return {
    isEditing,
    startEditing,
    // Tudo que o <input> precisa, pronto para espalhar: <input {...inputProps} />
    inputProps: {
      ref: inputRef,
      value: draft,
      onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
      onKeyDown: handleKeyDown,
      onBlur: save,
    },
  };
}

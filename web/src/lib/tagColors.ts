import type { TagColor } from "@taskflow/shared";

// Record<TagColor, …> obriga a ter um valor para CADA cor do tipo:
// se alguém adicionar uma cor nova em @taskflow/shared, isto deixa de compilar.

/** Classes Tailwind de fundo e texto de cada cor de etiqueta. */
export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  yellow: "bg-brand-500 text-ink",
  black: "bg-ink text-white",
  gray: "bg-band text-ink",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
};

/** Nome da cor em português (leitores de tela e seletor de cor). */
export const TAG_COLOR_LABELS: Record<TagColor, string> = {
  yellow: "Amarelo",
  black: "Preto",
  gray: "Cinza",
  green: "Verde",
  red: "Vermelho",
  blue: "Azul",
};

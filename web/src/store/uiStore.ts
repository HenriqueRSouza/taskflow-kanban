import { create } from "zustand";
import type { CardId } from "@taskflow/shared";

/**
 * Estado de interface (não é salvo nem enviado ao servidor): qual cartão está
 * com o painel de detalhes aberto.
 *
 * Fica fora do Card de propósito: se o cartão for escondido pelo filtro
 * enquanto o painel está aberto, o painel continua na tela.
 */
interface CardDetailsState {
  openCardId: CardId | null;
  openCard: (id: CardId) => void;
  closeCard: () => void;
}

export const useCardDetailsStore = create<CardDetailsState>((set) => ({
  openCardId: null,
  openCard: (id) => set({ openCardId: id }),
  closeCard: () => set({ openCardId: null }),
}));

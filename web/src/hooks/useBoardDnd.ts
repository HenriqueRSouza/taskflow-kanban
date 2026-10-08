import { useRef, useState } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Active, CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent, Over } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { ColumnId } from "@taskflow/shared";
import { readDragData } from "../lib/dnd.ts";
import type { DragData } from "../lib/dnd.ts";
import { useBoardStore } from "../store/boardStore.ts";
import type { BoardData } from "../store/boardStore.ts";

/*
 * Toda a lógica de arrastar e soltar do quadro (docs/PLANEJAMENTO.md §6.1 e §7).
 *
 * - onDragStart: guarda o que está sendo arrastado (para o DragOverlay) e uma
 *   "foto" do quadro, caso o usuário cancele com Esc.
 * - onDragOver:  quando o cartão passa para OUTRA coluna, move no store na hora
 *   (a coluna de destino abre espaço para ele).
 * - onDragEnd:   aplica a posição final (reordenar na mesma coluna ou mover coluna).
 *
 * O store só é alterado quando o cartão troca de coluna ou é solto — nunca a
 * cada pixel de movimento —, o que mantém o arrasto leve.
 */
export function useBoardDnd() {
  const [active, setActive] = useState<DragData | null>(null);
  const snapshotRef = useRef<Pick<BoardData, "cards" | "cardOrder"> | null>(null);

  const sensors = useSensors(
    // Mouse: só começa a arrastar depois de mover 5px (um clique continua sendo clique).
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Toque: segurar 200ms antes de arrastar, senão o dedo não consegue rolar a tela.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    // Teclado: Tab até o item, Espaço para pegar, setas para mover, Espaço para soltar.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart({ active: dragged }: DragStartEvent) {
    const { cards, cardOrder } = useBoardStore.getState();
    snapshotRef.current = { cards, cardOrder };
    setActive(readDragData(dragged.data.current));
  }

  function handleDragOver({ active: dragged, over }: DragOverEvent) {
    const data = readDragData(dragged.data.current);
    if (data?.type !== "card" || !over) return;

    const { cards, moveCard } = useBoardStore.getState();
    const target = findCardTarget(dragged, over);
    const currentColumn = cards[data.id]?.columnId;
    if (target && target.columnId !== currentColumn) {
      moveCard(data.id, target.columnId, target.index);
    }
  }

  function handleDragEnd({ active: dragged, over }: DragEndEvent) {
    const data = readDragData(dragged.data.current);
    setActive(null);
    snapshotRef.current = null;
    if (!data || !over) return;

    const state = useBoardStore.getState();

    if (data.type === "card") {
      const columnId = state.cards[data.id]?.columnId;
      const overData = readDragData(over.data.current);
      if (!columnId || overData?.type !== "card" || overData.id === data.id) return;
      // Mesma coluna: o cartão vai para o lugar do cartão sobre o qual foi solto.
      const toIndex = (state.cardOrder[columnId] ?? []).indexOf(overData.id);
      if (toIndex >= 0) state.moveCard(data.id, columnId, toIndex);
      return;
    }

    const targetColumn = columnOf(over);
    if (!targetColumn || targetColumn === data.id) return;
    state.moveColumn(data.id, state.columnOrder.indexOf(targetColumn));
  }

  function handleDragCancel() {
    // Esc durante o arrasto: desfaz as trocas de coluna feitas no onDragOver.
    if (snapshotRef.current) useBoardStore.setState(snapshotRef.current);
    snapshotRef.current = null;
    setActive(null);
  }

  return {
    active,
    contextProps: {
      sensors,
      collisionDetection,
      accessibility,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
  };
}

// ---------- funções auxiliares ----------

/** Coluna à qual um alvo pertence (a própria coluna ou a coluna do cartão). */
function columnOf(over: Over): ColumnId | null {
  const data = readDragData(over.data.current);
  if (!data) return null;
  if (data.type === "column") return data.id;
  return useBoardStore.getState().cards[data.id]?.columnId ?? null;
}

/** Onde o cartão arrastado deve entrar: coluna e índice de destino. */
function findCardTarget(dragged: Active, over: Over): { columnId: ColumnId; index: number } | null {
  const data = readDragData(over.data.current);
  const columnId = columnOf(over);
  if (!data || !columnId) return null;

  const ids = useBoardStore.getState().cardOrder[columnId] ?? [];
  // Solto sobre a coluna (área vazia ou coluna sem cartões): vai para o fim.
  if (data.type === "column") return { columnId, index: ids.length };

  // Solto sobre um cartão: entra antes dele, ou depois se passou da metade.
  const overIndex = ids.indexOf(data.id);
  const draggedTop = dragged.rect.current.translated?.top ?? 0;
  const isBelow = draggedTop > over.rect.top + over.rect.height / 2;
  return { columnId, index: overIndex + (isBelow ? 1 : 0) };
}

/**
 * Detecção de colisão: arrastando COLUNA, só outras colunas contam como alvo
 * (senão ela "cairia" dentro de um cartão). Arrastando CARTÃO, o mais próximo vale.
 */
const collisionDetection: CollisionDetection = (args) => {
  if (readDragData(args.active.data.current)?.type === "column") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => readDragData(container.data.current)?.type === "column",
      ),
    });
  }
  return closestCorners(args);
};

/** Textos lidos pelo leitor de tela durante o arrasto (acessibilidade, RNF04). */
const accessibility = {
  screenReaderInstructions: {
    draggable:
      "Para pegar um item, pressione Espaço ou Enter. Use as setas para mover, Espaço ou Enter para soltar e Esc para cancelar.",
  },
  announcements: {
    onDragStart: ({ active }: { active: Active }) => `${describe(active)} selecionado.`,
    onDragOver: ({ active, over }: { active: Active; over: Over | null }) =>
      over ? `${describe(active)} sobre ${describe(over)}.` : `${describe(active)} fora de uma área válida.`,
    onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
      over ? `${describe(active)} solto sobre ${describe(over)}.` : `${describe(active)} solto.`,
    onDragCancel: ({ active }: { active: Active }) => `Movimento de ${describe(active)} cancelado.`,
  },
};

function describe(item: Active | Over): string {
  const data = readDragData(item.data.current);
  const state = useBoardStore.getState();
  if (data?.type === "card") return `cartão "${state.cards[data.id]?.title ?? ""}"`;
  if (data?.type === "column") return `coluna "${state.columns[data.id]?.title ?? ""}"`;
  return "item";
}

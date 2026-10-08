import { TagIdSchema } from "@taskflow/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { useFilterStore } from "./filterStore.ts";

const first = TagIdSchema.parse("00000000-0000-4000-8000-000000000001");
const second = TagIdSchema.parse("00000000-0000-4000-8000-000000000002");

beforeEach(() => {
  localStorage.clear();
  useFilterStore.getState().clear();
});

describe("filtro de etiquetas", () => {
  it("liga e desliga etiquetas sem duplicar IDs nem remover outras seleções", () => {
    const { toggleTag } = useFilterStore.getState();
    toggleTag(first);
    expect(useFilterStore.getState().tagIds).toEqual([first]);
    toggleTag(second);
    expect(useFilterStore.getState().tagIds).toEqual([first, second]);
    toggleTag(first);
    expect(useFilterStore.getState().tagIds).toEqual([second]);
    toggleTag(second);
    expect(useFilterStore.getState().tagIds).toEqual([]);
  });

  it("limpa toda a seleção e não grava estado no localStorage", () => {
    const { toggleTag, clear } = useFilterStore.getState();
    toggleTag(first);
    toggleTag(second);
    expect(localStorage.length).toBe(0);
    clear();
    expect(useFilterStore.getState().tagIds).toEqual([]);
    clear();
    expect(useFilterStore.getState().tagIds).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
});

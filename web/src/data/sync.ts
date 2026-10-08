import { useBoardStore } from "../store/boardStore.ts";
import { HttpBoardRepository } from "./HttpBoardRepository.ts";
import { createSyncEngine } from "./syncEngine.ts";

/**
 * Instância única usada pelo app. Para trocar o back-end (ex.: Supabase),
 * só esta linha muda: outro objeto que implemente BoardRepository.
 */
export const syncEngine = createSyncEngine(new HttpBoardRepository("/api"), useBoardStore);

/**
 * Com `?seed=N` (quadro de teste de desempenho, só em desenvolvimento) a
 * sincronização fica desligada, para não enviar 200 cartões falsos ao banco.
 */
export const syncEnabled = !(import.meta.env.DEV && new URLSearchParams(window.location.search).has("seed"));

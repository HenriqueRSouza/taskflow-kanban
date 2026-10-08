import { useSyncStore } from "../data/syncEngine.ts";
import type { SyncStatus } from "../data/syncEngine.ts";

// Record<SyncStatus, ...>: o TypeScript obriga a tratar TODOS os status.
const LABELS: Record<SyncStatus, { dot: string; text: (pending: number) => string }> = {
  idle: { dot: "bg-green-500", text: () => "Salvo" },
  syncing: { dot: "bg-brand-500 animate-pulse", text: () => "Salvando…" },
  offline: { dot: "bg-neutral-400", text: (n) => `Offline · ${n} ${n === 1 ? "alteração pendente" : "alterações pendentes"}` },
  error: { dot: "bg-red-500", text: () => "Erro ao salvar · tentando de novo" },
};

export function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  const pending = useSyncStore((s) => s.pending);
  const label = LABELS[status];

  return (
    // aria-live: o leitor de tela anuncia quando o texto muda.
    <span role="status" aria-live="polite" className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${label.dot}`} aria-hidden="true" />
      {label.text(pending)}
    </span>
  );
}

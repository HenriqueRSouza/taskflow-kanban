import { Board } from "./components/Board.tsx";

export function App() {
  return (
    <>
      <div className="h-9 text-[11px] text-white/80">
        <div className="mx-auto flex h-full max-w-[1440px] items-center px-4 sm:px-8">
          Quadro Kanban
        </div>
      </div>
      <main className="min-h-[calc(100dvh-2.25rem)] rounded-t-3xl bg-white text-ink">
        <header className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12">
          <h1 className="font-display text-3xl font-black uppercase tracking-tight sm:text-5xl">
            <span className="display-highlight">TaskFlow</span>
          </h1>
        </header>
        <Board />
      </main>
    </>
  );
}
